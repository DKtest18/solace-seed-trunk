import { useState } from 'react';
import QRCode from 'react-qr-code';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useMfaStatus, useInvalidateMfaStatus } from '@/hooks/useMfa';
import { Shield, ShieldCheck, Copy, Download, Loader2, KeyRound } from 'lucide-react';

type Stage = 'idle' | 'enrolling' | 'recovery';

/**
 * Two-factor authentication (TOTP) built on Supabase Auth's native MFA.
 * Available to every account: buyers, sellers and admins.
 */
export function TwoFactorSettings() {
  const { toast } = useToast();
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

  const startEnroll = async () => {
    setBusy(true);
    setError(null);
    try {
      // Clean up any leftover unverified factor so enrollment never dead-ends.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const f of (existing as any)?.all ?? []) {
        if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

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

  const disable = async () => {
    if (disableCode.length !== 6) {
      setError('Enter your current 6-digit code to disable 2FA.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const id = mfa?.factors[0]?.id;
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

      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (unenrollError) throw unenrollError;

      await supabase.functions.invoke('mfa-recovery-codes', { body: { action: 'clear' } });

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Two-factor authentication
        </CardTitle>
        <CardDescription>
          Protect your account with an authenticator app (TOTP). Available for every account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription className="break-words">{error}</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking status…
          </p>
        )}

        {!isLoading && stage === 'idle' && mfa?.hasVerifiedFactor && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              <span className="font-medium text-green-800">
                Two-factor authentication is active
              </span>
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
                if (e) return setError(e.message);
                if (!data?.codes) return setError(data?.error ?? 'Could not generate codes.');
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
          <Button onClick={startEnroll} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Enable two-factor authentication
          </Button>
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
    </Card>
  );
}
