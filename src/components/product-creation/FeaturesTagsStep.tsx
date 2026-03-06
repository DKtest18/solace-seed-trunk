import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { validateFeatures, validateTags } from '@/utils/productValidation';

interface FeaturesTagsStepProps {
  data: {
    features: string[];
    tags: string[];
  };
  onChange: (field: string, value: string[] | string) => void;
  errors: Record<string, string>;
}

export function FeaturesTagsStep({ data, onChange, errors }: FeaturesTagsStepProps) {
  const [featureInput, setFeatureInput] = useState('');
  const [tagInput, setTagInput] = useState('');

  const addFeature = () => {
    if (!featureInput.trim()) return;
    if (data.features.length >= 10) {
      alert('Maximum 10 features allowed');
      return;
    }
    onChange('features', [...data.features, featureInput.trim()]);
    setFeatureInput('');
    
    const validation = validateFeatures([...data.features, featureInput.trim()]);
    if (!validation.isValid && validation.error) {
      onChange('featuresError', validation.error);
    } else {
      onChange('featuresError', '');
    }
  };

  const removeFeature = (index: number) => {
    const newFeatures = data.features.filter((_, i) => i !== index);
    onChange('features', newFeatures);
    
    const validation = validateFeatures(newFeatures);
    if (!validation.isValid && validation.error) {
      onChange('featuresError', validation.error);
    } else {
      onChange('featuresError', '');
    }
  };

  const addTag = () => {
    if (!tagInput.trim()) return;
    if (data.tags.length >= 10) {
      alert('Maximum 10 tags allowed');
      return;
    }
    if (data.tags.includes(tagInput.trim().toLowerCase())) {
      alert('Tag already added');
      return;
    }
    onChange('tags', [...data.tags, tagInput.trim().toLowerCase()]);
    setTagInput('');
    
    const validation = validateTags([...data.tags, tagInput.trim().toLowerCase()]);
    if (!validation.isValid && validation.error) {
      onChange('tagsError', validation.error);
    } else {
      onChange('tagsError', '');
    }
  };

  const removeTag = (index: number) => {
    const newTags = data.tags.filter((_, i) => i !== index);
    onChange('tags', newTags);
    
    const validation = validateTags(newTags);
    if (!validation.isValid && validation.error) {
      onChange('tagsError', validation.error);
    } else {
      onChange('tagsError', '');
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Features *</Label>
          <p className="text-sm text-muted-foreground">
            List the key features and capabilities of your product (up to 10)
          </p>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="e.g., 24/7 automated responses"
            value={featureInput}
            onChange={(e) => setFeatureInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
            maxLength={100}
          />
          <Button type="button" onClick={addFeature} size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {data.features.length > 0 && (
          <div className="space-y-2">
            {data.features.map((feature, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <span className="text-sm">{feature}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFeature(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {errors.featuresError && (
          <p className="text-sm text-destructive">{errors.featuresError}</p>
        )}
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Tags *</Label>
          <p className="text-sm text-muted-foreground">
            Add relevant tags to help users find your product (up to 10)
          </p>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="e.g., automation, ai, productivity"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
            maxLength={30}
          />
          <Button type="button" onClick={addTag} size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {data.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.tags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="gap-1">
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(index)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {errors.tagsError && (
          <p className="text-sm text-destructive">{errors.tagsError}</p>
        )}
      </div>
    </div>
  );
}
