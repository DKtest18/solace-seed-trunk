import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import QRCode from 'react-qr-code';
import { generateTOTPSecret, generateOTPAuthURI, verifyTOTP } from '@/utils/totp';
import { validatePassword } from '@/utils/passwordValidation';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { sanitizeEmail, sanitizeText } from '@/utils/inputSanitization';
import { Loader2, Mail, ShieldCheck } from 'lucide-react';
import { RulesAcceptanceStep } from '@/components/RulesAcceptanceStep';
import { lovable } from '@/integrations/lovable/index';
import { Separator } from '@/components/ui/separator';

type SignupStep = 'details' | 'verify-email' | 'accept-rules' | 'offer-2fa' | 'setup-2fa';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<SignupStep>('details');
  const [signupUserId, setSignupUserId] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  
  // 2FA state
  const [twoFASecret, setTwoFASecret] = useState('');
  const [twoFACode, setTwoFACode] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  
  const navigate = useNavigate();

  // Redirect if already logged in and not in signup flow
  useEffect(() => {
    if (step === 'details') {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          navigate('/', { replace: true });
        }
      });
    }
  }, [step, navigate]);

  // Listen for email verification (user clicks link in email and gets redirected back)
  useEffect(() => {
    if (step !== 'verify-email') return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // User verified their email and is now signed in
        setSignupUserId(session.user.id);
        toast.success('Email verified successfully!');
        setStep('accept-rules');
      }
    });

    return () => subscription.unsubscribe();
  }, [step]);

  // Resend cooldown timer
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
          data: {
            full_name: sanitizedFullName,
            email_verified: false,
            is_2fa_enabled: false,
          },
          emailRedirectTo: `${window.location.origin}/signup`,
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

      toast.success('Verification email sent! Please check your inbox.');
      setSignupUserId(data.user.id);
      setStep('verify-email');
      setResendCooldown(60);
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">
            {step === 'details' && 'Create Account'}
            {step === 'verify-email' && 'Verify Your Email'}
            {step === 'accept-rules' && 'Accept Platform Rules'}
            {step === 'offer-2fa' && 'Secure Your Account'}
            {step === 'setup-2fa' && 'Setup Two-Factor Authentication'}
          </CardTitle>
          <CardDescription>
            {step === 'details' && 'Join the marketplace to buy or sell AI agents and software'}
            {step === 'verify-email' && 'We sent a verification link to your email'}
            {step === 'accept-rules' && 'Review and accept platform rules to complete signup'}
            {step === 'offer-2fa' && 'Would you like to enable two-factor authentication?'}
            {step === 'setup-2fa' && 'Scan the QR code with your authenticator app'}
          </CardDescription>
        </CardHeader>

        {/* Step 1: Details */}
        {step === 'details' && (
          <form onSubmit={handleSubmitDetails}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" type="text" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                <PasswordStrengthIndicator password={password} />
                <p className="text-xs text-muted-foreground">Must be 8+ characters with uppercase, lowercase, number, and special character</p>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating Account...</>) : 'Continue'}
              </Button>
              <div className="relative w-full">
                <div className="absolute inset-0 flex items-center"><Separator className="w-full" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">or</span></div>
              </div>
              <Button type="button" variant="outline" className="w-full" disabled={loading} onClick={async () => { const { error } = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin }); if (error) toast.error('Failed to sign in with Google.'); }}>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Sign up with Google
              </Button>
              <Button type="button" variant="outline" className="w-full" disabled={loading} onClick={async () => { const { error } = await lovable.auth.signInWithOAuth("apple", { redirect_uri: window.location.origin }); if (error) toast.error('Failed to sign in with Apple.'); }}>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                Sign up with Apple
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Already have an account?{' '}<Link to="/login" className="text-primary hover:underline font-medium">Sign in</Link>
              </p>
            </CardFooter>
          </form>
        )}

        {/* Step 2: Verify Email */}
        {step === 'verify-email' && (
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  We've sent a verification link to
                </p>
                <p className="font-medium">{email}</p>
                <p className="text-sm text-muted-foreground">
                  Click the link in your email to verify your account and continue with signup.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleResendEmail}
                disabled={resendCooldown > 0}
              >
                {resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : 'Resend verification email'}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Didn't receive the email? Check your spam folder or try resending.
              </p>
            </div>
          </CardContent>
        )}

        {/* Step 3: Accept Rules */}
        {step === 'accept-rules' && (
          <div className="p-0">
            <RulesAcceptanceStep ruleType="user" loading={loading} onAccept={handleRulesAccepted} />
          </div>
        )}

        {/* Step 4: Offer 2FA */}
        {step === 'offer-2fa' && (
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center space-y-2">
                <p className="font-medium">Welcome to DK AI Marketplace!</p>
                <p className="text-sm text-muted-foreground">
                  Your account is now active. Would you like to add two-factor authentication for extra security? (Required for sellers)
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button className="w-full" onClick={handleStart2FA}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Set Up 2FA
              </Button>
              <Button variant="ghost" className="w-full text-sm" onClick={handleSkip2FA}>
                Skip for now
              </Button>
            </div>
          </CardContent>
        )}

        {/* Step 5: 2FA Setup (optional) */}
        {step === 'setup-2fa' && (
          <form onSubmit={handleSetup2FA}>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center space-y-4">
                <div className="p-6 bg-white rounded-lg">
                  <QRCode value={generateOTPAuthURI(email, twoFASecret)} size={200} />
                </div>
                <div className="space-y-2 w-full">
                  <p className="text-sm font-medium text-center">Scan with Google Authenticator, Authy, or any compatible app</p>
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-xs text-muted-foreground text-center mb-1">Manual Entry Key:</p>
                    <p className="text-sm font-mono text-center break-all">{twoFASecret}</p>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">Your recovery key has been downloaded. Keep it safe!</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="twoFACode">Enter 6-Digit Code</Label>
                <Input id="twoFACode" value={twoFACode} onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} className="text-center text-2xl tracking-widest" autoFocus />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading || twoFACode.length !== 6}>
                {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enabling 2FA...</>) : (<><ShieldCheck className="mr-2 h-4 w-4" />Enable 2FA</>)}
              </Button>
              <Button type="button" variant="ghost" className="w-full text-sm" onClick={handleSkip2FA}>
                Skip for now
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
