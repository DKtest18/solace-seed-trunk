import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/dkaiDb';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'react-qr-code';
import { generateTOTPSecret, generateOTPAuthURI } from '@/utils/totp';

/**
 * Shows a one-time optional 2FA setup prompt after email verification / first login.
 * User can skip or set up 2FA. Only shows once per session.
 */
export function Optional2FAPrompt() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [step, setStep] = useState<'prompt' | 'setup' | 'recovery'>('prompt');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [currentEmail, setCurrentEmail] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setCurrentEmail(session.user.email);
      }
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const dismissed = sessionStorage.getItem('2fa_prompt_dismissed');
    if (dismissed) return;

    const check = async () => {
      const { data } = await db
        .from('dkai_profiles')
        .select('is_2fa_enabled')
        .eq('id', user.id)
        .single();
      if (data && !data.is_2fa_enabled) {
        setShow(true);
      }
    };
    check();
  }, [user]);

  const handleSkip = () => {
    sessionStorage.setItem('2fa_prompt_dismissed', 'true');
    setShow(false);
  };

  const handleStartSetup = () => {
    const newSecret = generateTOTPSecret();
    setSecret(newSecret);
    setStep('setup');
  };

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    try {
      const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const randomValues = new Uint8Array(32);
      window.crypto.getRandomValues(randomValues);
      let genKey = '';
      for (let i = 0; i < 32; i++) {
        genKey += charset[randomValues[i] % charset.length];
        if ((i + 1) % 4 === 0 && i !== 31) genKey += '-';
      }

      const { data, error } = await supabase.functions.invoke('enable-2fa', {
        body: { secret, code, recoveryKey: genKey }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setRecoveryKey(genKey);
      setStep('recovery');
      toast.success('2FA enabled successfully!');
    } catch (err: any) {
      const msg = err.message || 'Failed to enable 2FA.';
      if (msg.toLowerCase().includes('invalid')) {
        toast.error('Invalid verification code. Please try again.');
        setCode('');
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadRecoveryKey = () => {
    const content = `DK AI Marketplace - Recovery Key\n\nRecovery Key: ${recoveryKey}\n\nKeep this safe! You will need this if you lose access to your authenticator app.\nCreated: ${new Date().toLocaleString()}\nAccount: ${currentEmail}`;
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

  const handleRecoveryDone = () => {
    sessionStorage.setItem('2fa_prompt_dismissed', 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <Dialog open={show} onOpenChange={(open) => { if (!open && step !== 'recovery') handleSkip(); }}>
      <DialogContent className="sm:max-w-md">
        {step === 'prompt' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Secure Your Account
              </DialogTitle>
              <DialogDescription>
                Set up two-factor authentication for extra security. This is optional for buyers but required if you want to sell on the marketplace.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col gap-2 sm:flex-col">
              <Button onClick={handleStartSetup} className="w-full">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Set Up 2FA
              </Button>
              <Button variant="ghost" onClick={handleSkip} className="w-full text-sm">
                Skip for now
              </Button>
            </DialogFooter>
          </>
        ) : step === 'setup' ? (
          <>
            <DialogHeader>
              <DialogTitle>Set Up 2FA</DialogTitle>
              <DialogDescription>Scan with your authenticator app (Google Authenticator, Authy, etc.)</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              <p className="text-xs text-muted-foreground">Account: <strong>{currentEmail}</strong></p>
              <div className="p-4 bg-white rounded-lg">
                <QRCode value={generateOTPAuthURI(currentEmail, secret)} size={180} />
              </div>
              <div className="bg-muted p-2 rounded-md w-full">
                <p className="text-xs text-muted-foreground text-center mb-1">Manual Key:</p>
                <p className="text-xs font-mono text-center break-all">{secret}</p>
              </div>
              <div className="w-full space-y-2">
                <Label htmlFor="opt-2fa-code">Enter 6-Digit Code</Label>
                <Input
                  id="opt-2fa-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-xl tracking-widest"
                />
              </div>
            </div>
            <DialogFooter className="flex flex-col gap-2 sm:flex-col">
              <Button onClick={handleVerify} disabled={loading || code.length !== 6} className="w-full">
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</> : 'Enable 2FA'}
              </Button>
              <Button variant="ghost" onClick={handleSkip} className="w-full text-sm">
                Skip for now
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-green-500" />
                2FA Enabled — Save Your Recovery Key
              </DialogTitle>
              <DialogDescription>
                Save this recovery key securely. You'll need it to access your account if you lose your authenticator device.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="bg-muted border border-border p-4 rounded-lg w-full">
                <p className="text-xs text-muted-foreground text-center mb-2">Recovery Key</p>
                <p className="text-sm font-mono text-center break-all select-all font-bold">{recoveryKey}</p>
              </div>
              <p className="text-xs text-destructive text-center font-medium">
                ⚠️ This key will NOT be shown again. Save it now!
              </p>
            </div>
            <DialogFooter className="flex flex-col gap-2 sm:flex-col">
              <Button onClick={handleDownloadRecoveryKey} variant="outline" className="w-full">
                Download Recovery Key
              </Button>
              <Button onClick={handleRecoveryDone} className="w-full">
                I've Saved My Key — Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
