import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface PurposeAudienceStepProps {
  data: {
    purpose: string;
    target_audience: string;
    value_proposition: string;
    problem_solved: string;
  };
  onChange: (field: string, value: string) => void;
  errors: Record<string, string>;
}

export function PurposeAudienceStep({ data, onChange, errors }: PurposeAudienceStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Product Purpose & Value</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Help buyers understand why they need your product
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="purpose">What can this product be used for? *</Label>
        <Textarea
          id="purpose"
          placeholder="Describe the main use cases and applications..."
          value={data.purpose}
          onChange={(e) => onChange('purpose', e.target.value)}
          rows={3}
        />
        {errors.purposeError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errors.purposeError}</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="target_audience">Who is the target customer? *</Label>
        <Textarea
          id="target_audience"
          placeholder="Business owners, students, creators, developers, etc."
          value={data.target_audience}
          onChange={(e) => onChange('target_audience', e.target.value)}
          rows={2}
        />
        {errors.targetAudienceError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errors.targetAudienceError}</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="problem_solved">What problem does it solve? *</Label>
        <Textarea
          id="problem_solved"
          placeholder="Explain the pain points this product addresses..."
          value={data.problem_solved}
          onChange={(e) => onChange('problem_solved', e.target.value)}
          rows={3}
        />
        {errors.problemSolvedError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errors.problemSolvedError}</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="value_proposition">Why choose this over alternatives? *</Label>
        <Textarea
          id="value_proposition"
          placeholder="What makes your product unique and better than competitors..."
          value={data.value_proposition}
          onChange={(e) => onChange('value_proposition', e.target.value)}
          rows={3}
        />
        {errors.valuePropositionError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errors.valuePropositionError}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
