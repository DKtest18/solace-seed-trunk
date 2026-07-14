import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertTriangle, Check, X } from 'lucide-react';
import { formatMoney } from '@/lib/money';

export type LicenseTier = 'personal' | 'commercial' | 'agency' | 'exclusive';

const TIER_META: Record<LicenseTier, { label: string; summary: string; warn?: boolean }> = {
  personal: {
    label: 'Personal',
    summary: 'Use in your own business, one deployment. No resale.',
  },
  commercial: {
    label: 'Commercial',
    summary: 'Use across your own business, multiple internal deployments. No resale, no white-label.',
  },
  agency: {
    label: 'Agency / White-Label',
    summary: 'Deploy and rebrand for YOUR own clients (off-platform). Relisting on any marketplace is forbidden.',
  },
  exclusive: {
    label: 'Exclusive Buyout',
    summary: 'Full rights transfer. Removes this product from the marketplace forever.',
    warn: true,
  },
};

const CAPABILITIES: Array<{ label: string; personal: boolean; commercial: boolean; agency: boolean; exclusive: boolean }> = [
  { label: 'Personal / internal use',           personal: true,  commercial: true,  agency: true,  exclusive: true },
  { label: 'Multiple internal deployments',     personal: false, commercial: true,  agency: true,  exclusive: true },
  { label: 'Deploy for your own clients',       personal: false, commercial: false, agency: true,  exclusive: true },
  { label: 'Rebrand / white-label',             personal: false, commercial: false, agency: true,  exclusive: true },
  { label: 'Modify & create derivatives',       personal: false, commercial: false, agency: true,  exclusive: true },
  { label: 'Full ownership / IP transfer',      personal: false, commercial: false, agency: false, exclusive: true },
  { label: 'Relist / resell on any marketplace', personal: false, commercial: false, agency: false, exclusive: false },
];

interface Props {
  product: any;
  value: LicenseTier;
  onChange: (t: LicenseTier) => void;
}

export function LicenseSelector({ product, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const currency = product?.currency;

  const tiers = useMemo(() => {
    const t: Array<{ tier: LicenseTier; price: number }> = [];
    // Personal always enabled; fall back to base price
    const personalPrice = Number(product.license_personal_price ?? product.price) || 0;
    t.push({ tier: 'personal', price: personalPrice });
    if (product.license_commercial_enabled && product.license_commercial_price)
      t.push({ tier: 'commercial', price: Number(product.license_commercial_price) });
    if (product.license_agency_enabled && product.license_agency_price)
      t.push({ tier: 'agency', price: Number(product.license_agency_price) });
    if (product.license_exclusive_enabled && product.license_exclusive_price)
      t.push({ tier: 'exclusive', price: Number(product.license_exclusive_price) });
    return t;
  }, [product]);

  if (tiers.length <= 1) return null;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Choose a license</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="link" size="sm" className="h-auto p-0 text-xs">Compare licenses</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Compare licenses</DialogTitle></DialogHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-2">Right</th>
                    {tiers.map((t) => (
                      <th key={t.tier} className="text-center py-2 px-2">{TIER_META[t.tier].label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CAPABILITIES.map((row) => (
                    <tr key={row.label} className="border-b last:border-0">
                      <td className="py-2 pr-2">{row.label}</td>
                      {tiers.map((t) => (
                        <td key={t.tier} className="text-center py-2 px-2">
                          {(row as any)[t.tier]
                            ? <Check className="w-4 h-4 mx-auto text-primary" />
                            : <X className="w-4 h-4 mx-auto text-muted-foreground/40" />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Full terms:{' '}
              <a href="/legal/licenses" target="_blank" className="underline">License Terms</a>.
            </p>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {tiers.map((t) => {
          const meta = TIER_META[t.tier];
          const active = value === t.tier;
          return (
            <button
              key={t.tier}
              type="button"
              onClick={() => onChange(t.tier)}
              className={`w-full text-left border rounded-lg p-3 transition ${
                active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
              } ${meta.warn && active ? 'border-destructive bg-destructive/5' : ''}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-4 h-4 rounded-full border-2 ${
                      active ? 'border-primary' : 'border-muted-foreground/40'
                    } flex items-center justify-center`}
                  >
                    {active && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{meta.label}</div>
                    <div className="text-xs text-muted-foreground">{meta.summary}</div>
                  </div>
                </div>
                <div className="font-semibold whitespace-nowrap">
                  {formatMoney(t.price, currency)}
                </div>
              </div>
              {meta.warn && active && (
                <div className="mt-2 flex items-start gap-2 text-xs text-destructive">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>Removes this product from the marketplace forever once purchased.</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Resale on DK AI Marketplace is never permitted, regardless of tier.
      </p>
    </Card>
  );
}
