import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck, Clock, RefreshCcw } from 'lucide-react';

interface ReturnPolicyDisplayProps {
  product: {
    return_allowed?: boolean | null;
    return_window_days?: number | null;
    return_fee_enabled?: boolean | null;
    return_fee_percentage?: number | null;
    return_conditions?: string | null;
  };
}

/**
 * Buyer-facing return / refund terms shown on the product page BEFORE purchase.
 * The mandatory 24h minimum is always shown; longer windows / fees only when set.
 */
export function ReturnPolicyDisplay({ product }: ReturnPolicyDisplayProps) {
  const allowed = !!product.return_allowed;
  const windowDays = Math.max(1, product.return_window_days ?? 1);
  const feeEnabled = !!product.return_fee_enabled;
  const feePct = product.return_fee_percentage ?? 0;
  const conditions = product.return_conditions?.trim();

  const windowLabel = allowed
    ? windowDays === 1
      ? '24 hours'
      : `${windowDays} days`
    : '24 hours (mandatory minimum)';

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Refund & Return Policy
        </div>

        <div className="grid gap-2 text-sm">
          <div className="flex items-start gap-2">
            <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div>
              <span className="font-medium">Return window: </span>
              {windowLabel}
            </div>
          </div>

          <div className="flex items-start gap-2">
            <RefreshCcw className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div>
              {feeEnabled && feePct > 0 ? (
                <>
                  <span className="font-medium">Refund: </span>
                  {100 - feePct}% back to your original payment method ({feePct}% return fee applies).
                </>
              ) : (
                <>
                  <span className="font-medium">Refund: </span>
                  100% back to your original payment method — no return fee.
                </>
              )}
            </div>
          </div>
        </div>

        {conditions && (
          <div className="text-xs text-muted-foreground border-t border-primary/10 pt-2">
            <span className="font-medium text-foreground">Conditions: </span>
            {conditions}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          By purchasing you agree to these terms. Refund requests must be filed inside the return window
          from your dashboard.
        </p>
      </CardContent>
    </Card>
  );
}
