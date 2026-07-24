import { useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Info, Upload, Loader2, X } from 'lucide-react';
import { usePlatformFee } from '@/hooks/usePlatformFee';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface AdditionalDetailsStepProps {
  data: {
    product_version: string;
    access_details: string;
    estimated_delivery: string;
    production_cost: string;
    available_quantity: string;
    video_url: string;
    sample_preview_url?: string;
    sample_preview_type?: string;
    sample_output_text?: string;
    sample_is_watermarked?: boolean;
    // adaptive inputs (read-only from parent)
    pricing_model?: string;
    delivery_mode?: string;
    license_commercial_enabled?: boolean;
    license_agency_enabled?: boolean;
    license_exclusive_enabled?: boolean;
    // adaptive fields
    subscription_period_deliverables?: string;
    subscription_cancellation_note?: string;
    max_active_subscribers?: string;
    license_personal_description?: string;
    license_commercial_description?: string;
    license_agency_description?: string;
    license_exclusive_description?: string;
    exclusive_source_files_description?: string;
  };
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
}

const SAMPLE_BUCKET = 'product-samples';
const MAX_SAMPLE_BYTES = 25 * 1024 * 1024;
const ACCEPTED_SAMPLE = 'image/*,video/*,application/pdf';

const DEFAULT_CANCEL_NOTE =
  'Cancel anytime via Stripe; access ends at the end of the paid period.';

export function AdditionalDetailsStep({ data, onChange, errors }: AdditionalDetailsStepProps) {
  const { feePct, sellerPct } = usePlatformFee();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const isSubscription = data.pricing_model === 'recurring';
  const isManual = data.delivery_mode === 'manual';

  const detectType = (mime: string) =>
    mime.startsWith('video/') ? 'video' : mime === 'application/pdf' ? 'pdf' : 'image';

  const handleSampleUpload = async (file: File) => {
    if (!user) return toast.error('Sign in required');
    if (file.size > MAX_SAMPLE_BYTES) return toast.error('Sample must be under 25 MB');
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(SAMPLE_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data: pub } = supabase.storage.from(SAMPLE_BUCKET).getPublicUrl(path);
      onChange('sample_preview_url', pub.publicUrl);
      onChange('sample_preview_type', detectType(file.type));
      toast.success('Sample uploaded');
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const clearSample = () => { onChange('sample_preview_url', ''); onChange('sample_preview_type', ''); };
  const sampleType = data.sample_preview_type ||
    (data.sample_preview_url?.match(/\.(mp4|webm|mov)$/i) ? 'video'
      : data.sample_preview_url?.match(/\.pdf$/i) ? 'pdf' : 'image');

  // Ensure cancellation note default when subscription
  if (isSubscription && (data.subscription_cancellation_note ?? '') === '') {
    // fire-and-forget default (no infinite loop because value stays)
    queueMicrotask(() => onChange('subscription_cancellation_note', DEFAULT_CANCEL_NOTE));
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Additional Details</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Fields below adapt to the choices you made in earlier steps.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="product_version">Version Number</Label>
          <Input id="product_version" placeholder="e.g., 1.0.0" value={data.product_version}
            onChange={(e) => onChange('product_version', e.target.value)} />
        </div>

        {/* Estimated delivery only for one-time + manual */}
        {!isSubscription && isManual && (
          <div className="space-y-2">
            <Label htmlFor="estimated_delivery">Estimated Delivery *</Label>
            <Input id="estimated_delivery" placeholder="e.g., within 24 hours" value={data.estimated_delivery}
              onChange={(e) => onChange('estimated_delivery', e.target.value)} />
            <p className="text-xs text-muted-foreground">Shown to buyers; must match your delivery window from step 8.</p>
          </div>
        )}
      </div>

      {/* Subscription-only fields */}
      {isSubscription && (
        <div className="space-y-4 border rounded-lg p-4 bg-primary/5">
          <h4 className="text-sm font-semibold">Subscription details</h4>
          <div className="space-y-2">
            <Label htmlFor="sub_period">What the buyer receives each billing period *</Label>
            <Textarea id="sub_period" rows={3}
              placeholder="e.g., New prompt pack every month, unlimited API access, weekly workflow updates…"
              value={data.subscription_period_deliverables ?? ''}
              onChange={(e) => onChange('subscription_period_deliverables', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sub_cancel">Cancellation note (editable)</Label>
            <Textarea id="sub_cancel" rows={2}
              value={data.subscription_cancellation_note ?? DEFAULT_CANCEL_NOTE}
              onChange={(e) => onChange('subscription_cancellation_note', e.target.value)} />
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="production_cost">Production Cost (optional)</Label>
          <Input id="production_cost" type="number" step="0.01" placeholder="0.00"
            value={data.production_cost} onChange={(e) => onChange('production_cost', e.target.value)} />
          <p className="text-xs text-muted-foreground">For your records only</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="available_quantity">
            {isSubscription ? 'Max active subscribers (optional)' : 'Available Quantity'}
          </Label>
          <Input id="available_quantity" type="number"
            placeholder={isSubscription ? 'Leave empty for unlimited' : 'Leave empty for unlimited'}
            value={data.available_quantity} onChange={(e) => onChange('available_quantity', e.target.value)} />
          <p className="text-xs text-muted-foreground">
            {isSubscription
              ? 'When reached, new sign-ups are blocked. Existing subscribers keep access.'
              : 'When reached, listing shows "Sold out".'}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="video_url">Product Video URL (optional)</Label>
        <Input id="video_url" type="url" placeholder="https://youtube.com/watch?v=..."
          value={data.video_url} onChange={(e) => onChange('video_url', e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="access_details">Access Details</Label>
        <Textarea id="access_details"
          placeholder="How will buyers access the product? (download link, API keys, login credentials, etc.)"
          value={data.access_details} onChange={(e) => onChange('access_details', e.target.value)} rows={3} />
      </div>

      {/* Per-tier inclusions — only if that tier is enabled */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">What's included per license tier (shown on product page)</h4>

        <div className="space-y-1">
          <Label className="text-xs">Personal (always included)</Label>
          <Textarea rows={2} placeholder="e.g., 1 seat, personal or single-company use."
            value={data.license_personal_description ?? ''}
            onChange={(e) => onChange('license_personal_description', e.target.value)} />
        </div>

        {data.license_commercial_enabled && (
          <div className="space-y-1">
            <Label className="text-xs">Commercial</Label>
            <Textarea rows={2} placeholder="e.g., Deploy across your organization, unlimited internal use."
              value={data.license_commercial_description ?? ''}
              onChange={(e) => onChange('license_commercial_description', e.target.value)} />
          </div>
        )}

        {data.license_agency_enabled && (
          <div className="space-y-1">
            <Label className="text-xs">Agency / White-Label</Label>
            <Textarea rows={2} placeholder="e.g., Rebrand and deploy for your own clients, up to N client installs."
              value={data.license_agency_description ?? ''}
              onChange={(e) => onChange('license_agency_description', e.target.value)} />
          </div>
        )}

        {data.license_exclusive_enabled && (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Exclusive Buyout</Label>
              <Textarea rows={2} placeholder="e.g., Full IP transfer, all future updates included, source and assets."
                value={data.license_exclusive_description ?? ''}
                onChange={(e) => onChange('license_exclusive_description', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Source files description *</Label>
              <Textarea rows={3}
                placeholder="Exactly what the exclusive buyer receives: source repo, design files, docs, credentials handover, etc."
                value={data.exclusive_source_files_description ?? ''}
                onChange={(e) => onChange('exclusive_source_files_description', e.target.value)} />
              {errors.exclusiveSourceFilesError && (
                <p className="text-xs text-destructive">{errors.exclusiveSourceFilesError}</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Per-product refund field removed — read-only info instead */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          <strong>Refund policy is platform-wide.</strong> You do not set a per-product refund policy.
          See the Return Policy step for the exact rules that apply uniformly to every listing.
        </AlertDescription>
      </Alert>

      <div className="space-y-3 border rounded-lg p-4 bg-blue-50/40">
        <div>
          <h4 className="font-semibold text-sm">Public sample / preview (optional)</h4>
          <p className="text-xs text-muted-foreground">Show buyers a small preview before they purchase.</p>
        </div>
        <div className="space-y-2">
          <Label>Preview file (image, short video, or PDF)</Label>
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept={ACCEPTED_SAMPLE} className="hidden"
              onChange={(e) => e.target.files?.[0] && handleSampleUpload(e.target.files[0])} />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Upload sample
            </Button>
            {data.sample_preview_url && (
              <Button type="button" variant="ghost" size="sm" onClick={clearSample}>
                <X className="h-4 w-4 mr-1" /> Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Up to 25 MB. Stored publicly so unsigned buyers can view it.</p>
          {data.sample_preview_url && (
            <div className="mt-2 rounded-md border bg-background p-2">
              {sampleType === 'video' ? (
                <video src={data.sample_preview_url} controls className="max-h-48 w-full rounded" />
              ) : sampleType === 'pdf' ? (
                <a href={data.sample_preview_url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">View PDF sample</a>
              ) : (
                <img src={data.sample_preview_url} alt="Sample preview" className="max-h-48 rounded object-contain" />
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="sample_preview_url">…or paste a preview URL</Label>
          <Input id="sample_preview_url" type="url" placeholder="https://..."
            value={data.sample_preview_url ?? ''}
            onChange={(e) => { onChange('sample_preview_url', e.target.value); onChange('sample_preview_type', ''); }} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sample_output_text">Sample output / excerpt</Label>
          <Textarea id="sample_output_text" placeholder="Paste a short sample of what your product produces..."
            value={data.sample_output_text ?? ''} onChange={(e) => onChange('sample_output_text', e.target.value)}
            rows={3} maxLength={1000} />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="sample_is_watermarked" checked={!!data.sample_is_watermarked}
            onCheckedChange={(v) => onChange('sample_is_watermarked', v)} />
          <Label htmlFor="sample_is_watermarked" className="text-sm">Preview is watermarked / safe to share publicly</Label>
        </div>
      </div>

      <Alert className="border-primary/30 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-xs">
          <strong>Reminder:</strong> Payments are processed by Stripe. Platform fee: {feePct}% (0% during launch promo), {sellerPct}% is yours.
          Refunds only via DK AI Marketplace support review. Support: <strong>support@dkaimarketplace.com</strong>
        </AlertDescription>
      </Alert>
    </div>
  );
}
