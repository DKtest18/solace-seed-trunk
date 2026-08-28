import { useEffect, useState } from 'react';
import { db } from '@/lib/dkaiDb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { DEFAULT_THRESHOLDS, type DeliveryThresholds } from '@/lib/deliveryRecommendation';
import { HourglassLoader } from '@/components/HourglassLoader';

const FIELDS: Array<{
  key: keyof DeliveryThresholds;
  label: string;
  unit: string;
  help: string;
}> = [
  { key: 'price_tier2_min', label: 'Price — Tier 2 minimum', unit: 'CHF', help: 'Above this price the product is at least Protected.' },
  { key: 'price_tier3_min', label: 'Price — Tier 3 minimum', unit: 'CHF', help: 'Above this price the product is recommended Direct.' },
  { key: 'sales_tier2_max', label: 'Sales — Tier 2 max', unit: 'sales', help: 'max_sales ≤ this triggers at least Tier 2.' },
  { key: 'sales_tier3_max', label: 'Sales — Tier 3 max', unit: 'sales', help: 'max_sales < this triggers Tier 3.' },
  { key: 'size_tier2_min', label: 'File size — Tier 2 minimum', unit: 'bytes', help: 'Larger than this triggers at least Tier 2.' },
  { key: 'size_tier3_min', label: 'File size — Tier 3 minimum', unit: 'bytes', help: 'Larger than this triggers Tier 3.' },
];

export default function AdminDeliveryThresholds() {
  const [values, setValues] = useState<DeliveryThresholds>(DEFAULT_THRESHOLDS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await db.from('dkai_delivery_thresholds').select('*').eq('id', 1).maybeSingle();
      if (data) setValues(data as DeliveryThresholds);
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await db
      .from('dkai_delivery_thresholds')
      .update(values)
      .eq('id', 1);
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Thresholds saved.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <HourglassLoader size={96} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-display font-semibold mb-2">Delivery Recommendation Thresholds</h1>
        <p className="text-muted-foreground mb-6">
          Tune the price, scarcity, and file-size cut-offs used to recommend a delivery tier.
          Sellers can still override the recommendation.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Thresholds</CardTitle>
            <CardDescription>Changes apply immediately to all new recommendations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={f.key}>{f.label}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={f.key}
                    type="number"
                    min={0}
                    value={values[f.key] as number}
                    onChange={(e) =>
                      setValues({ ...values, [f.key]: Number(e.target.value) || 0 })
                    }
                  />
                  <span className="text-sm text-muted-foreground w-16">{f.unit}</span>
                </div>
                <p className="text-xs text-muted-foreground">{f.help}</p>
              </div>
            ))}
            <div className="pt-4 flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save thresholds
              </Button>
              <Button variant="outline" onClick={() => setValues(DEFAULT_THRESHOLDS)} disabled={saving}>
                Reset to defaults
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
