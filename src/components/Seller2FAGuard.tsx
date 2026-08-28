import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMfaStatus } from '@/hooks/useMfa';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { TwoFactorSettings } from '@/components/security/TwoFactorSettings';
import { SellerAgreementGate } from '@/components/SellerAgreementGate';
import { HourglassLoader } from '@/components/HourglassLoader';

interface Seller2FAGuardProps {
  children: React.ReactNode;
}

/**
 * Seller areas require a verified TOTP factor on the account.
 * Status comes from native Supabase MFA (same authoritative source as login
 * and the security settings panel), NOT the legacy dkai_profiles flag.
 */
export function Seller2FAGuard({ children }: Seller2FAGuardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: mfa, isLoading } = useMfaStatus();

  if (!user || isLoading || !mfa) {
    return (
      <div className="flex items-center justify-center py-12">
        <HourglassLoader size={96} />
      </div>
    );
  }

  if (!mfa.hasVerifiedFactor) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4 space-y-6">
        <Card className="border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              2FA Required for Selling
            </CardTitle>
            <CardDescription>
              To protect buyers and sellers, two-factor authentication is mandatory for all seller
              activities. Set up 2FA below to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate(-1)}>
              Go Back
            </Button>
          </CardContent>
        </Card>

        <TwoFactorSettings />
      </div>
    );
  }

  return <SellerAgreementGate>{children}</SellerAgreementGate>;
}
