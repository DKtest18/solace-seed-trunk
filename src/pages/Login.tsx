import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/dkaiDb';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Shield } from 'lucide-react';
import { lovable } from '@/integrations/lovable/index';
import { Separator } from '@/components/ui/separator';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'credentials' | '2fa' | 'backup'>('credentials');
  const [twoFACode, setTwoFACode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  // twoFASecret removed — verification is now server-side only
  const [tempUserId, setTempUserId] = useState('');
  const [tempEmail, setTempEmail] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const checkUserRoleAndRedirect = async (userId: string) => {
    // Check if user has admin role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    const isAdmin = roles?.some(r => r.role === 'admin');
    
    if (isAdmin) {
      navigate('/admin');
    } else {
      navigate('/');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signIn(email, password);
      
      // Get the current user's 2FA secret
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');
      
      const { data: profile } = await db
        .from('dkai_profiles')
        .select('is_2fa_enabled, is_banned, ban_expires_at, is_deleted')
        .eq('id', user.id)
        .single();

      // Check if user is banned or deleted
      if (profile?.is_deleted) {
        await supabase.auth.signOut();
        throw new Error('This account has been deleted. Contact support at dari@dkaisystem.com');
      }
      
      if (profile?.is_banned) {
        const banExpires = profile.ban_expires_at ? new Date(profile.ban_expires_at) : null;
        if (!banExpires || banExpires > new Date()) {
          await supabase.auth.signOut();
          const message = banExpires 
            ? `Your account is suspended until ${banExpires.toLocaleDateString()}. Contact support at dari@dkaisystem.com`
            : 'Your account has been banned. Contact support at dari@dkaisystem.com';
          throw new Error(message);
        }
      }
      
      if (profile?.is_2fa_enabled) {
        setTempUserId(user.id);
        setTempEmail(email);
        setStep('2fa');
        setFailedAttempts(0);
        setLoading(false);
      } else {
        toast({
          title: 'Welcome back!',
          description: 'You have successfully signed in.',
        });
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
      toast({
        title: 'Invalid code',
        description: 'Please enter a 6-digit code.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Verify 2FA code SERVER-SIDE — secret never leaves the server
      const { data, error } = await supabase.functions.invoke('verify-2fa-code', {
        body: { code: twoFACode }
      });

      if (error) throw error;

      if (data?.valid) {
        toast({
          title: 'Welcome back!',
          description: 'You have successfully signed in.',
        });
        await checkUserRoleAndRedirect(tempUserId);
      } else {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        
        if (newAttempts >= 5) {
          await supabase.auth.signOut();
          setStep('credentials');
          setTwoFACode('');
          setFailedAttempts(0);
          toast({
            title: 'Too many failed attempts',
            description: 'Account temporarily locked. Please try again later.',
            variant: 'destructive',
          });
          return;
        }

        toast({
          title: 'Invalid code',
          description: `Incorrect code. ${5 - newAttempts} attempts remaining.`,
          variant: 'destructive',
        });
        setTwoFACode('');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to verify code. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyBackupCode = async () => {
    if (!backupCode || backupCode.length !== 8) {
      toast({
        title: 'Invalid backup code',
        description: 'Please enter an 8-digit backup code.',
        variant: 'destructive',
      });
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
          description: `${data?.error || 'Backup code is invalid or already used.'}${
            attemptsRemaining > 0 ? ` ${attemptsRemaining} attempts remaining.` : ''
          }`,
          variant: 'destructive',
        });
        setBackupCode('');
        return;
      }

      toast({
        title: 'Welcome back!',
        description: 'You have successfully signed in with a backup code.',
      });
      await checkUserRoleAndRedirect(tempUserId);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to verify backup code.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        {step === 'credentials' ? (
          <>
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                Sign In
                {email === 'dari@dkaisystem.com' && (
                  <Shield className="h-5 w-5 text-primary" />
                )}
              </CardTitle>
              <CardDescription>
                {email === 'dari@dkaisystem.com' 
                  ? 'Administrator Login'
                  : 'Enter your credentials to access your account'}
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
                <div className="relative w-full">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={loading}
                  onClick={async () => {
                    try {
                      // Sign out any stale session before OAuth to prevent wrong account
                      await supabase.auth.signOut();
                    } catch (_) { /* no session to clear, continue */ }
                    const { error } = await lovable.auth.signInWithOAuth("google", {
                      redirect_uri: window.location.origin,
                    });
                    if (error) {
                      toast({
                        title: 'Error',
                        description: 'Failed to sign in with Google.',
                        variant: 'destructive',
                      });
                    }
                  }}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  Sign in with Google
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={loading}
                  onClick={async () => {
                    try {
                      // Sign out any stale session before OAuth to prevent wrong account
                      await supabase.auth.signOut();
                    } catch (_) { /* no session to clear, continue */ }
                    const { error } = await lovable.auth.signInWithOAuth("apple", {
                      redirect_uri: window.location.origin,
                    });
                    if (error) {
                      toast({
                        title: 'Error',
                        description: 'Failed to sign in with Apple.',
                        variant: 'destructive',
                      });
                    }
                  }}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                  Sign in with Apple
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  Don't have an account?{' '}
                  <Link to="/signup" className="text-primary hover:underline font-medium">
                    Sign up
                  </Link>
                </p>
              </CardFooter>
            </form>
          </>
        ) : step === '2fa' ? (
          <>
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold">Verify 2FA Code</CardTitle>
              <CardDescription>Enter the 6-digit code from your authenticator app</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center gap-4">
                <Label htmlFor="2fa-code">Authentication Code</Label>
                <InputOTP
                  id="2fa-code"
                  maxLength={6}
                  value={twoFACode}
                  onChange={(value) => setTwoFACode(value)}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button 
                onClick={handleVerify2FA} 
                className="w-full" 
                disabled={loading || twoFACode.length !== 6}
              >
                {loading ? 'Verifying...' : 'Verify and Sign In'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setStep('backup')}
                className="w-full text-sm"
              >
                Use backup code instead
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setStep('credentials');
                  setTwoFACode('');
                }}
                className="w-full"
              >
                Back to Login
              </Button>
            </CardFooter>
          </>
        ) : (
          <>
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold">Use Backup Code</CardTitle>
              <CardDescription>Enter one of your 8-digit backup codes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="backup-code">Backup Code</Label>
                <Input
                  id="backup-code"
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="12345678"
                  maxLength={8}
                  className="text-center text-2xl tracking-widest font-mono"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button 
                onClick={handleVerifyBackupCode} 
                className="w-full" 
                disabled={loading || backupCode.length !== 8}
              >
                {loading ? 'Verifying...' : 'Verify and Sign In'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setStep('2fa');
                  setBackupCode('');
                }}
                className="w-full text-sm"
              >
                Use authenticator code instead
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setStep('credentials');
                  setBackupCode('');
                  setTwoFACode('');
                }}
                className="w-full"
              >
                Back to Login
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
}
