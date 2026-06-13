import { useState } from 'react';
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

  const rules = rulesData?.rules as string[] || [];
  const titleMap: Record<string, string> = {
    user: 'Platform Usage Rules',
    seller: 'Seller Obligations & Compliance',
    meeting: 'Meeting-Richtlinien',
    community: 'Community-Richtlinien',
  };
  const title = rulesData?.title || titleMap[ruleType] || 'Rules';

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
        <div className="bg-muted/50 rounded-lg border">
          <ScrollArea className="h-[220px] p-3">
            <div className="space-y-2 pr-3">
              {rules.map((rule, index) => (
                <div key={index} className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-medium flex items-center justify-center">
                    {index + 1}
                  </span>
                  <p className="text-xs text-foreground leading-relaxed">{rule}</p>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground italic pt-2 border-t">
                Version {rulesData?.version || 1} • Effective {(rulesData?.updated_at || rulesData?.created_at) ? new Date(rulesData.updated_at || rulesData.created_at).toLocaleDateString() : new Date().toLocaleDateString()}
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
          <label 
            htmlFor="accept-rules" 
            className="text-sm font-medium cursor-pointer"
          >
            I have read, understood, and agree to all {ruleType === 'user' ? 'platform' : ruleType === 'seller' ? 'seller' : ruleType === 'meeting' ? 'meeting' : 'community'} rules.
          </label>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2 pt-0">
        {onBack && (
          <Button variant="outline" onClick={onBack} className="flex-1">
            Back
          </Button>
        )}
        <Button 
          onClick={onAccept} 
          disabled={!accepted || loading}
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
