import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { resolveNextOnboardingRoute } from '@/lib/sellerOnboardingNav';
import { useToast } from '@/hooks/use-toast';
import { acceptSellerAgreement, getSellerAgreementState } from '@/lib/sellerAgreementAccept';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, ArrowDown, CheckCircle2, FileText, Loader2 } from 'lucide-react';
import { hasCurrentSellerAgreement } from '@/lib/sellerAgreement';
import {
import { HourglassLoader } from '@/components/HourglassLoader';
  SellerAgreementAcceptLabel,
  SellerAgreementBody,
  useSellerObligationsPdf,
} from '@/components/seller/SellerAgreementContent';

export default function SellerOnboardingTerms() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { pdfDoc, downloaded, pdfBusy, pdfError, download } = useSellerObligationsPdf();

  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [alreadyAccepted, setAlreadyAccepted] = useState(false);

  const scrollToPdf = () => {
    const el = document.getElementById('seller-obligations-pdf-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    (async () => {
      try {
        const accepted = hasCurrentSellerAgreement(await getSellerAgreementState(user.id));
        setAlreadyAccepted(accepted);
        setChecked(accepted);
      } catch (error) {
        console.error('[onboarding/terms] state error:', error);
      } finally {
        setInitializing(false);
      }
    })();
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id;
    if (!uid) {
      toast({ title: 'Not signed in', description: 'Please sign in again.', variant: 'destructive' });
      return;
    }

    if (!checked) {
      toast({ title: 'Terms Required', description: 'You must accept the seller terms to continue.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const result = await acceptSellerAgreement(uid, pdfDoc?.version ?? null);
      if (!result.ok) {
        throw new Error(result.error || 'Seller agreement acceptance was not saved. Please try again.');
      }


      await queryClient.invalidateQueries({ queryKey: ['seller-onboarding-progress'] });
      await queryClient.invalidateQueries({ queryKey: ['seller-restrictions', uid] });
      setAlreadyAccepted(true);
      toast({ title: 'Terms accepted', description: 'Seller terms saved.' });
      navigate(await resolveNextOnboardingRoute(queryClient, uid, 'seller-terms'));
    } catch (err: any) {
      console.error('[onboarding/terms] save error:', err);
      toast({ title: 'Error', description: err?.message || 'Failed to save terms.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;
  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <HourglassLoader size={64} />
      </div>
    );
  }

  const canAccept = alreadyAccepted || downloaded;

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate('/seller-onboarding')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Checklist
        </Button>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Seller Terms &amp; Conditions</h1>
          <p className="text-muted-foreground">
            Review the seller agreement and accept the terms to complete this step.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={scrollToPdf} className="text-primary">
            <ArrowDown className="h-4 w-4 mr-2" />
            Jump to Download PDF
          </Button>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Seller Agreement
                {alreadyAccepted && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    <CheckCircle2 className="h-4 w-4" />
                    Accepted
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Please read carefully before accepting. By becoming a seller on DK AI Marketplace,
                you agree to the following obligations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border rounded-lg">
                <div className="bg-muted px-4 py-3 border-b flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span className="font-medium text-sm">Seller Agreement</span>
                </div>
                <div
                  ref={scrollContainerRef}
                  className="h-[420px] overflow-y-auto overscroll-contain scroll-smooth px-4 py-4"
                >
                  <div className="pr-3">
                    <SellerAgreementBody
                      pdfVersion={pdfDoc?.version}
                      downloaded={downloaded}
                      pdfBusy={pdfBusy}
                      onDownload={download}
                    />
                  </div>
                </div>
              </div>

              {pdfError && (
                <Alert variant="destructive">
                  <AlertDescription className="text-xs break-words font-mono">{pdfError}</AlertDescription>
                </Alert>
              )}

              {!canAccept && (
                <p className="text-xs text-muted-foreground">
                  Download the Seller Obligations PDF above to enable the acceptance checkbox.
                </p>
              )}

              <div className="flex items-start space-x-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
                <Checkbox
                  id="terms"
                  checked={checked}
                  disabled={!canAccept}
                  onCheckedChange={(v) => setChecked(v === true)}
                />
                <Label htmlFor="terms" className="text-sm cursor-pointer leading-relaxed">
                  <SellerAgreementAcceptLabel htmlFor="terms" pdfBusy={pdfBusy} onDownload={download} />
                </Label>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={loading || !checked || !canAccept} className="flex-1">
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {alreadyAccepted ? 'Accepted — Continue' : 'Accept & Continue'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/seller-onboarding')}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}
