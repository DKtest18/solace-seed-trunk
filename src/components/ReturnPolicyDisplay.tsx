import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck, Clock, RefreshCcw } from 'lucide-react';

interface ReturnPolicyDisplayProps {
  // Product prop is kept for backwards compatibility, but the box is now
  // platform-wide: refund terms no longer depend on per-product settings.
  product?: unknown;
}

/**
 * PART 3 — Buyer-facing refund policy (platform-wide).
 * Refunds only via DK AI Marketplace support for (1) not delivered or
 * (2) materially not as described. Full refund via Stripe within 24–72h
 * of approval. Requests must be filed within 14 days of purchase.
 */
export function ReturnPolicyDisplay(_: ReturnPolicyDisplayProps) {
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Buyer Protection
        </div>

        <div className="grid gap-2 text-sm">
          <div className="flex items-start gap-2">
            <RefreshCcw className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <p>
              Refunds via DK AI Marketplace support for products <strong>not delivered</strong>{' '}
              or <strong>not as described</strong>.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <p>
              Full refund to your original payment method after approval, typically within{' '}
              <strong>24–72 hours</strong>. Requests must be filed within <strong>14 days</strong>{' '}
              of purchase.
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Reviewed by DK AI Marketplace support. Questions? support@dkaimarketplace.com
        </p>
      </CardContent>
    </Card>
  );
}
