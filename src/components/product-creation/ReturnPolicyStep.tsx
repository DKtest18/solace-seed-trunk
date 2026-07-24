import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ShieldCheck, Clock, Info, Mail } from 'lucide-react';

interface ReturnPolicyStepProps {
  data: {
    seller_ack_refund_policy?: boolean;
    seller_ack_subscription?: boolean;
    seller_ack_manual_delivery?: boolean;
    seller_ack_setup_credentials?: boolean;
    seller_ack_agency?: boolean;
    seller_ack_exclusive?: boolean;
    // adaptive inputs
    pricing_model?: string;
    delivery_mode?: string;
    setup_no_credentials?: boolean;
    license_agency_enabled?: boolean;
    license_exclusive_enabled?: boolean;
    setup_requirements?: any[];
  };
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
}

export function ReturnPolicyStep({ data, onChange, errors }: ReturnPolicyStepProps) {
  const isSubscription = data.pricing_model === 'recurring';
  const isManual = data.delivery_mode === 'manual';
  const isSetup = data.delivery_mode === 'setup';
  const hasSecretSpecs = isSetup && !data.setup_no_credentials && (data.setup_requirements?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Refund Policy & Commitments</h3>
        <p className="text-sm text-muted-foreground">
          The refund policy is platform-wide. The acknowledgements below adapt to the choices you made.
        </p>
      </div>

      <Alert className="border-primary/30 bg-primary/5">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm space-y-2">
          <p className="font-semibold text-primary">Buyers can request a refund ONLY for:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Product not delivered within the promised delivery time.</li>
            <li>Product materially not as described in the listing.</li>
          </ol>
        </AlertDescription>
      </Alert>

      <div className="grid md:grid-cols-2 gap-4">
        <Alert className="border-blue-500/30 bg-blue-500/5">
          <Mail className="h-4 w-4 text-blue-500" />
          <AlertDescription className="text-xs space-y-1">
            <p className="font-semibold text-blue-600">Support-reviewed process</p>
            <p>Every refund request is reviewed by support. You must respond within <strong>48 hours</strong> with evidence, or the case is decided in the buyer's favor.</p>
          </AlertDescription>
        </Alert>
        <Alert className="border-green-500/30 bg-green-500/5">
          <Clock className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-xs space-y-1">
            <p className="font-semibold text-green-600">If approved</p>
            <p>Full refund via Stripe from your Stripe balance, typically within <strong>24–72 hours</strong>. Requests must be filed within <strong>14 days</strong> of purchase.</p>
          </AlertDescription>
        </Alert>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Because Stripe Connect uses direct charges, a refund debits your Stripe balance directly.
        </AlertDescription>
      </Alert>

      {/* Dynamic acknowledgement checkboxes */}
      <div className="space-y-3">
        <AckRow id="ack-refund" checked={!!data.seller_ack_refund_policy} onChange={(v) => onChange('seller_ack_refund_policy', v)}
          text="I understand and accept the DK AI Marketplace refund policy: support review only, 48h response window, refunds debited from my Stripe balance." />

        {isSubscription && (
          <AckRow id="ack-sub" checked={!!data.seller_ack_subscription} onChange={(v) => onChange('seller_ack_subscription', v)}
            text="I understand buyers can cancel anytime via Stripe and disputes on renewals follow the platform refund policy." />
        )}

        {(isManual || isSetup) && (
          <AckRow id="ack-manual" checked={!!data.seller_ack_manual_delivery} onChange={(v) => onChange('seller_ack_manual_delivery', v)}
            text={`I commit to ${isSetup ? 'completing setup' : 'delivering'} within my chosen window; non-delivery is a valid refund reason.`} />
        )}

        {hasSecretSpecs && (
          <AckRow id="ack-setup-creds" checked={!!data.seller_ack_setup_credentials} onChange={(v) => onChange('seller_ack_setup_credentials', v)}
            text="I will only use buyer credentials for this setup, only during the granted access period, and never store them elsewhere." />
        )}

        {data.license_agency_enabled && (
          <AckRow id="ack-agency" checked={!!data.seller_ack_agency} onChange={(v) => onChange('seller_ack_agency', v)}
            text="I understand Agency buyers may deploy and rebrand for their own clients but may not relist the product on any marketplace." />
        )}

        {data.license_exclusive_enabled && (
          <AckRow id="ack-exclusive" checked={!!data.seller_ack_exclusive} onChange={(v) => onChange('seller_ack_exclusive', v)}
            text="I understand an exclusive sale permanently delists this product and I may never sell it again anywhere." />
        )}
      </div>

      {errors.returnPolicyError && (
        <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{errors.returnPolicyError}</AlertDescription></Alert>
      )}
    </div>
  );
}

function AckRow({ id, checked, onChange, text }: { id: string; checked: boolean; onChange: (v: boolean) => void; text: string }) {
  return (
    <div className="flex items-start space-x-2 p-4 border rounded-lg bg-muted/30">
      <Checkbox id={id} checked={checked} onCheckedChange={(c) => onChange(c === true)} />
      <Label htmlFor={id} className="text-sm cursor-pointer leading-relaxed">{text}</Label>
    </div>
  );
}
