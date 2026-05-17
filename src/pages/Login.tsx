import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/dkaiDb';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { lovable } from '@/integrations/lovable/index';
import dkLogo from '@/assets/dk-ai-logo.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'credentials' | '2fa' | 'backup'>('credentials');
  const [twoFACode, setTwoFACode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [tempUserId, setTempUserId] = useState('');
  const [tempEmail, setTempEmail] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const checkUserRoleAndRedirect = async (userId: string) => {
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    const isAdmin = roles?.some(r => r.role === 'admin');
    navigate(isAdmin ? '/admin' : '/');
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
        .select('is_2fa_enabled, is_banned, ban_expires_at, is_deleted')
        .eq('id', user.id)
        .single();

      if (profile?.is_deleted) {
        await supabase.auth.signOut();
        throw new Error('This account has been deleted. Contact support at dari@dkaisystem.com');
      }
      if (profile?.is_banned) {
        const banExpires = profile.ban_expires_at ? new Date(profile.ban_expires_at) : null;
        if (!banExpires || banExpires > new Date()) {
          await supabase.auth.signOut();
          throw new Error(banExpires
            ? `Your account is suspended until ${banExpires.toLocaleDateString()}. Contact support at dari@dkaisystem.com`
            : 'Your account has been banned. Contact support at dari@dkaisystem.com');
        }
      }

      if (profile?.is_2fa_enabled) {
        setTempUserId(user.id);
        setTempEmail(email);
        setStep('2fa');
        setFailedAttempts(0);
        setLoading(false);
      } else {
        toast({ title: 'Welcome back!', description: 'You have successfully signed in.' });
        await checkUserRoleAndRedirect(user.id);
      }
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
      toast({ title: 'Invalid code', description: 'Please enter a 6-digit code.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-2fa-code', { body: { code: twoFACode } });
      if (error) throw error;
      if (data?.valid) {
        toast({ title: 'Welcome back!', description: 'You have successfully signed in.' });
        await checkUserRoleAndRedirect(tempUserId);
      } else {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        if (newAttempts >= 5) {
          await supabase.auth.signOut();
          setStep('credentials');
          setTwoFACode('');
          setFailedAttempts(0);
          toast({ title: 'Too many failed attempts', description: 'Account temporarily locked. Please try again later.', variant: 'destructive' });
          return;
        }
        toast({ title: 'Invalid code', description: `Incorrect code. ${5 - newAttempts} attempts remaining.`, variant: 'destructive' });
        setTwoFACode('');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to verify code. Please try again.', variant: 'destructive' });
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

  const handleOAuth = async (provider: 'google' | 'apple') => {
    try { await supabase.auth.signOut(); } catch {}
    const { error } = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast({
        title: 'Error',
        description: `Failed to sign in with ${provider === 'google' ? 'Google' : 'Apple'}.`,
        variant: 'destructive',
      });
    }
  };

  const inputClass =
    'w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors';

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
              <p className="text-sm text-muted mb-8">Welcome back to DK AI Marketplace.</p>

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

                <div className="flex items-center my-6">
                  <span className="border-t border-border flex-1" />
                  <span className="text-xs text-muted px-3 uppercase tracking-wide">or</span>
                  <span className="border-t border-border flex-1" />
                </div>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleOAuth('google')}
                  className="w-full rounded-lg border border-border bg-white py-2.5 px-4 flex items-center justify-center gap-3 hover:bg-background-soft transition-colors text-sm font-medium text-gray-900 disabled:opacity-50"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  Continue with Google
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleOAuth('apple')}
                  className="w-full rounded-lg border border-border bg-white py-2.5 px-4 flex items-center justify-center gap-3 hover:bg-background-soft transition-colors text-sm font-medium text-gray-900 disabled:opacity-50 mt-3"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                  Continue with Apple
                </button>

                <p className="text-sm text-muted text-center mt-6">
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
              <p className="text-sm text-muted mb-8">
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
                onClick={() => { setStep('credentials'); setTwoFACode(''); }}
                className="w-full text-sm text-muted hover:text-gray-900 mt-2"
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
              <p className="text-sm text-muted mb-8">
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
                className="w-full text-sm text-muted hover:text-gray-900 mt-2"
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
