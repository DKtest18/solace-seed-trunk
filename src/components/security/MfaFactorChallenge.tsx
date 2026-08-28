import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useSmsCooldown } from '@/hooks/useSmsCooldown';
import {
  maskPhone,
  rawErrorMessage,
  smsErrorKey,
  type MfaFactor,
} from '@/lib/mfaFactors';
import { Loader2, Smartphone, KeyRound } from 'lucide-react';

interface Props {
  /** Verified factors on the account, from listFactors(). */
  factors: MfaFactor[];
  /** Called after `mfa.verify` succeeded and the session is aal2. */
  onVerified: () => void | Promise<void>;
  /** Wrong-code handler so callers keep their own attempt counters/lockouts. */
  onFailure?: (message: string) => void;
  disabled?: boolean;
}

/**
 * Factor chooser + code entry shared by the login page and the MFA gate.
 *
 * SECURITY: factor ids come only from `listFactors()`; the code is verified via
 * `supabase.auth.mfa.challenge()` + `verify()`, and the resulting aal2 session
 * is what gates anything protected. Nothing here is trusted client state.
 */
export function MfaFactorChallenge({ factors, onVerified, onFailure, disabled }: Props) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedFactors = useMemo(
    // TOTP stays the default: it is listed and preselected first.
    () => [...factors].sort((a, b) => (a.factorType === b.factorType ? 0 : a.factorType === 'totp' ? -1 : 1)),
    [factors],
  );

  // Single factor => go straight to it, no chooser.
  useEffect(() => {
    if (!selectedId && sortedFactors.length === 1) setSelectedId(sortedFactors[0].id);
  }, [selectedId, sortedFactors]);

  const selected = sortedFactors.find((f) => f.id === selectedId) ?? null;
  const cooldown = useSmsCooldown(`challenge_${selected?.id ?? 'none'}`);

  const sendSms = async (factorId: string) => {
    setBusy(true);
    setError(null);
    try {
      const { data, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;
      setChallengeId(data.id);
      cooldown.registerSend();
    } catch (e: any) {
      setError(`${t(`mfa.smsErrors.${smsErrorKey(e)}`)} (${rawErrorMessage(e)})`);
    } finally {
      setBusy(false);
    }
  };

  const chooseFactor = async (factor: MfaFactor) => {
    setSelectedId(factor.id);
    setCode('');
    setChallengeId(null);
    setError(null);
    if (factor.factorType === 'phone') await sendSms(factor.id);
  };

  const verify = async () => {
    if (!selected || code.length !== 6) {
      setError(t('mfa.errors.codeLength'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let cid = challengeId;
      if (!cid) {
        const { data, error: challengeError } = await supabase.auth.mfa.challenge({
          factorId: selected.id,
        });
        if (challengeError) throw challengeError;
        cid = data.id;
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: selected.id,
        challengeId: cid,
        code,
      });
      if (verifyError) {
        setCode('');
        setChallengeId(null);
        if (onFailure) onFailure(verifyError.message);
        else setError(verifyError.message);
        return;
      }
      setCode('');
      await onVerified();
    } catch (e: any) {
      setError(rawErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // --- Chooser (more than one verified factor, none picked yet) -------------
  if (!selected) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t('mfa.challenge.chooseMethod')}</p>
        {sortedFactors.map((f) => (
          <Button
            key={f.id}
            type="button"
            variant="outline"
            className="w-full justify-start"
            disabled={disabled || busy}
            onClick={() => chooseFactor(f)}
          >
            {f.factorType === 'phone' ? (
              <Smartphone className="h-4 w-4 mr-2" />
            ) : (
              <KeyRound className="h-4 w-4 mr-2" />
            )}
            {f.factorType === 'phone'
              ? t('mfa.challenge.useSms', { phone: maskPhone(f.phone) })
              : t('mfa.challenge.useTotp')}
          </Button>
        ))}
        {error && (
          <Alert variant="destructive">
            <AlertDescription className="break-words">{error}</AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  const isSms = selected.factorType === 'phone';

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="break-words">{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label>{isSms ? t('mfa.challenge.smsCodeLabel') : t('mfa.challenge.totpCodeLabel')}</Label>
        <p className="text-xs text-muted-foreground">
          {isSms
            ? t('mfa.challenge.smsHint', { phone: maskPhone(selected.phone) })
            : t('mfa.challenge.totpHint')}
        </p>
        <InputOTP maxLength={6} value={code} onChange={setCode} disabled={disabled || busy}>
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>

      <Button className="w-full" onClick={verify} disabled={disabled || busy || code.length !== 6}>
        {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        {t('mfa.challenge.verify')}
      </Button>

      {isSms && (
        <div className="space-y-1">
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={disabled || busy || !cooldown.canSend}
            onClick={() => sendSms(selected.id)}
          >
            {cooldown.secondsLeft > 0
              ? t('mfa.sms.resendIn', { seconds: cooldown.secondsLeft })
              : t('mfa.sms.resend')}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            {cooldown.capReached
              ? t('mfa.sms.capReached', { max: cooldown.maxSends })
              : t('mfa.sms.remainingSends', { count: cooldown.remainingSends })}
          </p>
        </div>
      )}

      {sortedFactors.length > 1 && (
        <button
          type="button"
          className="w-full text-sm text-primary hover:underline"
          onClick={() => {
            setSelectedId(null);
            setCode('');
            setChallengeId(null);
            setError(null);
          }}
        >
          {t('mfa.challenge.otherMethod')}
        </button>
      )}
    </div>
  );
}
