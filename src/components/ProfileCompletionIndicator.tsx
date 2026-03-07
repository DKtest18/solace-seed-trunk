import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { CheckCircle2, Circle } from 'lucide-react';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';

interface CompletionStatus {
  ageVerified: boolean;
  twoFactorEnabled: boolean;
  paymentMethodsSet: boolean;
  termsAccepted: boolean;
}

export function ProfileCompletionIndicator() {
  const { user } = useAuth();
  const [status, setStatus] = useState<CompletionStatus>({
    ageVerified: false,
    twoFactorEnabled: false,
    paymentMethodsSet: false,
    termsAccepted: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      if (!user) return;

      try {
        const { data: profileData, error: profileError } = await db
          .from('dkai_profiles')
          .select('is_age_verified, is_2fa_enabled, terms_accepted')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;

        const { data: sellerConfig } = await db
          .from('dkai_seller_payment_configs')
          .select('stripe_account_id, stripe_onboarding_status')
          .eq('seller_id', user.id)
          .single();

        const hasStripeConnected = sellerConfig?.stripe_account_id && 
                                    sellerConfig?.stripe_onboarding_status === 'connected';

        setStatus({
          ageVerified: profileData.is_age_verified || false,
          twoFactorEnabled: profileData.is_2fa_enabled || false,
          paymentMethodsSet: hasStripeConnected,
          termsAccepted: profileData.terms_accepted || false,
        });
      } catch (error) {
        console.error('Error fetching profile status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [user]);

  if (loading) return null;

  const completedItems = Object.values(status).filter(Boolean).length;
  const totalItems = Object.keys(status).length;
  const percentage = (completedItems / totalItems) * 100;

  const items = [
    { label: 'Age Verified', completed: status.ageVerified },
    { label: '2FA Enabled', completed: status.twoFactorEnabled },
    { label: 'Payment Methods Set', completed: status.paymentMethodsSet },
    { label: 'Terms Accepted', completed: status.termsAccepted },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Profile Completion
          <Badge variant={percentage === 100 ? 'default' : 'secondary'}>
            {Math.round(percentage)}%
          </Badge>
        </CardTitle>
        <CardDescription>
          Complete your profile to unlock all seller features
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={percentage} className="h-2" />
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              {item.completed ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
              <span className={item.completed ? 'text-foreground' : 'text-muted-foreground'}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
