import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Info, ShieldCheck, Clock, DollarSign } from 'lucide-react';
import { usePlatformFee } from '@/hooks/usePlatformFee';

interface ReturnPolicyStepProps {
  data: {
    return_allowed: boolean;
    return_window_days: number;
    return_fee_enabled: boolean;
    return_fee_percentage: number;
    return_conditions: string;
  };
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
}

const RETURN_WINDOW_OPTIONS = [
  { value: '1', label: '24 hours (minimum)' },
  { value: '3', label: '3 days' },
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days (maximum)' },
];

export function ReturnPolicyStep({ data, onChange, errors }: ReturnPolicyStepProps) {
  const { feePct, sellerPct } = usePlatformFee();
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Return Policy</h3>
        <p className="text-sm text-muted-foreground">
          Configure the return policy for your product. This information is visible to buyers before purchase.
        </p>
      </div>

      {/* Mandatory 24h notice */}
      <Alert className="border-primary/30 bg-primary/5">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          <strong>Mandatory minimum:</strong> All products have a minimum 24-hour return window. This protects buyers if the product is not as described. This cannot be changed.
          <br /><br />
          If you are confident your product matches the description exactly and wish to request an exemption from the 24h minimum, contact <strong>support@dkaimarketplace.com</strong> — we will review your product before approving.
        </AlertDescription>
      </Alert>

      {/* Extended return toggle */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="space-y-1">
          <Label htmlFor="return-toggle" className="font-medium">Offer extended return window</Label>
          <p className="text-sm text-muted-foreground">
            Allow buyers more time to return the product beyond the mandatory 24 hours
          </p>
        </div>
        <Switch
          id="return-toggle"
          checked={data.return_allowed}
          onCheckedChange={(checked) => onChange('return_allowed', checked)}
        />
      </div>

      {data.return_allowed && (
        <div className="space-y-4 pl-4 border-l-2 border-primary/20">
          {/* Return window */}
          <div className="space-y-2">
            <Label htmlFor="return-window" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Return Window
            </Label>
            <Select
              value={String(data.return_window_days)}
              onValueChange={(value) => onChange('return_window_days', parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select return window" />
              </SelectTrigger>
              <SelectContent>
                {RETURN_WINDOW_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Maximum return window is 3 months (90 days).
            </p>
          </div>

          {/* Return fee */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-1">
                <Label htmlFor="return-fee-toggle" className="font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Return Fee
                </Label>
                <p className="text-xs text-muted-foreground">
                  Optionally charge a return processing fee
                </p>
              </div>
              <Switch
                id="return-fee-toggle"
                checked={data.return_fee_enabled}
                onCheckedChange={(checked) => onChange('return_fee_enabled', checked)}
              />
            </div>

            {data.return_fee_enabled && (
              <div className="space-y-2">
                <Label htmlFor="return-fee-pct">Return Fee Percentage (%)</Label>
                <Input
                  id="return-fee-pct"
                  type="number"
                  min="1"
                  max="30"
                  step="1"
                  placeholder="e.g. 10"
                  value={data.return_fee_percentage || ''}
                  onChange={(e) => onChange('return_fee_percentage', parseInt(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">
                  Maximum 30%. The buyer will receive the remaining amount back via their original payment method.
                </p>
              </div>
            )}
          </div>

          {/* Return conditions */}
          <div className="space-y-2">
            <Label htmlFor="return-conditions">Return Conditions (optional)</Label>
            <Textarea
              id="return-conditions"
              placeholder="e.g. Product must not be redistributed. Refund only if setup issues are documented with screenshots."
              value={data.return_conditions}
              onChange={(e) => onChange('return_conditions', e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Additional conditions the buyer must meet to qualify for a return.
            </p>
          </div>
        </div>
      )}

      {errors.returnPolicyError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errors.returnPolicyError}</AlertDescription>
        </Alert>
      )}

      {/* What this means for seller & buyer */}
      <div className="grid md:grid-cols-2 gap-4">
        <Alert className="border-blue-500/30 bg-blue-500/5">
          <Info className="h-4 w-4 text-blue-500" />
          <AlertDescription className="text-xs space-y-1">
            <p className="font-semibold text-blue-600">What this means for YOU (Seller):</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>You will <strong>NOT receive any payment</strong> until the return window has fully expired.</li>
              <li>Even if you have costs, plan ahead — factor the return window into your pricing.</li>
              <li>After the return window expires: <strong>{sellerPct}% to your Stripe account</strong>, {feePct}% platform fee.</li>
              <li>If a buyer returns within the window, you receive nothing.</li>
              <li>You cannot reject a valid return within the return window.</li>
            </ul>
          </AlertDescription>
        </Alert>

        <Alert className="border-green-500/30 bg-green-500/5">
          <Info className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-xs space-y-1">
            <p className="font-semibold text-green-600">What the BUYER will see:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Return window: <strong>{data.return_allowed ? `${data.return_window_days} day(s)` : '24 hours (mandatory minimum)'}</strong></li>
              <li>{data.return_fee_enabled ? `Return fee: ${data.return_fee_percentage}%` : 'No return fee — full 100% refund'}</li>
              <li>Refund goes back to the <strong>exact payment method</strong> used.</li>
              <li>Buyer sees these terms <strong>before</strong> accepting and purchasing.</li>
              <li>{data.return_conditions ? 'Additional conditions apply' : 'No additional conditions'}</li>
            </ul>
          </AlertDescription>
        </Alert>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          For any questions or disputes, contact <strong>support@dkaimarketplace.com</strong>. 
          All terms are binding once the product is published. Both seller and buyer must agree to these conditions.
        </AlertDescription>
      </Alert>
    </div>
  );
}
