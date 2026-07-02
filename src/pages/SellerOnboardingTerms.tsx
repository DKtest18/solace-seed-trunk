import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/dkaiDb';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, CheckCircle2, FileText, Loader2 } from 'lucide-react';
import { usePlatformFee } from '@/hooks/usePlatformFee';

export default function SellerOnboardingTerms() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { feePct } = usePlatformFee();

  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const hasLoadedExisting = useRef(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    (async () => {
      const { data: profile } = await db
        .from('dkai_profiles')
        .select('terms_accepted')
        .eq('id', user.id)
        .maybeSingle();
      if (profile) setTermsAccepted(!!profile.terms_accepted);
      hasLoadedExisting.current = true;
      setInitializing(false);
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

    if (!termsAccepted) {
      toast({ title: 'Terms Required', description: 'You must accept the seller terms to continue.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await db
        .from('dkai_profiles')
        .update({
          terms_accepted: true,
          terms_accepted_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', uid);
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['seller-onboarding-progress'] });
      toast({ title: 'Terms accepted', description: 'Seller terms saved.' });
      navigate('/seller-onboarding');
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
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate('/seller-onboarding')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Checklist
        </Button>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Seller Terms & Conditions</h1>
          <p className="text-muted-foreground">
            Review the seller agreement and accept the terms to complete this step.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Seller Agreement — Version 1.0
                {termsAccepted && <CheckCircle2 className="h-5 w-5 text-primary" />}
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
                <ScrollArea className="h-[360px] p-4">
                  <div className="space-y-4 pr-3 text-sm leading-relaxed">
                    <div>
                      <h4 className="font-semibold mb-1">1. Eligibility</h4>
                      <p className="text-muted-foreground">You must be at least 18 years of age to register as a seller. By confirming your age in the previous step, you certify under penalty of perjury that you meet this requirement.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">2. Identity Verification</h4>
                      <p className="text-muted-foreground">You agree to provide accurate and truthful personal information. Providing false information is grounds for immediate account termination.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">3. Product Listing Obligations</h4>
                      <p className="text-muted-foreground">All products must accurately represent what the buyer will receive. You may not list counterfeit, stolen, or illegally obtained goods. Misleading listings will be removed.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">4. Payments & Fees</h4>
                      <p className="text-muted-foreground">Payments are processed by Stripe and go directly to your Stripe account. Platform fee: 0% during the launch promo (first 20 sales on the platform), {feePct}% after. Stripe's standard payment processing fees apply and are borne by you as the seller.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">5. Refunds (support-reviewed)</h4>
                      <p className="text-muted-foreground">Refunds are only granted through DK AI Marketplace support review, for two reasons: the product was not delivered within the promised delivery time, or the product is materially not as described. Requests must be filed within 14 days of purchase. Approved refunds are for the full purchase price, issued via Stripe from your Stripe balance, typically within 24–72 hours of approval. You must respond to support inquiries about refund requests within 48 hours; no response means the case is decided in the buyer&apos;s favor.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">6. Delivery Obligations</h4>
                      <p className="text-muted-foreground">Once a purchase is completed, you are obligated to deliver the product as described. You cannot refuse delivery, withhold files, or provide altered versions.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">7. Prohibited Content</h4>
                      <p className="text-muted-foreground">You may not upload malware, illegal content, copyrighted material you don't own, adult content without proper classification, or content that violates applicable laws.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">8. Disputes & Mediation</h4>
                      <p className="text-muted-foreground">If a buyer opens a dispute, you have a set deadline to respond. Failure to respond may result in an automatic ruling in the buyer's favor. Platform decisions in disputes are final.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">9. Account Conduct</h4>
                      <p className="text-muted-foreground">You must conduct yourself professionally at all times. Harassment, abuse, or manipulation of reviews is strictly prohibited.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">10. Data & Privacy</h4>
                      <p className="text-muted-foreground">You must handle buyer information in accordance with applicable data protection laws (GDPR, etc.).</p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">11. Platform Fee Changes</h4>
                      <p className="text-muted-foreground">The platform may adjust fees with 30 days' notice. Continued use after the notice period constitutes acceptance.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">12. Termination</h4>
                      <p className="text-muted-foreground">Either party may terminate the seller agreement at any time. Pending transactions will be completed per existing terms.</p>
                    </div>
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground italic">
                        For questions, contact <strong>support@dkaimarketplace.com</strong>
                      </p>
                    </div>
                  </div>
                </ScrollArea>
              </div>

              <div className="flex items-start space-x-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
                <Checkbox
                  id="terms"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor="terms" className="text-sm font-medium cursor-pointer">
                    I have read, understood, and accept the Seller Terms & Conditions <span className="text-destructive">*</span>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    By checking this box, you agree to the obligations outlined above.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={loading || !termsAccepted} className="flex-1">
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Accept & Continue
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
