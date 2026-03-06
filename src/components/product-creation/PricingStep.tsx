import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { validatePrice } from '@/utils/productValidation';

interface PricingStepProps {
  data: {
    price: string;
    pricing_model: string;
  };
  onChange: (field: string, value: string) => void;
  errors: Record<string, string>;
}

export function PricingStep({ data, onChange, errors }: PricingStepProps) {
  const handlePriceBlur = () => {
    const price = parseFloat(data.price);
    if (isNaN(price)) {
      onChange('priceError', 'Please enter a valid price');
      return;
    }
    const validation = validatePrice(price);
    if (!validation.isValid && validation.error) {
      onChange('priceError', validation.error);
    } else {
      onChange('priceError', '');
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="price">Price (USD) *</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <Input
            id="price"
            type="number"
            placeholder="99.00"
            value={data.price}
            onChange={(e) => onChange('price', e.target.value)}
            onBlur={handlePriceBlur}
            className={`pl-7 ${errors.priceError ? 'border-destructive' : ''}`}
            min="0"
            step="0.01"
          />
        </div>
        {errors.priceError && (
          <p className="text-sm text-destructive">{errors.priceError}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="pricing_model">Pricing Model *</Label>
        <Select value={data.pricing_model} onValueChange={(value) => onChange('pricing_model', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select pricing model" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="one_time">One-time Purchase</SelectItem>
            <SelectItem value="monthly">Monthly Subscription</SelectItem>
            <SelectItem value="yearly">Yearly Subscription</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {data.pricing_model === 'one_time' && 'Customer pays once and owns the product forever'}
          {data.pricing_model === 'monthly' && 'Customer is billed every month'}
          {data.pricing_model === 'yearly' && 'Customer is billed annually'}
        </p>
      </div>

      <div className="bg-muted p-4 rounded-lg">
        <h4 className="font-medium mb-2">Payment Processing</h4>
        <p className="text-sm text-muted-foreground">
          You'll choose your preferred payment methods in the next step. All payments are processed securely.
        </p>
      </div>
    </div>
  );
}
