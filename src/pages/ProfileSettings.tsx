import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/dkaiDb';
import { Shield, Copy, Download, Store, CheckCircle, Palette, LayoutGrid, Mail, Ban, Globe } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import QRCode from 'react-qr-code';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useHasRole } from '@/hooks/useUserRole';
import { AppearanceSettings } from '@/components/settings/AppearanceSettings';
import { SidebarLayoutSettings } from '@/components/settings/SidebarLayoutSettings';
import { MessagePrivacySettings } from '@/components/settings/MessagePrivacySettings';
import { BlockedUsersSettings } from '@/components/settings/BlockedUsersSettings';

export default function ProfileSettings() {
  const { user } = useAuth();
  const { hasRole: isSeller, isLoading: roleLoading } = useHasRole('seller');
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [twoFASetup, setTwoFASetup] = useState<{
    secret?: string;
    qrCode?: string;
    backupCodes?: string[];
  }>({});
  const [verificationCode, setVerificationCode] = useState('');
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchProfile();
  }, [user, navigate]);

  const fetchProfile = async () => {
    if (!user) return;
    
    const { data, error } = await db
      .from('dkai_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to load profile',
        variant: 'destructive',
      });
      return;
    }

    setProfile(data);
  };

  const generate2FASecret = async () => {
    setLoading(true);
    try {
      // Generate random secret (32 characters base32)
      const secret = Array.from({ length: 32 }, () => 
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[Math.floor(Math.random() * 32)]
      ).join('');

      // Generate backup codes
      const backupCodes = Array.from({ length: 10 }, () => 
        Array.from({ length: 8 }, () => 
          '0123456789'[Math.floor(Math.random() * 10)]
        ).join('')
      );

      // Create OTP Auth URL for QR code
      const appName = 'DK AI Marketplace';
      const qrCode = `otpauth://totp/${appName}:${user?.email}?secret=${secret}&issuer=${appName}`;

      setTwoFASetup({ secret, qrCode, backupCodes });
      setShowBackupCodes(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to generate 2FA secret',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const enable2FA = async () => {
    if (!twoFASetup.secret || verificationCode.length !== 6) {
      toast({
        title: 'Error',
        description: 'Please enter the 6-digit code from your authenticator app',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Enable 2FA via edge function (validates code)
      const { data, error } = await supabase.functions.invoke('enable-2fa', {
        body: { secret: twoFASetup.secret, code: verificationCode }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Failed to enable 2FA');
      }

      // Generate backup codes
      const { data: backupData, error: backupError } = await supabase.functions.invoke('generate-backup-codes', {
        body: { count: 10 }
      });

      if (backupError || !backupData?.codes) {
        throw new Error('Failed to generate backup codes');
      }

      setTwoFASetup(prev => ({ ...prev, backupCodes: backupData.codes }));
      setShowBackupCodes(true);
      
      toast({
        title: 'Success!',
        description: '2FA has been enabled for your account',
      });
      
      fetchProfile();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to enable 2FA',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const disable2FA = async () => {
    setLoading(true);
    try {
      const { error } = await db
        .from('dkai_profiles')
        .update({
          is_2fa_enabled: false,
          two_fa_secret: null,
        })
        .eq('id', user?.id);

      if (error) throw error;

      toast({
        title: 'Success!',
        description: '2FA has been disabled',
      });
      
      setTwoFASetup({});
      setVerificationCode('');
      fetchProfile();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to disable 2FA',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: 'Secret copied to clipboard',
    });
  };

  const downloadBackupCodes = () => {
    if (!twoFASetup.backupCodes) return;
    
    const text = `DK AI Marketplace - 2FA Backup Codes\n\n${twoFASetup.backupCodes.join('\n')}\n\nKeep these codes safe. Each code can only be used once.`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '2fa-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Downloaded!',
      description: 'Backup codes saved to file',
    });
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Profile Settings</h1>
          <p className="text-muted-foreground">Manage your account security and preferences</p>
        </div>

        <Tabs defaultValue="security" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
            <TabsTrigger value="blocked">Blocked</TabsTrigger>
          </TabsList>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  <CardTitle>Two-Factor Authentication (2FA)</CardTitle>
                </div>
                <CardDescription>
                  Add an extra layer of security to your account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {profile?.is_2fa_enabled ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium text-foreground">2FA is enabled</p>
                        <p className="text-sm text-muted-foreground">Your account is protected</p>
                      </div>
                      <Button
                        variant="destructive"
                        onClick={disable2FA}
                        disabled={loading}
                      >
                        Disable 2FA
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {!twoFASetup.secret ? (
                      <Button onClick={generate2FASecret} disabled={loading}>
                        Set Up 2FA
                      </Button>
                    ) : (
                      <>
                        {!showBackupCodes ? (
                          <div className="space-y-6">
                            <div className="space-y-4">
                              <div>
                                <h3 className="font-semibold mb-2">Step 1: Scan QR Code</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                                </p>
                                <div className="flex justify-center p-4 bg-white rounded-lg border">
                                  <QRCode value={twoFASetup.qrCode || ''} size={200} />
                                </div>
                              </div>

                              <div>
                                <h3 className="font-semibold mb-2">Or enter this secret manually:</h3>
                                <div className="flex gap-2 items-center">
                                  <Input
                                    value={twoFASetup.secret}
                                    readOnly
                                    className="font-mono"
                                  />
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => copyToClipboard(twoFASetup.secret!)}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <div>
                                <h3 className="font-semibold mb-2">Step 2: Verify Code</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                  Enter the 6-digit code from your authenticator app
                                </p>
                                <div className="flex justify-center">
                                  <InputOTP
                                    maxLength={6}
                                    value={verificationCode}
                                    onChange={setVerificationCode}
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
                              </div>

                              <div className="flex gap-2">
                                <Button
                                  onClick={enable2FA}
                                  disabled={loading || verificationCode.length !== 6}
                                  className="flex-1"
                                >
                                  Enable 2FA
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => setTwoFASetup({})}
                                  disabled={loading}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="p-4 border rounded-lg bg-muted/50">
                              <h3 className="font-semibold mb-2 flex items-center gap-2">
                                <Shield className="h-5 w-5 text-green-500" />
                                2FA Enabled Successfully!
                              </h3>
                              <p className="text-sm text-muted-foreground mb-4">
                                Save these backup codes in a safe place. You can use them to access your account if you lose your authenticator device.
                              </p>
                              
                              <div className="space-y-2 mb-4">
                                {twoFASetup.backupCodes?.map((code, index) => (
                                  <div key={index} className="font-mono text-sm p-2 bg-background rounded border">
                                    {code}
                                  </div>
                                ))}
                              </div>

                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  onClick={downloadBackupCodes}
                                  className="flex-1"
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Download Codes
                                </Button>
                                <Button
                                  onClick={() => navigate('/')}
                                  className="flex-1"
                                >
                                  Done
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>
                    Update your personal information
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input value={user.email} disabled />
                    </div>
                    <div className="space-y-2">
                      <Label>Full Name</Label>
                      <Input value={profile?.full_name || ''} disabled />
                    </div>
                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input value={profile?.username || 'Not set'} disabled />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Your Time Zone
                      </Label>
                      <Select 
                        value={profile?.timezone || 'Europe/Zurich'} 
                        onValueChange={async (value) => {
                          const { error } = await supabase
                            .from('profiles')
                            .update({ timezone: value })
                            .eq('id', user.id);
                          if (error) {
                            toast({ title: 'Error', description: 'Failed to update timezone', variant: 'destructive' });
                          } else {
                            setProfile({ ...profile, timezone: value });
                            toast({ title: 'Success', description: 'Timezone updated' });
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Europe/Zurich">Europe/Zurich</SelectItem>
                          <SelectItem value="Europe/Berlin">Europe/Berlin</SelectItem>
                          <SelectItem value="Europe/London">Europe/London</SelectItem>
                          <SelectItem value="America/New_York">America/New York</SelectItem>
                          <SelectItem value="America/Los_Angeles">America/Los Angeles</SelectItem>
                          <SelectItem value="America/Chicago">America/Chicago</SelectItem>
                          <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                          <SelectItem value="Asia/Singapore">Asia/Singapore</SelectItem>
                          <SelectItem value="Australia/Sydney">Australia/Sydney</SelectItem>
                          <SelectItem value="UTC">UTC</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Used for meetings and calendar display
                      </p>
                    </div>
                    <Button onClick={() => navigate('/profile/edit')} className="w-full">
                      Edit Profile
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Store className="h-5 w-5" />
                    <CardTitle>Seller Account</CardTitle>
                  </div>
                  <CardDescription>
                    {isSeller 
                      ? 'You have access to sell products on the marketplace'
                      : 'Upgrade to start selling your AI agents and software'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {roleLoading ? (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground">Loading seller status...</p>
                    </div>
                  ) : isSeller ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 p-4 border rounded-lg bg-muted/50">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <div className="flex-1">
                          <p className="font-medium text-foreground">Seller Account Active</p>
                          <p className="text-sm text-muted-foreground">You can create and manage products</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => navigate('/create-product')} className="flex-1">
                          Create Product
                        </Button>
                        <Button onClick={() => navigate('/seller-dashboard')} variant="outline" className="flex-1">
                          Seller Dashboard
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-medium mb-2">Benefits of Becoming a Seller:</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          <li>• List and sell your AI agents and software</li>
                          <li>• Manage your products and sales</li>
                          <li>• Track analytics and earnings</li>
                          <li>• Connect with buyers worldwide</li>
                        </ul>
                      </div>
                      <Button onClick={() => navigate('/seller-onboarding')} className="w-full">
                        Become a Seller
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="appearance">
            <AppearanceSettings />
          </TabsContent>

          <TabsContent value="privacy" className="space-y-6">
            <MessagePrivacySettings />
            <SidebarLayoutSettings />
          </TabsContent>

          <TabsContent value="blocked">
            <BlockedUsersSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
