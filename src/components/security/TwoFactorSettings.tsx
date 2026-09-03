import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-qr-code';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useMfaStatus, useInvalidateMfaStatus } from '@/hooks/useMfa';
import { useSmsCooldown } from '@/hooks/useSmsCooldown';
import {
  maskPhone,
  rawErrorMessage,
  smsErrorKey,
  validateE164,
  type MfaFactor,
} from '@/lib/mfaFactors';
import {
  Shield,
  ShieldCheck,
  Copy,
  Download,
  Loader2,
  KeyRound,
  Smartphone,
  Trash2,
  Plus,
} from 'lucide-react';

type Stage = 'idle' | 'enrolling' | 'recovery' | 'sms-phone' | 'sms-code';

/**
 * SMS (phone factor) is temporarily disabled — only the authenticator app /
 * QR code flow is offered. Flip this to true to bring SMS back; all SMS code
 * paths below stay intact.
 */
const SMS_ENABLED = false;

/**
 * Two-factor authentication built on Supabase Auth's native MFA.
 *
 * TOTP is the default/recommended factor; SMS (factorType 'phone') is an
 * optional second factor type. Both go through
 * enroll -> challenge -> verify only — no custom secret handling, and the
 * session's aal2 state (see `public.dkai_mfa_satisfied()`) is the only gate.
 */
export function TwoFactorSettings() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { data: mfa, isLoading, refetch } = useMfaStatus();
  const invalidateMfa = useInvalidateMfaStatus();

  const [stage, setStage] = useState<Stage>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [savedConfirmed, setSavedConfirmed] = useState(false);
  const autoDownloadedRef = useRef(false);

  // SMS enrollment state
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [enrolledPhone, setEnrolledPhone] = useState<string | null>(null);
  const [smsChallengeId, setSmsChallengeId] = useState<string | null>(null);
  const smsCooldown = useSmsCooldown('enroll');

  // Factor removal
  const [pendingRemoval, setPendingRemoval] = useState<MfaFactor | null>(null);

  const factors: MfaFactor[] = mfa?.verifiedFactors ?? [];
  const hasTotp = factors.some((f) => f.factorType === 'totp');
  const hasPhone = factors.some((f) => f.factorType === 'phone');

  const downloadCodes = () => {
    const text = `DK AI Marketplace — 2FA recovery codes\n\n${recoveryCodes.join(
      '\n',
    )}\n\nEach code works exactly once.`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dkai-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Automatically download recovery codes the first time they are shown.
  useEffect(() => {
    if (stage === 'recovery' && recoveryCodes.length > 0 && !autoDownloadedRef.current) {
      autoDownloadedRef.current = true;
      downloadCodes();
    }
  }, [stage, recoveryCodes, downloadCodes]);

  /** Removes leftover *unverified* factors so enrollment never dead-ends. */
  const cleanupUnverified = async () => {
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const f of (existing as any)?.all ?? []) {
      if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
  };

  const startEnroll = async () => {
    setBusy(true);
    setError(null);
    try {
      await cleanupUnverified();

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `DK AI Marketplace ${new Date().toISOString().slice(0, 10)}`,
      });
      if (enrollError) throw enrollError;

      setFactorId(data.id);
      setQr((data as any).totp?.qr_code ?? null);
      setSecret((data as any).totp?.secret ?? null);
      setStage('enrolling');
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const activate = async () => {
    if (!factorId || code.length !== 6) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) throw verifyError;

      // Activation itself is complete at this point (native Supabase MFA).
      // Recovery codes are a best-effort extra: if the helper function is not
      // reachable, 2FA still stays enabled instead of dead-ending the user.
      let codes: string[] | null = null;
      try {
        const { data: rc, error: rcError } = await supabase.functions.invoke('mfa-recovery-codes', {
          body: { count: 8 },
        });
        if (!rcError && rc?.codes) codes = rc.codes as string[];
      } catch {
        codes = null;
      }

      setCode('');
      invalidateMfa();
      await refetch();

      if (codes) {
        setRecoveryCodes(codes);
        setSavedConfirmed(false);
        setStage('recovery');
        toast({ title: '2FA activated', description: 'Save your recovery codes now.' });
      } else {
        setStage('idle');
        setError(
          'Two-factor authentication is active, but recovery codes could not be generated right now. Use "Regenerate recovery codes" later, or contact support@dkaimarketplace.com.',
        );
        toast({ title: '2FA activated', description: 'Two-factor authentication is now on.' });
      }

    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  // --- SMS (phone factor) enrollment ---------------------------------------

  const startSmsEnroll = () => {
    setPhoneInput('');
    setPhoneError(null);
    setEnrolledPhone(null);
    setSmsChallengeId(null);
    setFactorId(null);
    setCode('');
    setError(null);
    setStage('sms-phone');
  };

  const sendSmsCode = async () => {
    const check = validateE164(phoneInput);
    if (!check.valid) {
      setPhoneError(t(`mfa.phoneErrors.${check.error}`));
      return;
    }
    setPhoneError(null);
    setBusy(true);
    setError(null);
    try {
      // Only unverified leftovers are cleaned up — verified TOTP stays intact.
      await cleanupUnverified();

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'phone',
        phone: check.value,
        friendlyName: `SMS ${check.value.slice(0, 4)}… ${new Date().toISOString().slice(0, 10)}`,
      } as any);
      if (enrollError) throw enrollError;

      const newFactorId = (data as any).id as string;
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: newFactorId,
      });
      if (challengeError) throw challengeError;

      setFactorId(newFactorId);
      setSmsChallengeId(challenge.id);
      // Read the number back from Supabase's response where available.
      setEnrolledPhone((data as any).phone ?? check.value);
      smsCooldown.registerSend();
      setStage('sms-code');
    } catch (e: any) {
      setError(`${t(`mfa.smsErrors.${smsErrorKey(e)}`)} (${rawErrorMessage(e)})`);
    } finally {
      setBusy(false);
    }
  };

  const resendSmsCode = async () => {
    if (!factorId || !smsCooldown.canSend) return;
    setBusy(true);
    setError(null);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) throw challengeError;
      setSmsChallengeId(challenge.id);
      smsCooldown.registerSend();
    } catch (e: any) {
      setError(`${t(`mfa.smsErrors.${smsErrorKey(e)}`)} (${rawErrorMessage(e)})`);
    } finally {
      setBusy(false);
    }
  };

  const activateSms = async () => {
    if (!factorId || code.length !== 6) {
      setError(t('mfa.errors.codeLength'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let cid = smsChallengeId;
      if (!cid) {
        const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
          factorId,
        });
        if (challengeError) throw challengeError;
        cid = challenge.id;
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: cid,
        code,
      });
      if (verifyError) throw verifyError;

      setCode('');
      setSmsChallengeId(null);
      invalidateMfa();
      await refetch();
      setStage('idle');
      toast({ title: t('mfa.status.active'), description: t('mfa.methods.sms') });
    } catch (e: any) {
      setError(rawErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // --- Factor removal ------------------------------------------------------

  const removeFactor = async (factor: MfaFactor) => {
    setBusy(true);
    setError(null);
    try {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (unenrollError) throw unenrollError;

      // Removing the LAST factor turns 2FA off entirely — clear recovery codes.
      if (factors.length <= 1) {
        try {
          await supabase.functions.invoke('mfa-recovery-codes', { body: { action: 'clear' } });
        } catch {
          /* non-critical: the factor is already unenrolled */
        }
      }

      invalidateMfa();
      await refetch();
      toast({ title: t('mfa.factors.removed') });
    } catch (e: any) {
      setError(`${t('mfa.factors.removeFailed')} ${rawErrorMessage(e)}`);
    } finally {
      setBusy(false);
      setPendingRemoval(null);
    }
  };

  const disable = async () => {
    if (disableCode.length !== 6) {
      setError('Enter your current 6-digit code to disable 2FA.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Prefer a TOTP factor for the confirmation code, as before.
      const totpFactor = factors.find((f) => f.factorType === 'totp') ?? factors[0];
      const id = totpFactor?.id ?? mfa?.factors[0]?.id;
      if (!id) throw new Error('No active authenticator factor found.');

      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: id,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: id,
        challengeId: challenge.id,
        code: disableCode,
      });
      if (verifyError) throw verifyError;

      // Disable = remove every enrolled factor.
      const ids = factors.length ? factors.map((f) => f.id) : [id];
      for (const fid of ids) {
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: fid });
        if (unenrollError) throw unenrollError;
      }

      try {
        await supabase.functions.invoke('mfa-recovery-codes', { body: { action: 'clear' } });
      } catch {
        // Non-critical: the factor is already unenrolled.
      }

      setDisableCode('');
      setStage('idle');
      invalidateMfa();
      await refetch();
      toast({ title: '2FA disabled', description: 'Two-factor authentication is now off.' });
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const factorLabel = (f: MfaFactor) =>
    f.factorType === 'phone'
      ? `${t('mfa.factors.typeSms')} · ${maskPhone(f.phone)}`
      : t('mfa.factors.typeTotp');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          {t('mfa.title')}
        </CardTitle>
        <CardDescription>{t('mfa.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription className="break-words">{error}</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('mfa.status.checking')}
          </p>
        )}

        {!isLoading && stage === 'idle' && mfa?.hasVerifiedFactor && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              <span className="font-medium text-green-800">{t('mfa.status.active')}</span>
            </div>

            {/* Enrolled factors with type, friendly name and removal */}
            {factors.length > 0 && (
              <div className="space-y-2">
                <Label>{t('mfa.factors.title')}</Label>
                <ul className="divide-y rounded-lg border">
                  {factors.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-3 p-3">
                      <div className="flex min-w-0 items-center gap-2">
                        {f.factorType === 'phone' ? (
                          <Smartphone className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{factorLabel(f)}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {f.friendlyName || t('mfa.factors.unnamed')}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        disabled={busy}
                        onClick={() => setPendingRemoval(f)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        {t('mfa.factors.remove')}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Add the method that is still missing */}
            <div className="flex flex-wrap gap-2">
              {!hasTotp && (
                <Button variant="outline" onClick={startEnroll} disabled={busy}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('mfa.methods.totp')}
                </Button>
              )}
              {SMS_ENABLED && !hasPhone && (
                <Button variant="outline" onClick={startSmsEnroll} disabled={busy}>
                  <Smartphone className="h-4 w-4 mr-2" />
                  {t('mfa.methods.sms')}
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label>Enter your current code to disable 2FA</Label>
              <InputOTP maxLength={6} value={disableCode} onChange={setDisableCode}>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <Button variant="destructive" onClick={disable} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Disable 2FA
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={async () => {
                setBusy(true);
                setError(null);
                const { data, error: e } = await supabase.functions.invoke('mfa-recovery-codes', {
                  body: { count: 8 },
                });
                setBusy(false);
                if (e || !data?.codes)
                  return setError(
                    'Could not generate recovery codes right now. Please try again later or contact support@dkaimarketplace.com.',
                  );
                setRecoveryCodes(data.codes);
                setSavedConfirmed(false);
                setStage('recovery');
              }}
              disabled={busy}
            >
              <KeyRound className="h-4 w-4 mr-2" />
              Regenerate recovery codes
            </Button>
          </div>
        )}

        {!isLoading && stage === 'idle' && !mfa?.hasVerifiedFactor && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('mfa.status.inactive')}</p>
            <Label>{t('mfa.methods.title')}</Label>
            <div className="grid gap-3">
              <button
                type="button"
                onClick={startEnroll}
                disabled={busy}
                className="rounded-lg border p-4 text-left transition-colors hover:border-primary disabled:opacity-60"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <KeyRound className="h-4 w-4 text-primary" />
                  {t('mfa.methods.totp')}
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                    {t('mfa.methods.recommended')}
                  </span>
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {t('mfa.methods.totpDescription')}
                </span>
              </button>

            </div>
          </div>
        )}

        {/* SMS: phone number entry */}
        {stage === 'sms-phone' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mfa-phone">{t('mfa.phone.label')}</Label>
              <Input
                id="mfa-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder={t('mfa.phone.placeholder')}
                value={phoneInput}
                onChange={(e) => {
                  setPhoneInput(e.target.value);
                  setPhoneError(null);
                }}
                aria-invalid={!!phoneError}
                aria-describedby="mfa-phone-hint"
              />
              <p id="mfa-phone-hint" className="text-xs text-muted-foreground">
                {t('mfa.phone.hint')}
              </p>
              {phoneError && (
                <p className="text-sm text-destructive" role="alert">
                  {phoneError}
                </p>
              )}
              <p className="text-xs text-muted-foreground">{t('mfa.sms.cooldownNotice')}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={sendSmsCode} disabled={busy || !smsCooldown.canSend}>
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {smsCooldown.secondsLeft > 0
                  ? t('mfa.sms.resendIn', { seconds: smsCooldown.secondsLeft })
                  : t('mfa.phone.sendCode')}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setStage('idle');
                  setPhoneInput('');
                  setPhoneError(null);
                  setError(null);
                }}
                disabled={busy}
              >
                Cancel
              </Button>
            </div>
            {smsCooldown.capReached && (
              <p className="text-xs text-muted-foreground">
                {t('mfa.sms.capReached', { max: smsCooldown.maxSends })}
              </p>
            )}
          </div>
        )}

        {/* SMS: code entry */}
        {stage === 'sms-code' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('mfa.phone.codeSent', { phone: maskPhone(enrolledPhone) })}
            </p>
            <div className="space-y-2">
              <Label>{t('mfa.phone.codeLabel')}</Label>
              <InputOTP maxLength={6} value={code} onChange={setCode}>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={activateSms} disabled={busy || code.length !== 6}>
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {t('mfa.phone.activate')}
              </Button>
              <Button variant="outline" onClick={resendSmsCode} disabled={busy || !smsCooldown.canSend}>
                {smsCooldown.secondsLeft > 0
                  ? t('mfa.sms.resendIn', { seconds: smsCooldown.secondsLeft })
                  : t('mfa.sms.resend')}
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  if (factorId) await supabase.auth.mfa.unenroll({ factorId });
                  setStage('idle');
                  setCode('');
                  setSmsChallengeId(null);
                  setError(null);
                  invalidateMfa();
                  await refetch();
                }}
                disabled={busy}
              >
                Cancel
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {smsCooldown.capReached
                ? t('mfa.sms.capReached', { max: smsCooldown.maxSends })
                : t('mfa.sms.remainingSends', { count: smsCooldown.remainingSends })}
            </p>
          </div>
        )}

        {stage === 'enrolling' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Scan this QR code with your authenticator app, then enter the 6-digit code to activate.
            </p>
            <div className="flex justify-center rounded-lg border bg-white p-4">
              {qr ? (
                qr.startsWith('data:') ? (
                  <img src={qr} alt="2FA QR code" className="h-44 w-44" />
                ) : (
                  <QRCode value={qr} size={176} />
                )
              ) : null}
            </div>
            {secret && (
              <div className="space-y-1">
                <Label>Or enter this secret manually</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all rounded bg-muted px-2 py-1 text-xs">
                    {secret}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Copy secret"
                    onClick={() => {
                      navigator.clipboard.writeText(secret);
                      toast({ title: 'Copied', description: 'Secret copied to clipboard.' });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Verification code</Label>
              <InputOTP maxLength={6} value={code} onChange={setCode}>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <div className="flex gap-2">
              <Button onClick={activate} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Verify and activate
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  if (factorId) await supabase.auth.mfa.unenroll({ factorId });
                  setStage('idle');
                  setCode('');
                }}
                disabled={busy}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {stage === 'recovery' && (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                These 8 recovery codes are shown once. Each one works exactly once and only hashes
                are stored — we cannot show them again.
              </AlertDescription>
            </Alert>
            <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-3 font-mono text-sm">
              {recoveryCodes.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={downloadCodes}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(recoveryCodes.join('\n'));
                  toast({ title: 'Copied', description: 'Recovery codes copied.' });
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="saved-codes"
                checked={savedConfirmed}
                onCheckedChange={(v) => setSavedConfirmed(v === true)}
              />
              <Label htmlFor="saved-codes" className="text-sm">
                I have saved my recovery codes in a safe place
              </Label>
            </div>
            <Button
              disabled={!savedConfirmed}
              onClick={() => {
                setRecoveryCodes([]);
                setStage('idle');
                refetch();
              }}
            >
              Done
            </Button>
          </div>
        )}
      </CardContent>

      {/* Removal confirmation — extra loud when it is the last factor */}
      <AlertDialog open={!!pendingRemoval} onOpenChange={(o) => !o && setPendingRemoval(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('mfa.factors.removeTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('mfa.factors.removeDescription', {
                name: pendingRemoval ? factorLabel(pendingRemoval) : '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {factors.length <= 1 && (
            <Alert variant="destructive">
              <AlertDescription>{t('mfa.factors.removeLastWarning')}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => pendingRemoval && removeFactor(pendingRemoval)}
            >
              {t('mfa.factors.removeConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
