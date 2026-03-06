import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface OnlineStatusProps {
  userId: string;
  showText?: boolean;
}

export function OnlineStatus({ userId, showText = false }: OnlineStatusProps) {
  const { data: presence } = useQuery({
    queryKey: ['user-presence', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_presence')
        .select('online, last_seen')
        .eq('user_id', userId)
        .single();

      return data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const isOnline = presence?.online || false;

  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        "w-2 h-2 rounded-full",
        isOnline ? "bg-green-500" : "bg-muted-foreground"
      )} />
      {showText && (
        <span className="text-xs text-muted-foreground">
          {isOnline ? 'Online' : 'Offline'}
        </span>
      )}
    </div>
  );
}
