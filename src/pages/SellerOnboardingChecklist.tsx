import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSellerOnboardingProgress } from '@/hooks/useSellerOnboardingProgress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, ChevronRight, Sparkles } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function SellerOnboardingChecklist() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: onboarding, isLoading } = useSellerOnboardingProgress();

  if (!user) {
    navigate('/login');
    return null;
  }

  const handleFinishSetup = async () => {
    if (!onboarding?.allRequiredComplete) {
      toast({
        title: 'Complete Required Steps',
        description: 'Please complete all required steps before finishing setup.',
        variant: 'destructive',
      });
      return;
    }

    // Add seller role if not already present
    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: user.id, role: 'seller' })
      .select()
      .single();

    if (error && !error.message.includes('duplicate')) {
      toast({
        title: 'Error',
        description: 'Failed to complete setup. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Success!',
      description: 'Your seller account is now active.',
    });

    navigate('/seller-dashboard');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!onboarding) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold">Become a Seller</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Complete the steps below to activate your seller account and start selling your products
          </p>
        </div>

        {/* Progress Card */}
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

        {/* Checklist */}
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
                    {/* Status Icon */}
                    <div className="flex-shrink-0 mt-1">
                      {step.completed ? (
                        <CheckCircle2 className="h-6 w-6 text-green-500" />
                      ) : (
                        <XCircle className="h-6 w-6 text-destructive/70" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-base group-hover:text-primary transition-colors">
                          {step.title}
                        </h3>
                        {step.required && (
                          <Badge variant="outline" className="text-xs">
                            Required
                          </Badge>
                        )}
                        {step.completed && (
                          <Badge variant="default" className="text-xs bg-green-500">
                            Complete
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {step.description}
                      </p>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
                  </div>
                </button>
                {index < onboarding.steps.length - 1 && <Separator className="my-2" />}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Finish Button */}
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

        {/* Help Card */}
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
  );
}
