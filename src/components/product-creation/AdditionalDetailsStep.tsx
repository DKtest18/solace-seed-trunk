import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Info } from 'lucide-react';
import { usePlatformFee } from '@/hooks/usePlatformFee';

interface AdditionalDetailsStepProps {
  data: {
    product_version: string;
    access_details: string;
    estimated_delivery: string;
    production_cost: string;
    available_quantity: string;
    refund_policy: string;
    video_url: string;
  };
  onChange: (field: string, value: string) => void;
  errors: Record<string, string>;
}

export function AdditionalDetailsStep({ data, onChange, errors }: AdditionalDetailsStepProps) {
  const { feePct, sellerPct } = usePlatformFee();
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
