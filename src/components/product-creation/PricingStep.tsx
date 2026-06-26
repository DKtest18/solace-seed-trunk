import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { validatePrice } from '@/utils/productValidation';

interface PricingStepProps {
  data: {
    price: string;
    pricing_model: string;
    currency?: string;
    billing_interval?: string;
    billing_interval_count?: number;
  };
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
}

const RECURRING_PRESETS = [
  { id: 'day-1', label: 'Daily', interval: 'day', count: 1 },
  { id: 'week-1', label: 'Weekly', interval: 'week', count: 1 },
  { id: 'month-1', label: 'Monthly', interval: 'month', count: 1 },
  { id: 'month-3', label: 'Every 3 months', interval: 'month', count: 3 },
  { id: 'month-6', label: 'Every 6 months', interval: 'month', count: 6 },
  { id: 'year-1', label: 'Yearly', interval: 'year', count: 1 },
  { id: 'custom', label: 'Custom interval…', interval: 'month', count: 1 },
];

export function PricingStep({ data, onChange, errors }: PricingStepProps) {
  const handlePriceBlur = () => {
    const price = parseFloat(data.price);
    if (isNaN(price)) return onChange('priceError', 'Please enter a valid price');
    const validation = validatePrice(price);
    onChange('priceError', validation.isValid ? '' : validation.error || '');
  };

  const isRecurring = data.pricing_model === 'recurring';
  const currentPresetId =
    RECURRING_PRESETS.find(
      (p) => p.id !== 'custom' && p.interval === data.billing_interval && p.count === (data.billing_interval_count ?? 1),
    )?.id ?? 'custom';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-2">
          <Label htmlFor="price">Price *</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {(data.currency || 'usd').toUpperCase()}
            </span>
            <Input
              id="price"
              type="number"
              placeholder="99.00"
              value={data.price}
              onChange={(e) => onChange('price', e.target.value)}
              onBlur={handlePriceBlur}
              className={`pl-14 ${errors.priceError ? 'border-destructive' : ''}`}
              min="0"
              step="0.01"
            />
          </div>
          {errors.priceError && <p className="text-sm text-destructive">{errors.priceError}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="currency">Currency *</Label>
          <Select value={data.currency || 'usd'} onValueChange={(v) => onChange('currency', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['usd', 'eur', 'gbp', 'cad', 'aud', 'chf', 'sek', 'nok', 'dkk', 'pln'].map((c) => (
                <SelectItem key={c} value={c}>{c.toUpperCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="pricing_model">Pricing Model *</Label>
        <Select value={data.pricing_model} onValueChange={(v) => onChange('pricing_model', v)}>
          <SelectTrigger><SelectValue placeholder="Select pricing model" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="one_time">One-time payment</SelectItem>
            <SelectItem value="recurring">Recurring subscription</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {data.pricing_model === 'one_time'
            ? 'Customer is charged once and keeps access forever.'
            : 'Customer is billed on a recurring schedule (Stripe Subscription).'}
        </p>
      </div>

      {isRecurring && (
        <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
          <div className="space-y-2">
            <Label>Billing schedule *</Label>
            <Select
              value={currentPresetId}
              onValueChange={(id) => {
                const preset = RECURRING_PRESETS.find((p) => p.id === id)!;
                onChange('billing_interval', preset.interval);
                onChange('billing_interval_count', preset.count);
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RECURRING_PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {currentPresetId === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Every</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={data.billing_interval_count ?? 1}
                  onChange={(e) => onChange('billing_interval_count', Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))}
                />
              </div>
              <div className="space-y-2">
                <Label>Interval</Label>
                <Select value={data.billing_interval || 'month'} onValueChange={(v) => onChange('billing_interval', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Day(s)</SelectItem>
                    <SelectItem value="week">Week(s)</SelectItem>
                    <SelectItem value="month">Month(s)</SelectItem>
                    <SelectItem value="year">Year(s)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            These settings map 1:1 to a Stripe Price object on your connected account.
          </p>
        </div>
      )}

      <div className="bg-muted p-4 rounded-lg">
        <h4 className="font-medium mb-2">Payment Processing</h4>
        <p className="text-sm text-muted-foreground">
          You'll choose your preferred payment methods in the next step. All payments are processed securely via Stripe Connect.
        </p>
      </div>
    </div>
  );
}
