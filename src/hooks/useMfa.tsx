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
    // Always re-derive on mount / refresh / focus — a stale "no challenge"
    // answer would silently bypass 2FA.
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: 1,
    queryFn: async () => {
      // listFactors() calls GET /user, so this is the authoritative,
      // network-fresh factor list (the cached session.user may not carry
      // `factors` at all, which is what made getAuthenticatorAssuranceLevel()
      // report nextLevel = aal1 and skip the challenge).
      const { data: factorData, error: factorError } = await supabase.auth.mfa.listFactors();
      if (factorError) throw factorError;

      const verified = (factorData?.totp ?? []).filter((f: any) => f.status === 'verified');

      // Current assurance level comes from the JWT `aal` claim — the only
      // value the server actually honours.
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('No active session while checking two-factor status.');

      let currentLevel: string | null = null;
      try {
        const payload = JSON.parse(
          atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
        );
        currentLevel = payload?.aal ?? null;
      } catch {
        // Unreadable token => unknown assurance level => fail closed below.
        currentLevel = null;
      }

      const nextLevel = verified.length > 0 ? 'aal2' : currentLevel;

      return {
        factors: verified.map((f: any) => ({ id: f.id, friendly_name: f.friendly_name })),
        hasVerifiedFactor: verified.length > 0,
        currentLevel,
        nextLevel,
        // Account has 2FA and this session is not aal2 (including when the aal
        // claim could not be read) => challenge required.
        challengeRequired: verified.length > 0 && currentLevel !== 'aal2',
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
