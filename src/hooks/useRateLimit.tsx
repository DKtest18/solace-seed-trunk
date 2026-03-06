import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface RateLimitOptions {
  action: string;
  maxAttempts: number;
  windowMinutes: number;
}

export function useRateLimit() {
  const [checking, setChecking] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const checkRateLimit = useCallback(
    async ({ action, maxAttempts, windowMinutes }: RateLimitOptions): Promise<boolean> => {
      if (!user) return false;

      setChecking(true);
      try {
        const { data, error } = await supabase.rpc("check_rate_limit", {
          p_user_id: user.id,
          p_action: action,
          p_max: maxAttempts,
          p_minutes: windowMinutes,
        });

        if (error) throw error;

        if (!data) {
          toast({
            title: "Rate limit exceeded",
            description: `You can only perform this action ${maxAttempts} times per ${windowMinutes} minutes. Please try again later.`,
            variant: "destructive",
          });
          return false;
        }

        return true;
      } catch (error) {
        console.error("Rate limit check error:", error);
        return true; // Allow on error to prevent blocking users
      } finally {
        setChecking(false);
      }
    },
    [user, toast]
  );

  return { checkRateLimit, checking };
}