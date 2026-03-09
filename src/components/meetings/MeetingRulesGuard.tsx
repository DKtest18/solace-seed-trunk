import { useRulesAcceptance } from '@/hooks/useRulesAcceptance';
import { RulesAcceptanceStep } from '@/components/RulesAcceptanceStep';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MeetingRulesGuardProps {
  children: React.ReactNode;
}

export function MeetingRulesGuard({ children }: MeetingRulesGuardProps) {
  const { meetingRulesAccepted, loadingMeetingRules, acceptRules, isAccepting } = useRulesAcceptance();
  const { toast } = useToast();

  if (loadingMeetingRules) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!meetingRulesAccepted) {
    return (
      <div className="container mx-auto max-w-lg py-8 px-4">
        <RulesAcceptanceStep
          ruleType="meeting"
          onAccept={async () => {
            try {
              await acceptRules({ ruleType: 'meeting' });
              toast({ title: 'Meeting-Regeln akzeptiert', description: 'Sie können jetzt an Meetings teilnehmen.' });
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
