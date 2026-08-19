import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/dkaiDb';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { lovable } from '@/integrations/lovable/index';
import dkLogo from '@/assets/dk-ai-logo.png';
import { LinkedInAuthButton } from '@/components/auth/LinkedInAuthButton';

/**
 * Authoritative two-factor check right after sign-in.
 * Returns true when the account has a verified TOTP factor but the current
 * session is still aal1 (i.e. the 2FA code has NOT been entered yet).
 * Fails CLOSED: any uncertainty results in the challenge being shown.
 */
async function isMfaChallengeRequired(): Promise<boolean> {
  let hasVerifiedFactor = false;

  // 1) Server-side truth (SECURITY DEFINER RPC reading auth.mfa_factors).
  try {
    const { data, error } = await (supabase as any).rpc('dkai_my_mfa_state');
    if (!error && data) {
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.has_verified_factor) hasVerifiedFactor = true;
    }
  } catch {
    /* ignore — client list below is the fallback */
  }

  // 2) Client factor list (GET /user).
  try {
    const { data } = await supabase.auth.mfa.listFactors();
    const all = [...(((data as any)?.totp) ?? []), ...(((data as any)?.all) ?? [])];
    if (all.some((f: any) => f?.status === 'verified')) hasVerifiedFactor = true;
  } catch {
    /* ignore */
  }

  if (!hasVerifiedFactor) return false;

  // Current assurance level from the JWT `aal` claim.
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return true;
  try {
    const payload = JSON.parse(
      atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
    );
    return payload?.aal !== 'aal2';
  } catch {
    return true;
  }
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'credentials' | '2fa' | 'backup'>('credentials');
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFAError, setTwoFAError] = useState<string | null>(null);
  const [backupCode, setBackupCode] = useState('');
  const [tempUserId, setTempUserId] = useState('');
  const [tempEmail, setTempEmail] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const prefill = searchParams.get('email');
    if (prefill) setEmail(prefill);
  }, [searchParams]);

  const redirectTo = searchParams.get('redirect');
  const safeRedirect = redirectTo && redirectTo.startsWith('/') ? redirectTo : null;

  useEffect(() => {
    // Never auto-redirect while a 2FA challenge is pending: the session exists
    // but is still aal1, so login is NOT complete.
    if (user && step === 'credentials') navigate(safeRedirect ?? '/', { replace: true });
  }, [user, navigate, safeRedirect, step]);

  const checkUserRoleAndRedirect = async (userId: string) => {
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    const isAdmin = roles?.some(r => r.role === 'admin');
    navigate(safeRedirect ?? (isAdmin ? '/admin' : '/'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data: profile } = await db
        .from('dkai_profiles')
        .select('is_2fa_enabled, is_banned, banned_at, ban_expires_at, is_deleted')
        .eq('id', user.id)
        .single();

      if (profile?.is_deleted) {
        await supabase.auth.signOut();
        throw new Error('This account has been deleted. Contact support at support@dkaimarketplace.com');
      }
      if (profile?.banned_at && !profile?.is_banned) {
        await supabase.auth.signOut();
        throw new Error('Your account has been suspended. Contact support at support@dkaimarketplace.com');
      }
      if (profile?.is_banned) {
        const banExpires = profile.ban_expires_at ? new Date(profile.ban_expires_at) : null;
        if (!banExpires || banExpires > new Date()) {
          await supabase.auth.signOut();
          throw new Error(banExpires
            ? `Your account is suspended until ${banExpires.toLocaleDateString()}. Contact support at support@dkaimarketplace.com`
            : 'Your account has been banned. Contact support at support@dkaimarketplace.com');
        }
      }

      // --- Two-factor check (Supabase Auth native MFA) ---------------------
      // Authoritative: does this account have a verified TOTP factor, and is
      // the current session still at aal1? If so, STOP here.
      const mfaRequired = await isMfaChallengeRequired();

      if (mfaRequired) {
        setTempUserId(user.id);
        setTempEmail(email);
        setStep('2fa');
        setTwoFACode('');
        setFailedAttempts(0);
        setLoading(false);
        return;
      }

      toast({ title: 'Welcome back!', description: 'You have successfully signed in.' });
      await checkUserRoleAndRedirect(user.id);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to sign in. Please try again.',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (twoFACode.length !== 6) {
      setTwoFAError('Please enter a 6-digit code.');
      return;
    }
    setLoading(true);
    setTwoFAError(null);
    try {
      // Native Supabase MFA: challenge + verify the enrolled TOTP factor.
      // Success upgrades the session to aal2 — that is what the server honours.
      const { data: factorData } = await supabase.auth.mfa.listFactors();
      const factorId =
        ((factorData as any)?.totp ?? []).find((f: any) => f.status === 'verified')?.id ??
        ((factorData as any)?.all ?? []).find((f: any) => f.status === 'verified')?.id;

      let verified = false;
      let failureMessage: string | null = null;

      if (factorId) {
        const { error } = await supabase.auth.mfa.challengeAndVerify({
          factorId,
          code: twoFACode,
        });
        if (error) failureMessage = error.message;
        else verified = true;
      } else {
        // Legacy fallback for accounts still on the custom TOTP table.
        const { data, error } = await supabase.functions.invoke('verify-2fa-code', {
          body: { code: twoFACode },
        });
        if (error) failureMessage = error.message;
        else verified = !!data?.valid;
      }

      if (verified) {
        toast({ title: 'Welcome back!', description: 'You have successfully signed in.' });
        await checkUserRoleAndRedirect(tempUserId);
        return;
      }

      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      setTwoFACode('');
      if (newAttempts >= 5) {
        await supabase.auth.signOut();
        setStep('credentials');
        setFailedAttempts(0);
        setTwoFAError(null);
        toast({ title: 'Too many failed attempts', description: 'Account temporarily locked. Please try again later.', variant: 'destructive' });
        return;
      }
      setTwoFAError(`${failureMessage ?? 'Incorrect code.'} ${5 - newAttempts} attempts remaining.`);
    } catch (error: any) {
      setTwoFAError(error.message || 'Failed to verify code. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  const handleVerifyBackupCode = async () => {
    if (!backupCode || backupCode.length !== 8) {
      toast({ title: 'Invalid backup code', description: 'Please enter an 8-digit backup code.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-backup-code', {
        body: { code: backupCode, email: tempEmail }
      });
      if (error || !data?.valid) {
        const attemptsRemaining = data?.attemptsRemaining ?? 0;
        toast({
          title: 'Invalid backup code',
          description: `${data?.error || 'Backup code is invalid or already used.'}${attemptsRemaining > 0 ? ` ${attemptsRemaining} attempts remaining.` : ''}`,
          variant: 'destructive',
        });
        setBackupCode('');
        return;
      }
      toast({ title: 'Welcome back!', description: 'You have successfully signed in with a backup code.' });
      await checkUserRoleAndRedirect(tempUserId);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to verify backup code.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };


  const inputClass =
    'w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors';

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-primary-soft to-background-soft items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="inline-flex bg-gray-900 rounded-lg p-1 px-2 mb-8">
            <img src={dkLogo} alt="DK AI Marketplace" className="h-12 w-auto" />
          </div>
          <h2 className="text-3xl font-display font-semibold text-gray-900 mb-3">Welcome back.</h2>
          <p className="accent-serif text-gray-600">Made by AI, made for AI. — DK</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {step === 'credentials' && (
            <>
              <h1 className="text-2xl font-display font-semibold text-gray-900 mb-1">
                Sign in to your account
              </h1>
              <p className="text-sm text-muted-foreground mb-8">Welcome back to DK AI Marketplace.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="text-sm font-medium text-gray-900 mb-1.5 block">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="password" className="text-sm font-medium text-gray-900">
                      Password
                    </label>
                    <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>

                <Button type="submit" variant="hero" className="w-full mt-6" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign in'}
                </Button>

                <div className="flex items-center gap-3 my-6">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <span className="h-px flex-1 bg-border" />
                </div>

                <LinkedInAuthButton redirectPath={safeRedirect ?? '/'} />

                <p className="text-sm text-muted-foreground text-center mt-6">
                  Don't have an account?{' '}
                  <Link to="/signup" className="text-primary font-medium hover:underline">
                    Sign up
                  </Link>
                </p>
              </form>
            </>
          )}

          {step === '2fa' && (
            <>
              <h1 className="text-2xl font-display font-semibold text-gray-900 mb-1">
                Two-factor authentication
              </h1>
              <p className="text-sm text-muted-foreground mb-8">
                Enter the 6-digit code from your authenticator app.
              </p>

              <div className="flex justify-center mb-6">
                <InputOTP maxLength={6} value={twoFACode} onChange={setTwoFACode}>
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} className="w-11 h-12 rounded-lg border border-border text-center text-lg font-medium" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <p className="text-sm text-muted-foreground text-center mb-6">
                If you don't have access anymore, write an email to support@dkaimarketplace.com
              </p>

              <Button
                variant="hero"
                onClick={handleVerify2FA}
                className="w-full"
                disabled={loading || twoFACode.length !== 6}
              >
                {loading ? 'Verifying...' : 'Verify and sign in'}
              </Button>

              <button
                onClick={() => setStep('backup')}
                className="w-full text-sm text-primary hover:underline mt-4"
              >
                Use backup code instead
              </button>
              <button
                onClick={async () => {
                  // Abandoning the challenge must drop the half-authenticated session.
                  await supabase.auth.signOut();
                  setTwoFACode('');
                  setFailedAttempts(0);
                  setStep('credentials');
                }}
                className="w-full text-sm text-muted-foreground hover:text-gray-900 mt-2"
              >
                Back to login
              </button>
            </>
          )}

          {step === 'backup' && (
            <>
              <h1 className="text-2xl font-display font-semibold text-gray-900 mb-1">
                Use backup code
              </h1>
              <p className="text-sm text-muted-foreground mb-8">
                Enter one of your 8-digit backup codes.
              </p>

              <input
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="12345678"
                maxLength={8}
                className={`${inputClass} text-center text-2xl tracking-widest font-mono py-3`}
              />

              <Button
                variant="hero"
                onClick={handleVerifyBackupCode}
                className="w-full mt-6"
                disabled={loading || backupCode.length !== 8}
              >
                {loading ? 'Verifying...' : 'Verify and sign in'}
              </Button>

              <button
                onClick={() => { setStep('2fa'); setBackupCode(''); }}
                className="w-full text-sm text-primary hover:underline mt-4"
              >
                Use authenticator code instead
              </button>
              <button
                onClick={() => { setStep('credentials'); setBackupCode(''); setTwoFACode(''); }}
                className="w-full text-sm text-muted-foreground hover:text-gray-900 mt-2"
              >
                Back to login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
