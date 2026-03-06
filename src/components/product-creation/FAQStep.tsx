import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, MoveUp, MoveDown } from 'lucide-react';

interface FAQ {
  question: string;
  answer: string;
}

interface FAQStepProps {
  data: {
    faqs: FAQ[];
  };
  onChange: (field: string, value: any) => void;
  errors?: Record<string, string>;
}

export function FAQStep({ data, onChange, errors }: FAQStepProps) {
  const [faqs, setFaqs] = useState<FAQ[]>(data.faqs || []);

  const addFAQ = () => {
    const newFaqs = [...faqs, { question: '', answer: '' }];
    setFaqs(newFaqs);
    onChange('faqs', newFaqs);
  };

  const removeFAQ = (index: number) => {
    const newFaqs = faqs.filter((_, i) => i !== index);
    setFaqs(newFaqs);
    onChange('faqs', newFaqs);
  };

  const updateFAQ = (index: number, field: 'question' | 'answer', value: string) => {
    const newFaqs = [...faqs];
    newFaqs[index][field] = value;
    setFaqs(newFaqs);
    onChange('faqs', newFaqs);
  };

  const moveFAQ = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === faqs.length - 1)
    ) {
      return;
    }

    const newFaqs = [...faqs];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newFaqs[index], newFaqs[targetIndex]] = [newFaqs[targetIndex], newFaqs[index]];
    setFaqs(newFaqs);
    onChange('faqs', newFaqs);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Frequently Asked Questions</h3>
        <p className="text-sm text-muted-foreground">
          Add questions and answers that customers commonly ask about your product
        </p>
      </div>

      <div className="space-y-4">
        {faqs.map((faq, index) => (
          <Card key={index}>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <Label className="font-semibold">FAQ #{index + 1}</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => moveFAQ(index, 'up')}
                    disabled={index === 0}
                  >
                    <MoveUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => moveFAQ(index, 'down')}
                    disabled={index === faqs.length - 1}
                  >
                    <MoveDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFAQ(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`question-${index}`}>
                  Question <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={`question-${index}`}
                  value={faq.question}
                  onChange={(e) => updateFAQ(index, 'question', e.target.value)}
                  placeholder="e.g., What is the refund policy?"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`answer-${index}`}>
                  Answer <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id={`answer-${index}`}
                  value={faq.answer}
                  onChange={(e) => updateFAQ(index, 'answer', e.target.value)}
                  placeholder="Provide a clear and helpful answer..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button type="button" onClick={addFAQ} variant="outline" className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Add FAQ
      </Button>

      {errors?.faqsError && (
        <p className="text-sm text-destructive">{errors.faqsError}</p>
      )}
    </div>
  );
}
