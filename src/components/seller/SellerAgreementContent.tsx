import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { Button } from '@/components/ui/button';
import { Loader2, Download, CheckCircle2 } from 'lucide-react';

export const OBLIGATIONS: string[] = [
  'Deliver exactly what your listing describes. You may not refuse delivery of a purchased product.',
  'Only upload content you own or are fully licensed to sell. No malware, illegal, infringing, or adult content.',
  'Answer buyer questions and support requests about your products within 48 hours.',
  'Cooperate with refund reviews. No response within 48 hours means the case is decided in the buyer\u2019s favour.',
  'Keep your own master copies of every file you upload \u2014 you are responsible for your backups.',
  'Keep your payout details (Stripe / PayPal) accurate and taxes for your own sales are your responsibility.',
  'Follow the Platform Rules and all applicable law in your country of residence.',
];

export const CLAUSES: { heading: string; body: string }[] = [
  {
    heading: '1. Liability.',
    body:
      'DK AI Marketplace and Dari Kastrati are liable to you only to the extent permitted by applicable law. This excludes, in particular, damages arising from outages, data loss, or unauthorized access to the platform or to Supabase infrastructure, except to the extent such damages result from intent or gross negligence on the part of DK AI Marketplace.',
  },
  {
    heading: '2. Content warranty & indemnification.',
    body:
      'You represent and warrant that you own, or hold all necessary rights and licenses to, all content, code, and materials you upload. You agree to indemnify and hold harmless DK AI Marketplace and Dari Kastrati against any third-party claims, damages, or costs arising from a breach of this warranty, to the extent permitted by applicable law.',
  },
  {
    heading: '3. Review access.',
    body:
      'You grant DK AI Marketplace / Dari Kastrati access to the products, files, and information in your seller account for the purpose of reviewing them prior to publication.',
  },
  {
    heading: '4. Publication.',
    body:
      'Submitted products are not visible or purchasable by buyers until they have been reviewed and approved by DK AI Marketplace.',
  },
  {
    heading: '5. No employment relationship.',
    body:
      'This agreement does not create an employment, partnership, or agency relationship between you and DK AI Marketplace or Dari Kastrati. You act as an independent seller.',
  },
  {
    heading: '6. Confidentiality.',
    body:
      'Any non-public information about the platform, its backend, or its operations that you encounter is confidential and may not be disclosed or used outside the scope of your seller activity.',
  },
  {
    heading: '7. Demo videos and archived review material.',
    body:
      'Demo videos and any other material you submit for pre-publication review are stored by the Platform, including in archived form after review is complete, so that the Platform can document how a listing was assessed. To the extent permitted by applicable law, DK AI Marketplace and Dari Kastrati accept no liability for the loss, deletion, corruption, or unauthorized access to this archived review material, except where such loss results from intent or gross negligence on the part of DK AI Marketplace. You should retain your own copy of any demo video you submit.',
  },
];

/** Shared Seller Obligations PDF lookup + signed-URL download logic. */
export function useSellerObligationsPdf() {
  const [downloaded, setDownloaded] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const { data: pdfDoc } = useQuery({
    queryKey: ['legal-doc', 'seller_obligations'],
    queryFn: async () => {
      const { data } = await db
        .from('dkai_legal_documents')
        .select('title, version, storage_path')
        .eq('slug', 'seller_obligations')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as any) ?? null;
    },
  });

  const download = async () => {
    setPdfError(null);
    setPdfBusy(true);

    const candidates: string[] = [];
    if (pdfDoc?.storage_path) candidates.push(pdfDoc.storage_path);
    candidates.push('Seller_Obligations.pdf', 'seller-obligations/Seller_Obligations.pdf');

    const { data: rootFiles } = await db.storage.from('legal-documents').list('', { limit: 100 });
    for (const f of (rootFiles as any[]) ?? []) {
      if (typeof f?.name === 'string' && f.name.toLowerCase().endsWith('.pdf')) candidates.push(f.name);
    }

    let lastError: string | null = null;
    for (const path of Array.from(new Set(candidates))) {
      const { data, error } = await db.storage
        .from('legal-documents')
        .createSignedUrl(path, 300, { download: 'Seller_Obligations.pdf' });
      if (!error && data?.signedUrl) {
        setPdfBusy(false);
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
        setDownloaded(true);
        return;
      }
      lastError = error?.message ?? 'Could not create download link.';
    }

    setPdfBusy(false);
    setPdfError(
      `${lastError ?? 'Seller Obligations PDF not found.'} — check the file exists in the "legal-documents" bucket.`,
    );
  };

  return { pdfDoc, downloaded, pdfBusy, pdfError, download, setPdfError };
}

/** The exact agreement body shown in the seller gate popup. */
export function SellerAgreementBody({
  pdfVersion,
  downloaded,
  pdfBusy,
  onDownload,
}: {
  pdfVersion?: string | null;
  downloaded: boolean;
  pdfBusy: boolean;
  onDownload: () => void;
}) {
  return (
    <>
      <p className="text-sm text-muted-foreground">
        Before you can submit products to DK AI Marketplace, please confirm the following (this
        agreement is subject to review by legal counsel and may be updated):
      </p>
      <ul className="mt-4 space-y-4">
        {CLAUSES.map((c) => (
          <li key={c.heading} className="text-sm leading-relaxed">
            <strong>{c.heading}</strong> {c.body}
          </li>
        ))}
      </ul>

      <div id="seller-obligations-pdf-section" className="mt-6 rounded-lg border bg-muted/40 p-4 scroll-mt-4">
        <h3 className="text-sm font-semibold">Seller obligations</h3>
        <ul className="mt-2 space-y-2 list-disc list-inside text-sm leading-relaxed">
          {OBLIGATIONS.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          The full Seller Obligations document{pdfVersion ? ` (version ${pdfVersion})` : ''} must be
          downloaded and read before you can accept.
        </p>
        <Button type="button" variant="outline" className="mt-3 w-full" onClick={onDownload} disabled={pdfBusy}>
          {pdfBusy ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : downloaded ? (
            <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {downloaded ? 'PDF downloaded — download again' : 'Download Seller Obligations (PDF)'}
        </Button>
      </div>
    </>
  );
}

/** Shared acceptance checkbox label with the highlighted PDF link. */
export function SellerAgreementAcceptLabel({
  htmlFor,
  pdfBusy,
  onDownload,
}: {
  htmlFor: string;
  pdfBusy: boolean;
  onDownload: () => void;
}) {
  return (
    <>
      I have downloaded and read the{' '}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onDownload();
        }}
        disabled={pdfBusy}
        className="text-primary font-semibold underline underline-offset-2 hover:text-primary/80 disabled:opacity-60"
      >
        Seller Obligations
      </button>{' '}
      PDF as well as this agreement and the seller obligations listed above, and I accept them in full.
    </>
  );
}
