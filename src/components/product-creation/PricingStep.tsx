import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { validatePrice } from '@/utils/productValidation';

interface PricingStepProps {
  data: {
    price: string;
    pricing_model: string;
    currency?: string;
    billing_interval?: string;
    billing_interval_count?: number;
    license_commercial_enabled?: boolean;
    license_commercial_price?: string;
    license_agency_enabled?: boolean;
    license_agency_price?: string;
    license_exclusive_enabled?: boolean;
    license_exclusive_price?: string;
  };
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
}

// Stripe recurring interval_count limits per unit.
// https://stripe.com/docs/api/prices/create — Prices limits.
const INTERVAL_LIMITS: Record<string, number> = { day: 365, week: 52, month: 12, year: 1 };

const PRESETS: Array<{ label: string; interval: 'day' | 'week' | 'month' | 'year'; count: number }> = [
  { label: 'Daily', interval: 'day', count: 1 },
  { label: 'Weekly', interval: 'week', count: 1 },
  { label: 'Monthly', interval: 'month', count: 1 },
  { label: 'Yearly', interval: 'year', count: 1 },
];

export function PricingStep({ data, onChange, errors }: PricingStepProps) {
  const handlePriceBlur = () => {
    const price = parseFloat(data.price);
    if (isNaN(price)) return onChange('priceError', 'Please enter a valid price');
    const validation = validatePrice(price);
    onChange('priceError', validation.isValid ? '' : validation.error || '');
  };

  const isRecurring = data.pricing_model === 'recurring';
  const interval = (data.billing_interval || 'month') as 'day' | 'week' | 'month' | 'year';
  const count = Math.max(1, Number(data.billing_interval_count ?? 1));
  const maxCount = INTERVAL_LIMITS[interval] ?? 12;
  const countError = isRecurring && (count < 1 || count > maxCount)
    ? `For ${interval}s Stripe allows 1 to ${maxCount}.`
    : '';

  const basePrice = parseFloat(data.price) || 0;
  const currency = (data.currency || 'usd').toUpperCase();
  const suggest = (mult: number) => (basePrice > 0 ? (basePrice * mult).toFixed(2) : '');

  const applyPreset = (p: typeof PRESETS[number]) => {
    onChange('billing_interval', p.interval);
    onChange('billing_interval_count', p.count);
  };

  const TierRow = ({
    enabledKey, priceKey, label, suggestion, summary, warn,
  }: { enabledKey: string; priceKey: string; label: string; suggestion: string; summary: string; warn?: boolean }) => {
    const enabled = !!(data as any)[enabledKey];
    return (
      <div className={`border rounded-lg p-4 ${warn && enabled ? 'border-destructive/50 bg-destructive/5' : ''}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <Switch checked={enabled} onCheckedChange={(v) => onChange(enabledKey, v)} />
              <Label className="text-base font-semibold">{label}</Label>
            </div>
            <p className="text-sm text-muted-foreground mt-2 ml-11">{summary}</p>
          </div>
          {enabled && (
            <div className="w-40 space-y-1">
              <Label className="text-xs">Price ({currency})</Label>
              <Input type="number" min="0" step="0.01" placeholder={suggestion || '0.00'}
                value={(data as any)[priceKey] ?? ''} onChange={(e) => onChange(priceKey, e.target.value)} />
              {suggestion && <p className="text-[11px] text-muted-foreground">Suggested: {suggestion}</p>}
            </div>
          )}
        </div>
        {warn && enabled && (
          <p className="text-xs text-destructive mt-3 ml-11">
            Exclusive Buyout removes this product from the marketplace forever once purchased.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-2">
          <Label htmlFor="price">Personal license price *</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{currency}</span>
            <Input id="price" type="number" placeholder="99.00" value={data.price}
              onChange={(e) => onChange('price', e.target.value)} onBlur={handlePriceBlur}
              className={`pl-14 ${errors.priceError ? 'border-destructive' : ''}`} min="0" step="0.01" />
          </div>
          {errors.priceError && <p className="text-sm text-destructive">{errors.priceError}</p>}
          <p className="text-xs text-muted-foreground">
            Personal license is required — buyer's own business, one deployment. No resale.
          </p>
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
          <div>
            <Label className="mb-2 block">Billing cadence *</Label>
            <div className="flex flex-wrap gap-2 mb-4">
              {PRESETS.map((p) => {
                const active = p.interval === interval && p.count === count;
                return (
                  <Button key={p.label} type="button" size="sm"
                    variant={active ? 'default' : 'outline'} onClick={() => applyPreset(p)}>
                    {p.label}
                  </Button>
                );
              })}
              <span className="text-xs text-muted-foreground self-center ml-1">
                Presets prefill — you can always edit the numbers below.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Every</Label>
                <Input
                  type="number"
                  min={1}
                  max={maxCount}
                  value={count}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') { onChange('billing_interval_count', 1); return; }
                    const n = parseInt(raw, 10);
                    if (Number.isFinite(n)) onChange('billing_interval_count', Math.max(1, n));
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unit</Label>
                <Select value={interval} onValueChange={(v) => {
                  onChange('billing_interval', v);
                  // clamp count to the new unit's max if needed
                  const lim = INTERVAL_LIMITS[v] ?? 12;
                  if (count > lim) onChange('billing_interval_count', lim);
                }}>
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
            <p className="text-xs text-muted-foreground mt-2">
              Preview: <strong>{currency} {basePrice ? basePrice.toFixed(2) : '0.00'}</strong> billed{' '}
              {count === 1 ? `per ${interval}` : `every ${count} ${interval}s`}.
            </p>
            {countError && <p className="text-xs text-destructive mt-1">{countError}</p>}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Additional Licenses (optional)</h3>
          <p className="text-sm text-muted-foreground">
            Offer higher tiers to unlock more usage rights. Resale on DK AI Marketplace is never permitted, regardless of tier.
            See the <a href="/legal/licenses" target="_blank" className="underline">License Terms</a>.
          </p>
        </div>

        <TierRow enabledKey="license_commercial_enabled" priceKey="license_commercial_price" label="Commercial"
          suggestion={suggest(2.5)}
          summary="Use across the buyer's own business, multiple internal deployments. No resale, no white-label. Suggested: 2–3× base." />
        <TierRow enabledKey="license_agency_enabled" priceKey="license_agency_price" label="Agency / White-Label"
          suggestion={suggest(10)}
          summary="Deploy and rebrand for the buyer's OWN clients (off-platform). Relisting or reselling on any marketplace is forbidden. Suggested: 5–20× base." />
        <TierRow enabledKey="license_exclusive_enabled" priceKey="license_exclusive_price" label="Exclusive Buyout"
          suggestion={suggest(10)}
          summary="Full rights transfer. Product is permanently removed from the marketplace once sold. Suggested: 6–15× base." warn />
      </div>

      <div className="bg-muted p-4 rounded-lg">
        <h4 className="font-medium mb-2">Payment Processing</h4>
        <p className="text-sm text-muted-foreground">
          You'll choose your preferred payment methods in the next step. All payments are processed securely via Stripe Connect.
        </p>
      </div>
    </div>
  );
}
