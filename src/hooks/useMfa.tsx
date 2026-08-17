import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface MfaStatus {
  /** Verified TOTP factors on the account. */
  factors: { id: string; friendly_name?: string | null }[];
  hasVerifiedFactor: boolean;
  currentLevel: string | null;
  nextLevel: string | null;
  /** True when the account has MFA and the session has NOT completed the challenge. */
  challengeRequired: boolean;
}

/**
 * Reads the account's TOTP factors and the session's Authenticator Assurance Level
 * straight from Supabase Auth (native MFA). No custom secret handling.
 */
export function useMfaStatus() {
  const { user } = useAuth();

  return useQuery<MfaStatus>({
    queryKey: ['mfa-status', user?.id],
    enabled: !!user,
    staleTime: 10_000,
    retry: 1,
    queryFn: async () => {
      const { data: factorData, error: factorError } = await supabase.auth.mfa.listFactors();
      if (factorError) throw factorError;

      const verified = (factorData?.totp ?? []).filter((f: any) => f.status === 'verified');

      const { data: aal, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) throw aalError;

      const currentLevel = aal?.currentLevel ?? null;
      const nextLevel = aal?.nextLevel ?? null;

      return {
        factors: verified.map((f: any) => ({ id: f.id, friendly_name: f.friendly_name })),
        hasVerifiedFactor: verified.length > 0,
        currentLevel,
        nextLevel,
        challengeRequired:
          verified.length > 0 && nextLevel === 'aal2' && currentLevel !== 'aal2',
      };
    },
  });
}

export function useInvalidateMfaStatus() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['mfa-status', user?.id] });
  };
}
