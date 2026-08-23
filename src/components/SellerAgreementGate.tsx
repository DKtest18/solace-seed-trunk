import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, FileText, ArrowDown } from 'lucide-react';
import {
  SELLER_AGREEMENT_VERSION,
  isSellerAgreementCurrent,
  useSellerRestrictions,
} from '@/hooks/useSellerRestrictions';
import {
  SellerAgreementAcceptLabel,
  SellerAgreementBody,
  useSellerObligationsPdf,
} from '@/components/seller/SellerAgreementContent';

/**
 * Full-screen, non-dismissible consent gate for every /seller* route.
 * No close button, no click-outside, no ESC — the seller must confirm.
 */
export function SellerAgreementGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { data: restrictions, isLoading } = useSellerRestrictions();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { pdfDoc, downloaded, pdfBusy, pdfError, download } = useSellerObligationsPdf();

  const scrollToPdf = () => {
    const el = document.getElementById('seller-obligations-pdf-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (!user) return <>{children}</>;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isSellerAgreementCurrent(restrictions)) return <>{children}</>;

  const handleConfirm = async () => {
    setSaving(true);
    setErrorMessage(null);
    const nowIso = new Date().toISOString();
    const { error } = await db
      .from('dkai_profiles')
      .update({
        seller_agreement_accepted: true,
        seller_agreement_version: SELLER_AGREEMENT_VERSION,
        seller_agreement_accepted_at: nowIso,
        seller_obligations_pdf_acknowledged: true,
        seller_obligations_pdf_version: pdfDoc?.version ?? null,
        // Accepting here also completes the "Seller Terms & Conditions" onboarding step.
        terms_accepted: true,
        terms_accepted_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', user.id)
      .select('id, seller_agreement_accepted, seller_agreement_version')
      .maybeSingle();

    if (error) {
      // Raw Supabase error on purpose — this must stay debuggable.
      setErrorMessage(`${error.message}${(error as any).details ? ` — ${(error as any).details}` : ''}${(error as any).hint ? ` (hint: ${(error as any).hint})` : ''}${(error as any).code ? ` [${(error as any).code}]` : ''}`);
      setSaving(false);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ['seller-restrictions', user.id] });
    await queryClient.invalidateQueries({ queryKey: ['seller-onboarding-progress'] });
    await queryClient.refetchQueries({ queryKey: ['seller-restrictions', user.id] });
    setSaving(false);
  };

  const shownError = errorMessage ?? pdfError;

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="seller-agreement-title"
        className="w-full max-w-2xl rounded-lg border bg-card shadow-xl flex flex-col max-h-[92vh]"
      >
        <div className="px-6 pt-6 pb-3 border-b flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 id="seller-agreement-title" className="text-xl font-bold">
              Seller Agreement
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={scrollToPdf}
            className="text-primary"
          >
            <ArrowDown className="h-4 w-4 mr-1" />
            Jump to PDF
          </Button>
        </div>

        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-smooth px-6 py-4"
        >
          <SellerAgreementBody
            pdfVersion={pdfDoc?.version}
            downloaded={downloaded}
            pdfBusy={pdfBusy}
            onDownload={download}
          />
        </div>

        <div className="px-6 py-4 border-t space-y-4">
          {shownError && (
            <Alert variant="destructive">
              <AlertDescription className="text-xs break-words font-mono">{shownError}</AlertDescription>
            </Alert>
          )}
          {!downloaded && (
            <p className="text-xs text-muted-foreground">
              Download the Seller Obligations PDF above to enable the acceptance checkbox.
            </p>
          )}
          <div className="flex items-start gap-2">
            <Checkbox
              id="seller-agreement-accept"
              checked={checked}
              disabled={!downloaded}
              onCheckedChange={(v) => setChecked(v === true)}
            />
            <Label htmlFor="seller-agreement-accept" className="text-sm cursor-pointer">
              <SellerAgreementAcceptLabel
                htmlFor="seller-agreement-accept"
                pdfBusy={pdfBusy}
                onDownload={download}
              />
            </Label>
          </div>
          <Button onClick={handleConfirm} disabled={!checked || !downloaded || saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}
