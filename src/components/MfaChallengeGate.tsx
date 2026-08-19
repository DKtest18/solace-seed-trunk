import { ReactNode, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMfaStatus, useInvalidateMfaStatus } from '@/hooks/useMfa';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Loader2, ShieldAlert } from 'lucide-react';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

/**
 * Non-dismissable MFA challenge. Renders instead of the app whenever the account
 * has a verified TOTP factor and the current session is not yet at aal2 —
 * regardless of whether the session came from email+password or LinkedIn OAuth.
 */
export function MfaChallengeGate({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, signOut } = useAuth();
  const { data: mfa, isLoading, error: statusError, refetch } = useMfaStatus();
  const invalidateMfa = useInvalidateMfaStatus();

  const lockKey = user ? `dkai_mfa_lock_${user.id}` : 'dkai_mfa_lock';
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const stored = Number(localStorage.getItem(lockKey) ?? 0);
    if (stored > Date.now()) setLockedUntil(stored);
  }, [lockKey]);

  useEffect(() => {
    if (!lockedUntil) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lockedUntil]);

  const locked = !!lockedUntil && lockedUntil > now;

  // While the session is being restored we must not render protected content:
  // the MFA state is unknown at that point (fail closed).
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <>{children}</>;
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  // Fail closed: if we cannot determine the assurance level, do not render the app.
  const mustChallenge = statusError ? true : !!mfa?.challengeRequired;
  if (!mustChallenge) return <>{children}</>;


  const registerFailure = (message: string) => {
    const next = attempts + 1;
    setAttempts(next);
    if (next >= MAX_ATTEMPTS) {
      const until = Date.now() + LOCKOUT_MS;
      localStorage.setItem(lockKey, String(until));
      setLockedUntil(until);
      setError(`Too many failed attempts. Try again in 5 minutes.`);
    } else {
      setError(`${message} ${MAX_ATTEMPTS - next} attempt(s) remaining.`);
    }
    setCode('');
  };

  const verifyCode = async () => {
    if (code.length !== 6) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const factorId = mfa?.factors[0]?.id;
      if (!factorId) throw new Error('No authenticator factor found on this account.');

      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) {
        registerFailure(verifyError.message);
        return;
      }

      localStorage.removeItem(lockKey);
      setAttempts(0);
      invalidateMfa();
      await refetch();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const redeemRecovery = async () => {
    if (recovery.trim().length < 8) {
      setError('Enter one of your recovery codes.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'mfa-redeem-recovery-code',
        { body: { code: recovery.trim() } },
      );
      if (fnError) throw fnError;
      if (!data?.success) {
        registerFailure(data?.error ?? 'Invalid or already used recovery code.');
        return;
      }
      await supabase.auth.refreshSession();
      invalidateMfa();
      await refetch();
      setError(
        'Recovery code accepted. Two-factor authentication was reset — please set it up again in Settings → Security.',
      );
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            Two-factor authentication required
          </CardTitle>
          <CardDescription>
            Your account is protected with 2FA. Enter your current code to finish signing in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {statusError && (
            <Alert variant="destructive">
              <AlertDescription className="break-words">
                {(statusError as any)?.message ?? String(statusError)}
              </AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription className="break-words">{error}</AlertDescription>
            </Alert>
          )}

          {!useRecovery ? (
            <>
              <div className="space-y-2">
                <Label>Authentication code</Label>
                <InputOTP maxLength={6} value={code} onChange={setCode} disabled={locked}>
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button className="w-full" onClick={verifyCode} disabled={busy || locked}>
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {locked ? 'Locked — wait 5 minutes' : 'Verify'}
              </Button>
              <button
                type="button"
                className="w-full text-sm text-primary hover:underline"
                onClick={() => {
                  setUseRecovery(true);
                  setError(null);
                }}
              >
                Use a recovery code instead
              </button>
              <p className="text-xs text-muted-foreground text-center">
                If you don&apos;t have access to your authenticator app or your recovery codes
                anymore, write an email to{' '}
                <a href="mailto:support@dkaimarketplace.com" className="text-primary hover:underline">
                  support@dkaimarketplace.com
                </a>
                .
              </p>
            </>

          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="recovery-code">Recovery code</Label>
                <Input
                  id="recovery-code"
                  value={recovery}
                  onChange={(e) => setRecovery(e.target.value)}
                  placeholder="XXXX-XXXX"
                  disabled={locked}
                />
              </div>
              <Button className="w-full" onClick={redeemRecovery} disabled={busy || locked}>
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Use recovery code
              </Button>
              <button
                type="button"
                className="w-full text-sm text-primary hover:underline"
                onClick={() => {
                  setUseRecovery(false);
                  setError(null);
                }}
              >
                Back to authenticator code
              </button>
            </>
          )}

          <Button variant="ghost" className="w-full" onClick={() => signOut()}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
