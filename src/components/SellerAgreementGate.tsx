import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, FileText } from 'lucide-react';
import {
  SELLER_AGREEMENT_VERSION,
  isSellerAgreementCurrent,
  useSellerRestrictions,
} from '@/hooks/useSellerRestrictions';

const CLAUSES: { heading: string; body: string }[] = [
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
];

/**
 * Full-screen, non-dismissible consent gate for every /seller* route.
 * No close button, no click-outside, no ESC — the seller must confirm.
 */
export function SellerAgreementGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: restrictions, isLoading } = useSellerRestrictions();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    const { error } = await db
      .from('dkai_profiles')
      .update({
        seller_agreement_accepted: true,
        seller_agreement_version: SELLER_AGREEMENT_VERSION,
        seller_agreement_accepted_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      // Raw Supabase error on purpose — this must stay debuggable.
      setErrorMessage(`${error.message}${(error as any).details ? ` — ${(error as any).details}` : ''}${(error as any).hint ? ` (hint: ${(error as any).hint})` : ''}${(error as any).code ? ` [${(error as any).code}]` : ''}`);
      setSaving(false);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ['seller-restrictions', user.id] });
    await queryClient.refetchQueries({ queryKey: ['seller-restrictions', user.id] });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="seller-agreement-title"
        className="w-full max-w-2xl rounded-lg border bg-card shadow-xl flex flex-col max-h-[92vh]"
      >
        <div className="px-6 pt-6 pb-3 border-b flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 id="seller-agreement-title" className="text-xl font-bold">
            Seller Agreement
          </h2>
        </div>

        <ScrollArea className="flex-1 px-6 py-4">
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
        </ScrollArea>

        <div className="px-6 py-4 border-t space-y-4">
          {errorMessage && (
            <Alert variant="destructive">
              <AlertDescription className="text-xs break-words font-mono">{errorMessage}</AlertDescription>
            </Alert>
          )}
          <div className="flex items-start gap-2">
            <Checkbox
              id="seller-agreement-accept"
              checked={checked}
              onCheckedChange={(v) => setChecked(v === true)}
            />
            <Label htmlFor="seller-agreement-accept" className="text-sm cursor-pointer">
              I have read and accept this agreement.
            </Label>
          </div>
          <Button onClick={handleConfirm} disabled={!checked || saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}
