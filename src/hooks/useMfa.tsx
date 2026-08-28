import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { collectVerifiedFactors, type MfaFactor } from '@/lib/mfaFactors';

export interface MfaStatus {
  /** Verified factors on the account (TOTP and/or phone/SMS). */
  factors: { id: string; friendly_name?: string | null }[];
  /** Same verified factors with their type and (for SMS) phone number. */
  verifiedFactors: MfaFactor[];
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
      // 1) Authoritative server check: a SECURITY DEFINER function that reads
      //    auth.mfa_factors for auth.uid(). This works even when the client
      //    factor list is empty/cached (the bug that let 2FA accounts skip the
      //    challenge, especially for accounts enrolled before this release).
      let serverHasVerified: boolean | null = null;
      let serverFactorIds: string[] = [];
      try {
        const { data: rpcData, error: rpcError } = await (supabase as any).rpc('dkai_my_mfa_state');
        if (!rpcError && rpcData) {
          const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
          if (row) {
            serverHasVerified = !!row.has_verified_factor;
            serverFactorIds = (row.factor_ids ?? []).map((x: any) => String(x));
          }
        }
      } catch {
        serverHasVerified = null;
      }

      // 2) Client factor list (GET /user).
      const { data: factorData, error: factorError } = await supabase.auth.mfa.listFactors();
      if (factorError && serverHasVerified === null) throw factorError;

      // Covers both TOTP and phone/SMS factors.
      const verified = collectVerifiedFactors(factorData);


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

      // The account has 2FA if EITHER source says so (server wins when the
      // client list is stale/empty).
      const hasVerifiedFactor = serverHasVerified === true || verified.length > 0;

      const factors = verified.length
        ? verified.map((f) => ({ id: f.id, friendly_name: f.friendlyName }))
        : serverFactorIds.map((id) => ({ id, friendly_name: null }));

      const nextLevel = hasVerifiedFactor ? 'aal2' : currentLevel;

      return {
        factors,
        verifiedFactors: verified,
        hasVerifiedFactor,
        currentLevel,
        nextLevel,
        // Account has 2FA and this session is not aal2 (including when the aal
        // claim could not be read) => challenge required.
        challengeRequired: hasVerifiedFactor && currentLevel !== 'aal2',
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
