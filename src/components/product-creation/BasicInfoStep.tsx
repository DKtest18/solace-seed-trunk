import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { validateProductTitle, validateProductDescription } from '@/utils/productValidation';
import { AIAssistantButton } from '@/components/AIAssistantButton';

interface BasicInfoStepProps {
  data: {
    title: string;
    description: string;
    product_type: string;
    demo_url: string;
  };
  onChange: (field: string, value: string) => void;
  errors: Record<string, string>;
}

export function BasicInfoStep({ data, onChange, errors }: BasicInfoStepProps) {
  const handleTitleBlur = () => {
    const validation = validateProductTitle(data.title);
    if (!validation.isValid && validation.error) {
      onChange('titleError', validation.error);
    } else {
      onChange('titleError', '');
    }
  };

  const handleDescriptionBlur = () => {
    const validation = validateProductDescription(data.description);
    if (!validation.isValid && validation.error) {
      onChange('descriptionError', validation.error);
    } else {
      onChange('descriptionError', '');
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Product Title *</Label>
        <Input
          id="title"
          placeholder="e.g., AI Email Assistant, Cold Calling Agent"
          value={data.title}
          onChange={(e) => onChange('title', e.target.value)}
          onBlur={handleTitleBlur}
          maxLength={100}
          className={errors.titleError ? 'border-destructive' : ''}
        />
        {errors.titleError && (
          <p className="text-sm text-destructive">{errors.titleError}</p>
        )}
        <p className="text-sm text-muted-foreground">{data.title.length}/100 characters</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="product_type">Product Type *</Label>
        <Select value={data.product_type} onValueChange={(value) => onChange('product_type', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select product type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="agent">AI Agent</SelectItem>
            <SelectItem value="software">Software</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="description">Description *</Label>
          <AIAssistantButton
            type="product_description"
            context={{
              title: data.title,
              type: data.product_type,
              purpose: data.demo_url,
            }}
            onGenerated={(content) => onChange('description', content)}
          />
        </div>
        <Textarea
          id="description"
          placeholder="Describe what your product does, its key benefits, and who it's for..."
          value={data.description}
          onChange={(e) => onChange('description', e.target.value)}
          onBlur={handleDescriptionBlur}
          rows={6}
          maxLength={2000}
          className={errors.descriptionError ? 'border-destructive' : ''}
        />
        {errors.descriptionError && (
          <p className="text-sm text-destructive">{errors.descriptionError}</p>
        )}
        <p className="text-sm text-muted-foreground">{data.description.length}/2000 characters</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="demo_url">Demo URL (Optional)</Label>
        <Input
          id="demo_url"
          type="url"
          placeholder="https://example.com/demo"
          value={data.demo_url}
          onChange={(e) => onChange('demo_url', e.target.value)}
        />
        <p className="text-sm text-muted-foreground">Link to a demo video or live demo</p>
      </div>
    </div>
  );
}
