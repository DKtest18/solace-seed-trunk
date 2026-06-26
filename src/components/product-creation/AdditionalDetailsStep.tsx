import { useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { AlertCircle, Info, Upload, Loader2, X } from 'lucide-react';
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
    refund_policy: string;
    video_url: string;
    sample_preview_url?: string;
    sample_preview_type?: string;
    sample_output_text?: string;
    sample_is_watermarked?: boolean;
  };
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
}

const SAMPLE_BUCKET = 'product-samples';
const MAX_SAMPLE_BYTES = 25 * 1024 * 1024; // 25 MB
const ACCEPTED_SAMPLE = 'image/*,video/*,application/pdf';

export function AdditionalDetailsStep({ data, onChange, errors }: AdditionalDetailsStepProps) {
  const { feePct, sellerPct } = usePlatformFee();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const detectType = (mime: string) =>
    mime.startsWith('video/') ? 'video' : mime === 'application/pdf' ? 'pdf' : 'image';

  const handleSampleUpload = async (file: File) => {
    if (!user) return toast.error('Sign in required');
    if (file.size > MAX_SAMPLE_BYTES) return toast.error('Sample must be under 25 MB');
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from(SAMPLE_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
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

  const clearSample = () => {
    onChange('sample_preview_url', '');
    onChange('sample_preview_type', '');
  };

  const sampleType =
    data.sample_preview_type ||
    (data.sample_preview_url?.match(/\.(mp4|webm|mov)$/i)
      ? 'video'
      : data.sample_preview_url?.match(/\.pdf$/i)
        ? 'pdf'
        : 'image');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Additional Details</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Optional information to help buyers make informed decisions
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="product_version">Version Number</Label>
          <Input
            id="product_version"
            placeholder="e.g., 1.0.0"
            value={data.product_version}
            onChange={(e) => onChange('product_version', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="estimated_delivery">Estimated Delivery</Label>
          <Input
            id="estimated_delivery"
            placeholder="e.g., Instant, 24 hours, 3-5 days"
            value={data.estimated_delivery}
            onChange={(e) => onChange('estimated_delivery', e.target.value)}
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="production_cost">Production Cost (optional)</Label>
          <Input
            id="production_cost"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={data.production_cost}
            onChange={(e) => onChange('production_cost', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">For your records only</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="available_quantity">Available Quantity</Label>
          <Input
            id="available_quantity"
            type="number"
            placeholder="Leave empty for unlimited"
            value={data.available_quantity}
            onChange={(e) => onChange('available_quantity', e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="video_url">Product Video URL (optional)</Label>
        <Input
          id="video_url"
          type="url"
          placeholder="https://youtube.com/watch?v=..."
          value={data.video_url}
          onChange={(e) => onChange('video_url', e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Add a 1-3 minute video showcasing your product
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="access_details">Access Details</Label>
        <Textarea
          id="access_details"
          placeholder="How will buyers access the product? (download link, API keys, login credentials, etc.)"
          value={data.access_details}
          onChange={(e) => onChange('access_details', e.target.value)}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="refund_policy">Refund Policy (optional)</Label>
        <Textarea
          id="refund_policy"
          placeholder="Describe your refund policy (e.g., 30-day money-back guarantee, no refunds, etc.)"
          value={data.refund_policy}
          onChange={(e) => onChange('refund_policy', e.target.value)}
          rows={3}
        />
      </div>

      <div className="space-y-3 border rounded-lg p-4 bg-blue-50/40">
        <div>
          <h4 className="font-semibold text-sm">Public sample / preview (optional)</h4>
          <p className="text-xs text-muted-foreground">Show buyers a small preview before they purchase — image, screenshot, or sample output text. Builds trust and lifts conversion.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sample_preview_url">Preview image URL</Label>
          <Input
            id="sample_preview_url"
            type="url"
            placeholder="https://..."
            value={data.sample_preview_url ?? ''}
            onChange={(e) => onChange('sample_preview_url', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sample_output_text">Sample output / excerpt</Label>
          <Textarea
            id="sample_output_text"
            placeholder="Paste a short sample of what your product produces..."
            value={data.sample_output_text ?? ''}
            onChange={(e) => onChange('sample_output_text', e.target.value)}
            rows={3}
            maxLength={1000}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="sample_is_watermarked"
            checked={!!data.sample_is_watermarked}
            onCheckedChange={(v) => onChange('sample_is_watermarked', v)}
          />
          <Label htmlFor="sample_is_watermarked" className="text-sm">Preview is watermarked / safe to share publicly</Label>
        </div>
      </div>

      <Alert className="border-primary/30 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-xs">
          <strong>Reminder:</strong> All payments are held on Stripe until the buyer confirms receipt and the return window expires. {sellerPct}% goes to your Stripe account, {feePct}% platform fee. 
          For support: <strong>support@dkaimarketplace.com</strong>
        </AlertDescription>
      </Alert>
    </div>
  );
}
