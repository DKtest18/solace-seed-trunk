import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SMS_MAX_SENDS_PER_SESSION,
  SMS_RESEND_COOLDOWN_SECONDS,
} from '@/lib/mfaFactors';

/**
 * Client-side spend guard for SMS MFA codes: a visible countdown before a
 * resend is allowed, plus a hard cap per browser session. Every SMS costs real
 * money, so the button stays disabled until both checks pass.
 *
 * This is a UX/cost guard only — Supabase Auth still enforces its own server
 * side rate limits, which are the authoritative ones.
 */
export function useSmsCooldown(scope = 'default') {
  const storageKey = `dkai_mfa_sms_${scope}`;
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [sendCount, setSendCount] = useState(0);
  const timerRef = useRef<number | null>(null);

  // Restore an in-flight cooldown (survives a remount / page change).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { lastSentAt?: number; count?: number };
      setSendCount(parsed.count ?? 0);
      if (parsed.lastSentAt) {
        const elapsed = Math.floor((Date.now() - parsed.lastSentAt) / 1000);
        const remaining = SMS_RESEND_COOLDOWN_SECONDS - elapsed;
        if (remaining > 0) setSecondsLeft(remaining);
      }
    } catch {
      /* ignore malformed state */
    }
  }, [storageKey]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    timerRef.current = window.setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [secondsLeft]);

  /** Call right after a successful send. */
  const registerSend = useCallback(() => {
    setSecondsLeft(SMS_RESEND_COOLDOWN_SECONDS);
    setSendCount((c) => {
      const next = c + 1;
      try {
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({ lastSentAt: Date.now(), count: next }),
        );
      } catch {
        /* ignore quota errors */
      }
      return next;
    });
  }, [storageKey]);

  const capReached = sendCount >= SMS_MAX_SENDS_PER_SESSION;

  return {
    secondsLeft,
    sendCount,
    remainingSends: Math.max(0, SMS_MAX_SENDS_PER_SESSION - sendCount),
    maxSends: SMS_MAX_SENDS_PER_SESSION,
    cooldownSeconds: SMS_RESEND_COOLDOWN_SECONDS,
    capReached,
    canSend: secondsLeft <= 0 && !capReached,
    registerSend,
  };
}
