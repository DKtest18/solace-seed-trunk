import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import QRCode from 'react-qr-code';
import { generateTOTPSecret, generateOTPAuthURI, verifyTOTP } from '@/utils/totp';
import { validatePassword } from '@/utils/passwordValidation';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { sanitizeEmail, sanitizeText } from '@/utils/inputSanitization';
import { Loader2, Mail, ShieldCheck } from 'lucide-react';
import { RulesAcceptanceStep } from '@/components/RulesAcceptanceStep';
import { lovable } from '@/integrations/lovable/index';
import dkLogo from '@/assets/dk-ai-logo.png';

type SignupStep = 'details' | 'verify-email' | 'accept-rules' | 'offer-2fa' | 'setup-2fa';

const inputClass =
  'w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<SignupStep>('details');
  const [signupUserId, setSignupUserId] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [twoFASecret, setTwoFASecret] = useState('');
  const [twoFACode, setTwoFACode] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);

  const navigate = useNavigate();

  useEffect(() => {
    if (step === 'details') {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) navigate('/', { replace: true });
      });
    }
  }, [step, navigate]);

  useEffect(() => {
    if (step !== 'verify-email') return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setSignupUserId(session.user.id);
        toast.success('Email verified successfully!');
        setStep('accept-rules');
      }
    });
    return () => subscription.unsubscribe();
  }, [step]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const generateRecoveryKey = (): string => {
    const length = 32;
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const randomValues = new Uint8Array(length);
    window.crypto.getRandomValues(randomValues);
    let key = '';
    for (let i = 0; i < length; i++) {
      key += charset[randomValues[i] % charset.length];
      if ((i + 1) % 4 === 0 && i !== length - 1) key += '-';
    }
    return key;
  };

  const downloadRecoveryKey = (key: string) => {
    const content = `DK AI Marketplace - Account Recovery Key\n\nRecovery Key: ${key}\n\nIMPORTANT: Keep this recovery key safe and secure.\nYou will need this key to recover your account if you lose access to your authenticator app.\n\nCreated: ${new Date().toLocaleString()}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dk-ai-recovery-key-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSubmitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const sanitizedEmail = sanitizeEmail(email);
      const sanitizedFullName = sanitizeText(fullName);

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        toast.error(passwordValidation.errors[0]);
        return;
      }

      const { data: bannedEmail } = await supabase
        .from('banned_emails')
        .select('id')
        .eq('email', sanitizedEmail.toLowerCase())
        .maybeSingle();

      if (bannedEmail) {
        toast.error('This email is banned. Contact dari@dkaisystem.com for support.');
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: sanitizedEmail,
        password,
        options: {
          data: { full_name: sanitizedFullName, email_verified: false, is_2fa_enabled: false },
          emailRedirectTo: `${window.location.origin}/auth/verified`,
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('This email is already registered. Please login instead.');
        } else {
          throw error;
        }
        return;
      }

      if (!data.user) throw new Error('Failed to create account');

      setSignupUserId(data.user.id);
      navigate(`/auth/check-email?email=${encodeURIComponent(sanitizedEmail)}`);
      return;
    } catch (error: any) {
      console.error('Signup error:', error);
      toast.error(error.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (resendCooldown > 0) return;
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) throw error;
      toast.success('Verification email resent!');
      setResendCooldown(60);
    } catch {
      toast.error('Failed to resend email. Please try again.');
    }
  };

  const handleRulesAccepted = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || signupUserId;
      if (!userId) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('accept-platform-rules', {
        body: { user_id: userId, rule_type: 'user' },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Rules accepted! Your account is now active.');
      setStep('offer-2fa');
    } catch (error: any) {
      console.error('Error accepting rules:', error);
      toast.error('Failed to accept rules. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip2FA = () => {
    toast.success('Welcome to DK AI Marketplace!');
    navigate('/');
  };

  const handleStart2FA = () => {
    const secret = generateTOTPSecret();
    const recovery = generateRecoveryKey();
    setTwoFASecret(secret);
    setRecoveryKey(recovery);
    downloadRecoveryKey(recovery);
    setStep('setup-2fa');
  };

  const handleSetup2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (twoFACode.length !== 6) {
      toast.error('Please enter the 6-digit code from your authenticator app');
      return;
    }
    const isValid = await verifyTOTP(twoFASecret, twoFACode);
    if (!isValid) {
      const newFailedAttempts = failedAttempts + 1;
      setFailedAttempts(newFailedAttempts);
      if (newFailedAttempts >= 5) {
        toast.error('Too many failed attempts. Please try again later.');
        setStep('offer-2fa');
        return;
      }
      toast.error(`Incorrect code. ${5 - newFailedAttempts} attempts remaining.`);
      setTwoFACode('');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('enable-2fa', {
        body: { secret: twoFASecret, code: twoFACode, recoveryKey }
      });
      if (error) throw error;
      toast.success('2FA enabled! Your account is now extra secure.');
      navigate('/');
    } catch (error: any) {
      console.error('2FA setup error:', error);
      toast.error(error.message || 'Failed to complete 2FA setup.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'apple') => {
    const { error } = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (error) toast.error(`Failed to sign in with ${provider === 'google' ? 'Google' : 'Apple'}.`);
  };

  const headings: Record<SignupStep, { h1: string; sub: string }> = {
    'details': { h1: 'Create your account', sub: 'Start buying or selling AI products in minutes.' },
    'verify-email': { h1: 'Verify your email', sub: 'We sent a verification link to your inbox.' },
    'accept-rules': { h1: 'Accept platform rules', sub: 'Review and accept platform rules to complete signup.' },
    'offer-2fa': { h1: 'Secure your account', sub: 'Add two-factor authentication for extra security.' },
    'setup-2fa': { h1: 'Set up two-factor authentication', sub: 'Scan the QR code with your authenticator app.' },
  };

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-primary-soft to-background-soft items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="inline-flex bg-gray-900 rounded-lg p-1 px-2 mb-8">
            <img src={dkLogo} alt="DK AI Marketplace" className="h-12 w-auto" />
          </div>
          <h2 className="text-3xl font-display font-semibold text-gray-900 mb-3">
            Join DK AI Marketplace.
          </h2>
          <p className="accent-serif text-gray-600">Made by AI, made for AI. — DK</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-display font-semibold text-gray-900 mb-1">
            {headings[step].h1}
          </h1>
          <p className="text-sm text-muted mb-8">{headings[step].sub}</p>

          {step === 'details' && (
            <form onSubmit={handleSubmitDetails} className="space-y-4">
              <div>
                <label htmlFor="fullName" className="text-sm font-medium text-gray-900 mb-1.5 block">
                  Full name
                </label>
                <input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>

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
                <label htmlFor="password" className="text-sm font-medium text-gray-900 mb-1.5 block">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className={inputClass}
                />
                <PasswordStrengthIndicator password={password} />
                <p className="text-xs text-muted mt-1">
                  Must be 8+ characters with uppercase, lowercase, number, and special character.
                </p>
              </div>

              <Button type="submit" variant="hero" className="w-full mt-6" disabled={loading}>
                {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account...</>) : 'Create account'}
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
                Already have an account?{' '}
                <Link to="/login" className="text-primary font-medium hover:underline">
                  Sign in
                </Link>
              </p>
            </form>
          )}

          {step === 'verify-email' && (
            <>
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="h-16 w-16 rounded-full bg-primary-soft flex items-center justify-center">
                  <Mail className="h-8 w-8 text-primary" />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted">We've sent a verification link to</p>
                  <p className="font-medium text-gray-900">{email}</p>
                  <p className="text-sm text-muted">
                    Click the link in your email to verify your account and continue with signup.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleResendEmail}
                disabled={resendCooldown > 0}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend verification email'}
              </Button>
              <p className="text-xs text-muted text-center mt-3">
                Didn't receive the email? Check your spam folder or try resending.
              </p>
            </>
          )}

          {step === 'accept-rules' && (
            <RulesAcceptanceStep ruleType="user" loading={loading} onAccept={handleRulesAccepted} />
          )}

          {step === 'offer-2fa' && (
            <>
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="h-16 w-16 rounded-full bg-primary-soft flex items-center justify-center">
                  <ShieldCheck className="h-8 w-8 text-primary" />
                </div>
                <div className="text-center space-y-2">
                  <p className="font-medium text-gray-900">Welcome to DK AI Marketplace!</p>
                  <p className="text-sm text-muted">
                    Your account is now active. Would you like to add two-factor authentication for extra security? (Required for sellers)
                  </p>
                </div>
              </div>
              <Button variant="hero" className="w-full" onClick={handleStart2FA}>
                <ShieldCheck className="mr-2 h-4 w-4" /> Set up 2FA
              </Button>
              <button
                onClick={handleSkip2FA}
                className="w-full text-sm text-muted hover:text-gray-900 mt-3"
              >
                Skip for now
              </button>
            </>
          )}

          {step === 'setup-2fa' && (
            <form onSubmit={handleSetup2FA} className="space-y-6">
              <div className="flex flex-col items-center space-y-4">
                <div className="p-6 bg-white border border-border rounded-lg">
                  <QRCode value={generateOTPAuthURI(email, twoFASecret)} size={200} />
                </div>
                <div className="space-y-2 w-full">
                  <p className="text-sm font-medium text-center text-gray-900">
                    Scan with Google Authenticator, Authy, or any compatible app
                  </p>
                  <div className="bg-background-soft p-3 rounded-md">
                    <p className="text-xs text-muted text-center mb-1">Manual entry key:</p>
                    <p className="text-sm font-mono text-center break-all text-gray-900">{twoFASecret}</p>
                  </div>
                  <p className="text-xs text-muted text-center">
                    Your recovery key has been downloaded. Keep it safe!
                  </p>
                </div>
              </div>

              <div>
                <label htmlFor="twoFACode" className="text-sm font-medium text-gray-900 mb-1.5 block">
                  Enter 6-digit code
                </label>
                <input
                  id="twoFACode"
                  value={twoFACode}
                  onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                  className={`${inputClass} text-center text-2xl tracking-widest font-mono py-3`}
                />
              </div>

              <Button type="submit" variant="hero" className="w-full" disabled={loading || twoFACode.length !== 6}>
                {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enabling 2FA...</>) : (<><ShieldCheck className="mr-2 h-4 w-4" /> Enable 2FA</>)}
              </Button>
              <button
                type="button"
                onClick={handleSkip2FA}
                className="w-full text-sm text-muted hover:text-gray-900"
              >
                Skip for now
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
