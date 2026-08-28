import { Card, CardContent } from '@/components/ui/card';
import { useSellerRestrictions } from '@/hooks/useSellerRestrictions';
import { HourglassLoader } from '@/components/HourglassLoader';

/**
 * Removes payout/Stripe-Connect routes for sellers whose profile has
 * payment_settings_restricted = true. The DB trigger rejects writes to
 * dkai_seller_payment_configs anyway — the UI must never invite the action.
 */
export function PayoutRouteGuard({ children }: { children: React.ReactNode }) {
  const { data: restrictions, isLoading } = useSellerRestrictions();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <HourglassLoader size="lg" label />
      </div>
    );
  }

  if (restrictions?.paymentSettingsRestricted) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Payouts are not yet active for your account.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
