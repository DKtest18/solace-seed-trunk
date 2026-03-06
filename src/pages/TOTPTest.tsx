import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import QRCode from 'react-qr-code';
import { generateTOTPSecret, generateOTPAuthURI, verifyTOTP, getCurrentTOTPCode } from '@/utils/totp';
import { supabase } from '@/integrations/supabase/client';

export default function TOTPTestPage() {
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('test@example.com');
  const [currentCode, setCurrentCode] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const { toast } = useToast();

  const handleGenerateSecret = () => {
    const newSecret = generateTOTPSecret();
    setSecret(newSecret);
    toast({
      title: 'Secret Generated',
      description: 'Scan the QR code with your authenticator app',
    });
  };

  const handleGetCurrentCode = async () => {
    if (!secret) {
      toast({
        title: 'Error',
        description: 'Generate a secret first',
        variant: 'destructive',
      });
      return;
    }
    const code = await getCurrentTOTPCode(secret);
    setCurrentCode(code);
  };

  const handleVerifyClient = async () => {
    if (!secret || !code) {
      toast({
        title: 'Error',
        description: 'Enter both secret and code',
        variant: 'destructive',
      });
      return;
    }

    const isValid = await verifyTOTP(secret, code);
    toast({
      title: isValid ? 'Success' : 'Failed',
      description: isValid ? 'Code is valid!' : 'Code is invalid',
      variant: isValid ? 'default' : 'destructive',
    });
  };

  const handleVerifyServer = async () => {
    if (!secret || !code) {
      toast({
        title: 'Error',
        description: 'Enter both secret and code',
        variant: 'destructive',
      });
      return;
    }

    const { data, error } = await supabase.functions.invoke('test-totp', {
      body: { secret, code },
    });

    setTestResult(data);
    toast({
      title: data?.valid ? 'Success' : 'Failed',
      description: data?.message || error?.message || 'Unknown error',
      variant: data?.valid ? 'default' : 'destructive',
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>TOTP Testing Interface</CardTitle>
          <CardDescription>
            Test 2FA TOTP generation and verification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Generate Secret */}
          <div className="space-y-4">
            <Button onClick={handleGenerateSecret} className="w-full">
              Generate New Secret
            </Button>
            {secret && (
              <>
                <div className="space-y-2">
                  <Label>Secret (Base32)</Label>
                  <Input value={secret} readOnly className="font-mono" />
                </div>
                <div className="flex flex-col items-center space-y-4">
                  <div className="p-6 bg-white rounded-lg">
                    <QRCode
                      value={generateOTPAuthURI(email, secret)}
                      size={200}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Scan with authenticator app
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Current Code Display */}
          {secret && (
            <div className="space-y-2">
              <Button onClick={handleGetCurrentCode} variant="outline" className="w-full">
                Get Current Expected Code
              </Button>
              {currentCode && (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Expected Code:</p>
                  <p className="text-3xl font-bold tracking-widest">{currentCode}</p>
                </div>
              )}
            </div>
          )}

          {/* Test Verification */}
          <div className="space-y-4 border-t pt-6">
            <div className="space-y-2">
              <Label htmlFor="code">Enter 6-Digit Code</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="text-center text-2xl tracking-widest"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button onClick={handleVerifyClient} disabled={!secret || code.length !== 6}>
                Verify (Client-Side)
              </Button>
              <Button onClick={handleVerifyServer} variant="secondary" disabled={!secret || code.length !== 6}>
                Verify (Server-Side)
              </Button>
            </div>
          </div>

          {/* Test Result Display */}
          {testResult && (
            <div className="bg-muted p-4 rounded-md">
              <p className="text-sm font-medium mb-2">Server Response:</p>
              <pre className="text-xs overflow-auto">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            Use this page to test TOTP generation and validation before implementing in production
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
