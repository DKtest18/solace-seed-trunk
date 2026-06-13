import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/dkaiDb';

const DEFAULT_FEE = 5;

/**
 * Returns the platform fee percentage that applies to the current seller.
 * Reads `dkai_profiles.platform_fee_percent` (default 5%). Falls back to 5
 * while loading or on error so the UI never shows a stale hardcoded value.
 */
export function usePlatformFee() {
  const { user } = useAuth();
  const [feePct, setFeePct] = useState<number>(DEFAULT_FEE);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await db
          .from('dkai_profiles')
          .select('platform_fee_percent')
          .eq('id', user.id)
          .maybeSingle();
        if (!cancelled && data?.platform_fee_percent != null) {
          setFeePct(Number(data.platform_fee_percent));
        }
      } catch {
        // keep default
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const sellerPct = Math.max(0, 100 - feePct);
  return { feePct, sellerPct, loading };
}
