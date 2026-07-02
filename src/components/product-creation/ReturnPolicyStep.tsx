import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ShieldCheck, Clock, Info, Mail } from 'lucide-react';

interface ReturnPolicyStepProps {
  data: {
    seller_ack_refund_policy?: boolean;
    // Legacy fields still on the record; no longer edited from this step.
    return_allowed?: boolean;
    return_window_days?: number;
    return_fee_enabled?: boolean;
    return_fee_percentage?: number;
    return_conditions?: string;
  };
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
}

/**
 * PART 3 — Read-only, platform-wide refund policy.
 * The seller no longer configures return window, fee, or conditions per-product.
 * Refunds are ONLY granted through DK AI Marketplace support review, for two reasons:
 *   (1) product not delivered, (2) product materially not as described.
 * Full purchase price refunded via Stripe (debited from the seller's Stripe balance),
 * typically within 24–72 hours of approval. Requests are accepted within 14 days.
 */
export function ReturnPolicyStep({ data, onChange, errors }: ReturnPolicyStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Refund Policy (platform-wide)</h3>
        <p className="text-sm text-muted-foreground">
          The refund policy is set by DK AI Marketplace and applies uniformly to every product.
          You do not configure a return window, return fee, or return conditions per product.
        </p>
      </div>

      {/* The two allowed refund reasons */}
      <Alert className="border-primary/30 bg-primary/5">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm space-y-2">
          <p className="font-semibold text-primary">Buyers can request a refund ONLY for:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Product not delivered within the promised delivery time.</li>
            <li>Product materially not as described in the listing.</li>
          </ol>
          <p className="text-xs text-muted-foreground">
            There are no unconditional returns, no self-service instant refunds, and no seller-set return windows or return fees.
          </p>
        </AlertDescription>
      </Alert>

      {/* Review & 48h response window */}
      <div className="grid md:grid-cols-2 gap-4">
        <Alert className="border-blue-500/30 bg-blue-500/5">
          <Mail className="h-4 w-4 text-blue-500" />
          <AlertDescription className="text-xs space-y-1">
            <p className="font-semibold text-blue-600">Support-reviewed process</p>
            <p>Every refund request is reviewed by DK AI Marketplace support. You will be contacted and must respond within <strong>48 hours</strong> with evidence.</p>
            <p>If you do not respond by the deadline, the case is decided in the buyer&apos;s favor and your listings may be deactivated or your account suspended.</p>
          </AlertDescription>
        </Alert>

        <Alert className="border-green-500/30 bg-green-500/5">
          <Clock className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-xs space-y-1">
            <p className="font-semibold text-green-600">If approved</p>
            <p>The buyer receives a <strong>full refund</strong> of the purchase price to their original payment method, issued via Stripe from your Stripe balance, typically within <strong>24–72 hours</strong> of approval.</p>
            <p>Refund requests must be filed within <strong>14 days</strong> of purchase.</p>
          </AlertDescription>
        </Alert>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Because Stripe Connect uses direct charges, a refund debits your Stripe balance directly.
          Platform-issued refunds work even after you have already been paid and do not require your active cooperation.
          For any questions, contact <strong>support@dkaimarketplace.com</strong>.
        </AlertDescription>
      </Alert>

      {/* Acknowledgment */}
      <div className="flex items-start space-x-2 p-4 border rounded-lg bg-muted/30">
        <Checkbox
          id="ack-refund-policy"
          checked={!!data.seller_ack_refund_policy}
          onCheckedChange={(checked) => onChange('seller_ack_refund_policy', checked === true)}
        />
        <Label htmlFor="ack-refund-policy" className="text-sm font-medium cursor-pointer leading-relaxed">
          I understand and accept the DK AI Marketplace refund policy: refunds are only granted through support review for the two reasons above, I will respond to support inquiries about refund requests within 48 hours, and approved refunds are debited from my Stripe balance.
        </Label>
      </div>

      {errors.returnPolicyError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errors.returnPolicyError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
