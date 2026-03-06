import { useState } from 'react';
import { Button } from './ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AIAssistantButtonProps {
  type: 'product_description';
  context: {
    title: string;
    type: string;
    purpose?: string;
  };
  onGenerated: (content: string) => void;
}

export function AIAssistantButton({ type, context, onGenerated }: AIAssistantButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!context.title) {
      toast.error('Please enter a product title first');
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: { type, context },
      });

      if (error) throw error;

      if (data?.content) {
        onGenerated(data.content);
        toast.success('Description generated successfully!');
      }
    } catch (error: any) {
      console.error('Error generating content:', error);
      toast.error(error.message || 'Failed to generate content');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleGenerate}
      disabled={isGenerating}
      className="gap-2"
    >
      {isGenerating ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4" />
          Generate with AI
        </>
      )}
    </Button>
  );
}
