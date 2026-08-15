import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldAlert, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'react-qr-code';
import { generateTOTPSecret, generateOTPAuthURI } from '@/utils/totp';
import { SellerAgreementGate } from '@/components/SellerAgreementGate';

interface Seller2FAGuardProps {
  children: React.ReactNode;
}

export function Seller2FAGuard({ children }: Seller2FAGuardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [is2FAEnabled, setIs2FAEnabled] = useState<boolean | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [setupStep, setSetupStep] = useState<'prompt' | 'setup' | 'recovery'>('prompt');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [currentEmail, setCurrentEmail] = useState('');

  // Always fetch the real session email
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setCurrentEmail(session.user.email);
      }
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const { data } = await db
        .from('dkai_profiles')
        .select('is_2fa_enabled')
        .eq('id', user.id)
        .single();
      const enabled = data?.is_2fa_enabled ?? false;
      setIs2FAEnabled(enabled);
      if (!enabled) setShowDialog(true);
    };
    check();
  }, [user]);

  const handleStartSetup = () => {
    const newSecret = generateTOTPSecret();
    setSecret(newSecret);
    setSetupStep('setup');
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
      setSetupStep('recovery');
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
    setIs2FAEnabled(true);
    setShowDialog(false);
  };

  if (is2FAEnabled === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!is2FAEnabled) {
    return (
      <>
        <Dialog open={showDialog} onOpenChange={(open) => { if (!open && setupStep !== 'recovery') { navigate(-1); } setShowDialog(open); }}>
          <DialogContent className="sm:max-w-md">
            {setupStep === 'prompt' ? (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-amber-500" />
                    2FA Required for Selling
                  </DialogTitle>
                  <DialogDescription>
                    To protect buyers and sellers, two-factor authentication is mandatory for all seller activities. Please set up 2FA to continue.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex flex-col gap-2 sm:flex-col">
                  <Button onClick={handleStartSetup} className="w-full">
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Set Up 2FA Now
                  </Button>
                  <Button variant="outline" onClick={() => { setShowDialog(false); navigate(-1); }} className="w-full">
                    Go Back
                  </Button>
                </DialogFooter>
              </>
            ) : setupStep === 'setup' ? (
              <>
                <DialogHeader>
                  <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
                  <DialogDescription>Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)</DialogDescription>
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
                    <Label htmlFor="seller-2fa-code">Enter 6-Digit Code</Label>
                    <Input
                      id="seller-2fa-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                      className="text-center text-xl tracking-widest"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleVerify} disabled={loading || code.length !== 6} className="w-full">
                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</> : 'Enable 2FA & Continue'}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
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
                    I've Saved My Key — Continue
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <p>2FA setup required to access seller features.</p>
        </div>
      </>
    );
  }

  return <SellerAgreementGate>{children}</SellerAgreementGate>;
}
