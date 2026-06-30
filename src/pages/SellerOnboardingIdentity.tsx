import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { CountryCombobox } from '@/components/CountryCombobox';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/dkaiDb';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowLeft, CheckCircle2, FileText } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function SellerOnboardingIdentity() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const hasLoadedExisting = useRef(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    creator_name: '',
    bio: '',
    country: '',
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    checkExistingApplication();
  }, [user, navigate]);

  const checkExistingApplication = async () => {
    if (!user) return;

    const { data: existingApp } = await db
      .from('dkai_seller_applications')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingApp) {
      setFormData({
        first_name: existingApp.first_name || '',
        last_name: existingApp.last_name || '',
        creator_name: existingApp.creator_name || '',
        bio: existingApp.bio || '',
        country: existingApp.country || '',
      });
    }

    // Check age verification
    const { data: profile } = await db
      .from('dkai_profiles')
      .select('is_age_verified, terms_accepted')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      setAgeConfirmed(!!profile.is_age_verified);
      setTermsAccepted(!!profile.terms_accepted);
    }

    hasLoadedExisting.current = true;
    setInitializing(false);
  };

  const queryClient = useQueryClient();

  const persistDraft = async () => {
    if (!user || !hasLoadedExisting.current) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id;
    if (!uid) return;

    const nowIso = new Date().toISOString();

    const { error: profileError } = await db
      .from('dkai_profiles')
      .update({
        is_age_verified: ageConfirmed,
        age_verified_at: ageConfirmed ? nowIso : null,
        terms_accepted: termsAccepted,
        terms_accepted_at: termsAccepted ? nowIso : null,
        updated_at: nowIso,
      })
      .eq('id', uid);
    if (profileError) throw profileError;

    const hasMinimumApplication = !!(
      formData.first_name.trim() &&
      formData.last_name.trim() &&
      formData.creator_name.trim()
    );

    if (hasMinimumApplication) {
      const { error: appError } = await db
        .from('dkai_seller_applications')
        .upsert(
          {
            user_id: uid,
            first_name: formData.first_name.trim(),
            last_name: formData.last_name.trim(),
            creator_name: formData.creator_name.trim(),
            bio: formData.bio,
            country: formData.country,
            status: 'draft',
            applied_at: nowIso,
            updated_at: nowIso,
          },
          { onConflict: 'user_id' }
        );
      if (appError) throw appError;
    }

    await queryClient.invalidateQueries({ queryKey: ['seller-onboarding-progress'] });
  };

  useEffect(() => {
    if (!user || !hasLoadedExisting.current) return;

    const timeout = window.setTimeout(() => {
      persistDraft().catch((error) => console.error('[onboarding/identity] draft save error:', error));
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [user, formData, ageConfirmed, termsAccepted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Derive user id from the verified JWT (not from React state alone).
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id;
    if (!uid) {
      toast({ title: 'Not signed in', description: 'Please sign in again.', variant: 'destructive' });
      return;
    }

    if (!formData.first_name || !formData.last_name || !formData.creator_name || !formData.country) {
      toast({ title: 'Missing fields', description: 'Please fill in all required fields.', variant: 'destructive' });
      return;
    }

    if (!ageConfirmed) {
      toast({ title: 'Age Verification Required', description: 'You must confirm you are 18 years or older.', variant: 'destructive' });
      return;
    }

    if (!termsAccepted) {
      toast({ title: 'Terms Required', description: 'You must accept the terms and conditions.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      await persistDraft();
      const nowIso = new Date().toISOString();

      // Final submit marks the draft application approved for checklist completion.
      const { error: appError } = await db
        .from('dkai_seller_applications')
        .update({ status: 'approved', updated_at: nowIso })
        .eq('user_id', uid);
      if (appError) throw appError;

      // 3) Read-back to confirm persistence (console-verifiable).
      const [{ data: appAfter }, { data: profAfter }] = await Promise.all([
        db.from('dkai_seller_applications').select('*').eq('user_id', uid).maybeSingle(),
        db.from('dkai_profiles').select('is_age_verified,age_verified_at,terms_accepted,terms_accepted_at,full_name,username').eq('id', uid).maybeSingle(),
      ]);
      console.log('[onboarding/identity] saved seller_application:', appAfter);
      console.log('[onboarding/identity] saved profile flags:', profAfter);

      await queryClient.invalidateQueries({ queryKey: ['seller-onboarding-progress'] });

      toast({ title: 'Saved', description: 'Your seller identity, terms and age have been saved.' });
      navigate('/seller-onboarding');
    } catch (error: any) {
      console.error('[onboarding/identity] save error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save seller identity',
        variant: 'destructive',
      });
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
        <Button
          variant="ghost"
          onClick={() => {
            const params = new URLSearchParams(window.location.search);
            const from = params.get('from');
            navigate(from && from.startsWith('/') ? from : '/seller-onboarding');
          }}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Seller Identity & Age Verification</h1>
          <p className="text-muted-foreground">
            Provide your information and confirm you meet our requirements
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                This information helps us verify your identity and create your seller profile
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">
                    First Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="first_name"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                    placeholder="John"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="last_name">
                    Last Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="last_name"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="creator_name">
                  Creator/Business Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="creator_name"
                  required
                  value={formData.creator_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, creator_name: e.target.value }))}
                  placeholder="Your business or creator name"
                />
                <p className="text-xs text-muted-foreground">
                  This is how you'll appear to buyers
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">About Your Business</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder="Tell buyers about your products or services..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country/Region <span className="text-destructive">*</span></Label>
                <CountryCombobox
                  id="country"
                  value={formData.country}
                  onChange={(value) => setFormData(prev => ({ ...prev, country: value }))}
                />
              </div>

              <Separator />

              {/* Age Verification */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  Age Verification
                  {ageConfirmed && <CheckCircle2 className="h-5 w-5 text-primary" />}
                </h3>
                <div className="flex items-start space-x-3 p-4 bg-muted/50 rounded-lg">
                  <Checkbox
                    id="age"
                    checked={ageConfirmed}
                    onCheckedChange={(checked) => setAgeConfirmed(checked as boolean)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label htmlFor="age" className="text-sm font-medium cursor-pointer">
                      I confirm that I am 18 years of age or older <span className="text-destructive">*</span>
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      You must be at least 18 years old to become a seller on our platform
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Terms & Conditions */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Seller Terms & Conditions
                  {termsAccepted && <CheckCircle2 className="h-5 w-5 text-primary" />}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Please read the following terms carefully before accepting. By becoming a seller on DK AI Marketplace, you agree to the following obligations:
                </p>
                <div className="border rounded-lg">
                  <div className="bg-muted px-4 py-3 border-b flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    <span className="font-medium text-sm">Seller Agreement — Version 1.0</span>
                  </div>
                  <ScrollArea className="h-[320px] p-4">
                    <div className="space-y-4 pr-3 text-sm leading-relaxed">
                      <div>
                        <h4 className="font-semibold mb-1">1. Eligibility</h4>
                        <p className="text-muted-foreground">You must be at least 18 years of age to register as a seller. By confirming your age above, you certify under penalty of perjury that you meet this requirement. The platform reserves the right to request additional age or identity verification at any time.</p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">2. Identity Verification</h4>
                        <p className="text-muted-foreground">You agree to provide accurate and truthful personal information including your legal name, business name, and country of residence. Providing false information is grounds for immediate account termination and forfeiture of any pending payouts.</p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">3. Product Listing Obligations</h4>
                        <p className="text-muted-foreground">All products must accurately represent what the buyer will receive. You may not list counterfeit, stolen, or illegally obtained goods. Product descriptions, images, and files must be truthful. Misleading listings will be removed and may result in account suspension.</p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">4. Escrow & Payment Terms</h4>
                        <p className="text-muted-foreground">All payments are held in escrow via Stripe until the buyer confirms receipt and the return window has expired. You will receive 90% of the sale price; 10% is retained as a platform fee. Payouts are only processed after the return window has fully expired — you must plan your finances accordingly.</p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">5. Return Window & Refunds</h4>
                        <p className="text-muted-foreground">Every product has a return window (minimum 24 hours, maximum 90 days) that you set. You cannot set it below 24 hours. If a buyer requests a return within this window, they receive a 100% refund to their original payment method, and you receive nothing for that transaction. You cannot refuse a valid return.</p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">6. Delivery Obligations</h4>
                        <p className="text-muted-foreground">Once a purchase is completed, you are obligated to deliver the product as described. You cannot refuse delivery, withhold files, or provide altered versions. The delivered product must match the listing in all material respects.</p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">7. Prohibited Content</h4>
                        <p className="text-muted-foreground">You may not upload or distribute malware, viruses, illegal content, copyrighted material you don't own, adult content without proper classification, or any content that violates applicable laws in your jurisdiction or the buyer's jurisdiction.</p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">8. Disputes & Mediation</h4>
                        <p className="text-muted-foreground">If a buyer opens a dispute, you have a set deadline to respond. Failure to respond may result in an automatic ruling in the buyer's favor. The platform's admin team may mediate disputes and their decisions are final. Repeated disputes may result in penalties or account suspension.</p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">9. Account Conduct</h4>
                        <p className="text-muted-foreground">You must conduct yourself professionally at all times. Harassment, abuse, threats, or manipulation of reviews, ratings, or platform systems is strictly prohibited. The platform may apply sanctions including warnings, temporary suspensions, or permanent bans.</p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">10. Data & Privacy</h4>
                        <p className="text-muted-foreground">You agree to handle any buyer information you receive (e.g., names, emails for meetings) in accordance with applicable data protection laws (GDPR, etc.). You may not share, sell, or misuse buyer data. Violations will result in immediate account termination.</p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">11. Platform Fee Changes</h4>
                        <p className="text-muted-foreground">The platform reserves the right to adjust fees with 30 days' notice. Continued use of the platform after the notice period constitutes acceptance of the new fee structure.</p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">12. Termination</h4>
                        <p className="text-muted-foreground">Either party may terminate the seller agreement at any time. Upon termination, all pending transactions will be completed per existing terms. Any escrowed funds will be handled according to their respective return windows before final payout or refund.</p>
                      </div>
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground italic">
                          For questions or concerns, contact <strong>support@dkaimarketplace.com</strong>
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
                      By checking this box, you agree to all obligations outlined above including escrow terms, return policies, and platform rules.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={loading || !ageConfirmed || !termsAccepted} className="flex-1">
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save & Continue
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
