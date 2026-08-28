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
import { Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { resolveNextOnboardingRoute } from '@/lib/sellerOnboardingNav';
import { HourglassLoader } from '@/components/HourglassLoader';

export default function SellerOnboardingIdentity() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState('draft');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
      setApplicationStatus(existingApp.status || 'draft');
    }

    const { data: profile } = await db
      .from('dkai_profiles')
      .select('is_age_verified')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      setAgeConfirmed(!!profile.is_age_verified);
    }

    hasLoadedExisting.current = true;
    setInitializing(false);
  };

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
            status: applicationStatus === 'approved' ? 'approved' : 'draft',
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, formData, ageConfirmed, applicationStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

    setLoading(true);
    try {
      await persistDraft();
      const nextRoute = await resolveNextOnboardingRoute(queryClient, uid, 'seller-identity-age');
      toast({ title: 'Saved', description: 'Identity and age verification saved.' });
      navigate(nextRoute);
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
        <HourglassLoader size={64} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/seller-onboarding')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Checklist
        </Button>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Seller Identity & Age Verification</h1>
          <p className="text-muted-foreground">
            Provide your information and confirm you are at least 18 years old
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
                <p className="text-xs text-muted-foreground">This is how you'll appear to buyers</p>
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

              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={loading || !ageConfirmed} className="flex-1">
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
