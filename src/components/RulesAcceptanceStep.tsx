import { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { db } from '@/lib/dkaiDb';
import { useQuery } from '@tanstack/react-query';

interface RulesAcceptanceStepProps {
  ruleType: 'user' | 'seller' | 'meeting' | 'community';
  onAccept: () => void;
  onBack?: () => void;
  loading?: boolean;
}

export function RulesAcceptanceStep({ ruleType, onAccept, onBack, loading = false }: RulesAcceptanceStepProps) {
  const [accepted, setAccepted] = useState(false);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const { data: rulesData, isLoading } = useQuery({
    queryKey: ['platform-rules', ruleType],
    queryFn: async () => {
      const { data, error } = await db
        .from('dkai_platform_rules')
        .select('*')
        .eq('rule_type', ruleType)
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Prefer markdown `body` column, fall back to legacy `rules` text[] joined as a numbered list
  const body: string =
    (rulesData?.body && String(rulesData.body).trim()) ||
    (Array.isArray(rulesData?.rules)
      ? (rulesData!.rules as string[]).map((r, i) => `${i + 1}. ${r}`).join('\n\n')
      : '');

  const titleMap: Record<string, string> = {
    user: 'Platform Usage Rules',
    seller: 'Seller Obligations & Compliance',
    meeting: 'Meeting-Richtlinien',
    community: 'Community-Richtlinien',
  };
  const title = rulesData?.title || titleMap[ruleType] || 'Rules';
  const effectiveDate = rulesData?.updated_at || rulesData?.created_at || new Date().toISOString();

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) setScrolledToEnd(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          {title}
        </CardTitle>
        <CardDescription className="text-xs">
          {ruleType === 'user' && 'Read and accept all platform rules to continue.'}
          {ruleType === 'seller' && 'Read and accept all seller obligations to publish products.'}
          {ruleType === 'meeting' && 'Lesen und akzeptieren Sie die Meeting-Richtlinien, um teilnehmen zu können.'}
          {ruleType === 'community' && 'Lesen und akzeptieren Sie die Community-Richtlinien, um Beiträge zu verfassen.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="bg-muted/30 rounded-lg border">
          <ScrollArea className="h-[360px]">
            <div
              ref={viewportRef}
              onScroll={handleScroll}
              className="h-[360px] overflow-y-auto p-5"
            >
              <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:leading-relaxed prose-li:my-0.5">
                {body ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
                ) : (
                  <p className="text-muted-foreground italic">No rules content available.</p>
                )}
              </article>
              <p className="text-[10px] text-muted-foreground italic pt-4 mt-4 border-t">
                Version {rulesData?.version || 1} • Effective {new Date(effectiveDate).toLocaleDateString()}
              </p>
            </div>
          </ScrollArea>
        </div>

        <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
          <Checkbox
            id="accept-rules"
            checked={accepted}
            onCheckedChange={(checked) => setAccepted(checked === true)}
            className="mt-0.5"
          />
          <label htmlFor="accept-rules" className="text-sm font-medium cursor-pointer">
            I have read, understood, and agree to all {ruleType === 'user' ? 'platform' : ruleType === 'seller' ? 'seller' : ruleType === 'meeting' ? 'meeting' : 'community'} rules.
          </label>
        </div>
        {!scrolledToEnd && body && (
          <p className="text-[11px] text-muted-foreground text-center">Scroll to the end of the rules to enable the Accept button.</p>
        )}
      </CardContent>
      <CardFooter className="flex gap-2 pt-0">
        {onBack && (
          <Button variant="outline" onClick={onBack} className="flex-1">
            Back
          </Button>
        )}
        <Button
          onClick={onAccept}
          disabled={!accepted || !scrolledToEnd || loading}
          className="flex-1"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Accept & Continue
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
