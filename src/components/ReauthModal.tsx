import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useReauthSession } from '@/hooks/useReauthSession';
import { useToast } from '@/hooks/use-toast';
import { Lock, Shield } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ReauthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  has2FA?: boolean;
}

export function ReauthModal({ open, onOpenChange, onSuccess, has2FA }: ReauthModalProps) {
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const { verifyReauth } = useReauthSession();
  const { toast } = useToast();

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await verifyReauth.mutateAsync({ password });
      toast({
        title: 'Verified',
        description: 'You can now view your sensitive data',
      });
      onSuccess();
      onOpenChange(false);
      setPassword('');
    } catch (error) {
      toast({
        title: 'Verification Failed',
        description: error instanceof Error ? error.message : 'Invalid password',
        variant: 'destructive',
      });
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await verifyReauth.mutateAsync({ totpCode });
      toast({
        title: 'Verified',
        description: 'You can now view your sensitive data',
      });
      onSuccess();
      onOpenChange(false);
      setTotpCode('');
    } catch (error) {
      toast({
        title: 'Verification Failed',
        description: error instanceof Error ? error.message : 'Invalid code',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Verify Your Identity
          </DialogTitle>
          <DialogDescription>
            For security, please verify your identity to view sensitive banking information.
            This session will expire in 10 minutes.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="password" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="2fa" disabled={!has2FA}>
              2FA Code
            </TabsTrigger>
          </TabsList>

          <TabsContent value="password">
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Enter Your Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={verifyReauth.isPending}
              >
                <Lock className="w-4 h-4 mr-2" />
                {verifyReauth.isPending ? 'Verifying...' : 'Verify Password'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="2fa">
            <form onSubmit={handle2FASubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="totp">Enter 6-Digit Code</Label>
                <Input
                  id="totp"
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={verifyReauth.isPending}
              >
                <Shield className="w-4 h-4 mr-2" />
                {verifyReauth.isPending ? 'Verifying...' : 'Verify 2FA Code'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
