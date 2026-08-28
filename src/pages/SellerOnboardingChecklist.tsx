import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SellerOnboardingCelebration } from '@/components/seller/SellerOnboardingCelebration';
import { useAuth } from '@/contexts/AuthContext';
import { useSellerOnboardingProgress } from '@/hooks/useSellerOnboardingProgress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, ChevronRight, Sparkles } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/dkaiDb';
import { useQueryClient } from '@tanstack/react-query';
import { HourglassLoader } from '@/components/HourglassLoader';

export default function SellerOnboardingChecklist() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: onboarding, isLoading } = useSellerOnboardingProgress();
  const [searchParams] = useSearchParams();
  const [celebrating, setCelebrating] = useState(false);
  const [activating, setActivating] = useState(false);

  const celebrationKey = user ? `dkai_seller_celebrated_${user.id}` : null;

  useEffect(() => {
    if (!onboarding?.allRequiredComplete || !celebrationKey) return;
    const alreadyShown = localStorage.getItem(celebrationKey) === '1';
    if (!alreadyShown || searchParams.get('celebrate') === '1') {
      setCelebrating(true);
      localStorage.setItem(celebrationKey, '1');
    }
  }, [onboarding?.allRequiredComplete, celebrationKey, searchParams]);

  if (!user) {
    navigate('/login');
    return null;
  }

  const handleFinishSetup = async () => {
    if (activating) return;
    if (!onboarding?.allRequiredComplete) {
      toast({
        title: 'Complete Required Steps',
        description: 'Please complete all required steps before finishing setup.',
        variant: 'destructive',
      });
      return;
    }

    setActivating(true);
    try {
    // Server-side SECURITY DEFINER validates all 5 requirements and grants the seller role.
    const { data, error } = await db.rpc('dkai_activate_seller');

    if (error || (data && (data as any).success === false)) {
      console.error('Seller activation failed:', error, data);
      toast({
        title: 'Activation failed',
        description: (error as any)?.message || (data as any)?.error || 'Could not activate seller account.',
        variant: 'destructive',
      });
      return;
    }

    // Read back to confirm role was written to dkai_user_roles (same table the guards check).
    const { data: roleCheck } = await db
      .from('dkai_user_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'seller')
      .maybeSingle();

    if (!roleCheck) {
      toast({
        title: 'Activation incomplete',
        description: 'Seller role could not be verified. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    // Invalidate & AWAIT the role refetch so guards see the fresh 'seller' role
    // before we navigate. Prevents the "Seller Access Required" flash.
    await queryClient.invalidateQueries({ queryKey: ['userRole', user.id] });
    await queryClient.refetchQueries({ queryKey: ['userRole', user.id] });
    await queryClient.invalidateQueries({ queryKey: ['seller-onboarding-progress', user.id] });

    toast({ title: 'Success!', description: 'Your seller account is now active.' });
    navigate('/create-product');
    } finally {
      setActivating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <HourglassLoader size={96} />
      </div>
    );
  }

  if (!onboarding) return null;

  return (
    <>
      <SellerOnboardingCelebration
        open={celebrating}
        onOpenChange={setCelebrating}
        onContinue={() => { setCelebrating(false); handleFinishSetup(); }}
        loading={activating}
      />
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold">Become a Seller</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Complete the steps below to activate your seller account and start selling your products
          </p>
        </div>

        <Card className="border-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Setup Progress</CardTitle>
                <CardDescription>
                  {onboarding.completedRequired} of {onboarding.totalRequired} required steps completed
                </CardDescription>
              </div>
              <Badge variant={onboarding.allRequiredComplete ? 'default' : 'secondary'} className="text-lg px-4 py-2">
                {onboarding.progress}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={onboarding.progress} className="h-3" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Onboarding Checklist</CardTitle>
            <CardDescription>
              Click on any step to complete it. Required steps are marked with a badge.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {onboarding.steps.map((step, index) => (
              <div key={step.id}>
                <button
                  onClick={() => navigate(step.route)}
                  className="w-full group hover:bg-muted/50 rounded-lg p-4 transition-colors text-left"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-1">
                      {step.completed ? (
                        <CheckCircle2 className="h-6 w-6 text-green-500" />
                      ) : (
                        <XCircle className="h-6 w-6 text-destructive/70" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-base group-hover:text-primary transition-colors">
                          {step.title}
                        </h3>
                        {step.required && (
                          <Badge variant="outline" className="text-xs">Required</Badge>
                        )}
                        {step.completed && (
                          <Badge variant="default" className="text-xs bg-green-500">Complete</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
                  </div>
                </button>
                {index < onboarding.steps.length - 1 && <Separator className="my-2" />}
              </div>
            ))}
          </CardContent>
        </Card>

        {onboarding.allRequiredComplete && (
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10 mb-2">
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Ready to Start Selling!</h3>
                  <p className="text-muted-foreground mb-4">
                    You've completed all required steps. Click below to activate your seller account.
                  </p>
                </div>
                <Button size="lg" onClick={handleFinishSetup} className="w-full md:w-auto">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Finish Seller Setup
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="text-center text-sm text-muted-foreground">
              <p>
                Need help? Optional steps can be completed later from your{' '}
                <button
                  onClick={() => navigate('/settings')}
                  className="text-primary hover:underline font-medium"
                >
                  settings page
                </button>
                .
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
}
