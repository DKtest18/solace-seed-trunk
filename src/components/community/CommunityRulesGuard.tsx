import { useRulesAcceptance } from '@/hooks/useRulesAcceptance';
import { RulesAcceptanceStep } from '@/components/RulesAcceptanceStep';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface CommunityRulesGuardProps {
  children: React.ReactNode;
}

export function CommunityRulesGuard({ children }: CommunityRulesGuardProps) {
  const { communityRulesAccepted, loadingCommunityRules, acceptRules, isAccepting } = useRulesAcceptance();
  const { toast } = useToast();

  if (loadingCommunityRules) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!communityRulesAccepted) {
    return (
      <div className="container mx-auto max-w-lg py-8 px-4">
        <RulesAcceptanceStep
          ruleType="community"
          onAccept={async () => {
            try {
              await acceptRules({ ruleType: 'community' });
              toast({ title: 'Community-Regeln akzeptiert', description: 'Sie können jetzt in der Community posten.' });
            } catch {
              toast({ title: 'Fehler', description: 'Regeln konnten nicht akzeptiert werden.', variant: 'destructive' });
            }
          }}
          loading={isAccepting}
        />
      </div>
    );
  }

  return <>{children}</>;
}
