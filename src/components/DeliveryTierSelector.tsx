import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Zap, Lock, HardDrive, AlertTriangle, Sparkles } from 'lucide-react';
import {
  computeRecommendation,
  isDownTier,
  tierLabel,
  type DeliveryTier,
  type DeliveryThresholds,
  DEFAULT_THRESHOLDS,
} from '@/lib/deliveryRecommendation';

interface Props {
  price: number;
  maxSales: number | null;
  fileSizeBytes: number;
  value: DeliveryTier;
  overrideAcknowledged: boolean;
  deliveryNote?: string;
  onChange: (next: {
    delivery_tier: DeliveryTier;
    delivery_tier_recommended: DeliveryTier;
    delivery_tier_overridden: boolean;
    override_acknowledged: boolean;
    delivery_method_note?: string;
  }) => void;
}

const TIER_META: Record<DeliveryTier, { icon: typeof Zap; title: string; desc: string }> = {
  tier1: {
    icon: Zap,
    title: 'Instant Delivery (hosted by us)',
    desc: 'File stored on our servers, delivered automatically the moment a buyer pays.',
  },
  tier2: {
    icon: Lock,
    title: 'Protected Delivery (encrypted, released on confirmation)',
    desc: 'Encrypted on our servers, unlocked for the buyer once payment is confirmed.',
  },
  tier3: {
    icon: HardDrive,
    title: 'Direct Seller Delivery (you keep the file, we hold the money)',
    desc: 'File never uploaded. Stripe holds the payment until you deliver and the buyer confirms.',
  },
};

export function DeliveryTierSelector({
  price,
  maxSales,
  fileSizeBytes,
  value,
  overrideAcknowledged,
  deliveryNote,
  onChange,
}: Props) {
  const { data: thresholds } = useQuery<DeliveryThresholds>({
    queryKey: ['delivery-thresholds'],
    queryFn: async () => {
      const { data, error } = await db
        .from('dkai_delivery_thresholds')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (error || !data) return DEFAULT_THRESHOLDS;
      return data as DeliveryThresholds;
    },
    staleTime: 1000 * 60 * 10,
  });

  const recommendation = useMemo(
    () =>
      computeRecommendation(
        { price, max_sales: maxSales, file_size_bytes: fileSizeBytes },
        thresholds ?? DEFAULT_THRESHOLDS
      ),
    [price, maxSales, fileSizeBytes, thresholds]
  );

  const recommended = recommendation.recommended;
  const downTiering = isDownTier(value, recommended);

  useEffect(() => {
    onChange({
      delivery_tier: value,
      delivery_tier_recommended: recommended,
      delivery_tier_overridden: value !== recommended,
      override_acknowledged: overrideAcknowledged,
      delivery_method_note: deliveryNote,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommended]);

  const selectTier = (t: DeliveryTier) => {
    onChange({
      delivery_tier: t,
      delivery_tier_recommended: recommended,
      delivery_tier_overridden: t !== recommended,
      override_acknowledged: false,
      delivery_method_note: deliveryNote,
    });
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-primary/5 border-primary/30">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              Recommended: {tierLabel(recommended)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">{recommendation.reason}</p>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {(['tier1', 'tier2', 'tier3'] as DeliveryTier[]).map((t) => {
          const meta = TIER_META[t];
          const Icon = meta.icon;
          const selected = value === t;
          const isRecommended = recommended === t;
          return (
            <button
              type="button"
              key={t}
              onClick={() => selectTier(t)}
              className={`w-full text-left rounded-lg border-2 p-4 transition-colors ${
                selected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40 bg-background'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 ${
                    selected ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                  }`}
                />
                <Icon className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{meta.title}</span>
                    {isRecommended && (
                      <Badge variant="default" className="text-[10px] h-5">
                        Recommended
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{meta.desc}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {downTiering && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Less protection than recommended</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              You're choosing less protection than we recommend for a product at this
              price/scarcity/size. For high-value products we strongly recommend Direct Seller
              Delivery so your file never leaves your hands. Are you sure?
            </p>
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox
                checked={overrideAcknowledged}
                onCheckedChange={(c) =>
                  onChange({
                    delivery_tier: value,
                    delivery_tier_recommended: recommended,
                    delivery_tier_overridden: true,
                    override_acknowledged: c === true,
                    delivery_method_note: deliveryNote,
                  })
                }
                className="mt-0.5"
              />
              <span className="text-sm">
                I understand and want to use {tierLabel(value)} anyway.
              </span>
            </label>
          </AlertDescription>
        </Alert>
      )}

      {value === 'tier3' && (
        <Card className="p-4 bg-muted/30">
          <p className="text-sm mb-3">
            With Direct Seller Delivery you do not upload your file here. After a buyer
            purchases, you'll be notified to deliver it directly, and you'll be paid once the
            buyer confirms receipt.
          </p>
          <Label htmlFor="delivery_method_note" className="text-sm font-medium">
            Delivery method note <span className="text-muted-foreground font-normal">(optional, shown to buyer after purchase)</span>
          </Label>
          <Textarea
            id="delivery_method_note"
            value={deliveryNote ?? ''}
            onChange={(e) =>
              onChange({
                delivery_tier: value,
                delivery_tier_recommended: recommended,
                delivery_tier_overridden: value !== recommended,
                override_acknowledged: overrideAcknowledged,
                delivery_method_note: e.target.value.slice(0, 1000),
              })
            }
            placeholder="e.g. I'll email a private download link from my server within 24 hours."
            rows={3}
            className="mt-2"
          />
        </Card>
      )}
    </div>
  );
}
