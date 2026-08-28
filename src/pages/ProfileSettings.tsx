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
import { Shield, Copy, Download, Store, CheckCircle, Globe, User, Lock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import QRCode from 'react-qr-code';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useHasRole } from '@/hooks/useUserRole';


import { AccountDeletionSettings } from '@/components/settings/AccountDeletionSettings';
import { PrivacyDataSettings } from '@/components/settings/PrivacyDataSettings';
import { TwoFactorSettings } from '@/components/security/TwoFactorSettings';
import { HourglassLoader } from '@/components/HourglassLoader';

export default function ProfileSettings() {
  const { user } = useAuth();
  const { hasRole: isSeller, isLoading: roleLoading } = useHasRole('seller');
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);

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


  const tabs = [
    { value: 'profile', label: 'Profile', icon: User },
    { value: 'security', label: 'Security', icon: Shield },
    { value: 'privacy-data', label: 'Privacy & Data', icon: Shield },
    { value: 'data', label: 'Account', icon: Lock },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-semibold mb-2">Settings</h1>
          <p className="text-muted-foreground">Manage your account, profile, and preferences.</p>
        </div>

        <Tabs defaultValue="profile" className="grid lg:grid-cols-[240px_1fr] gap-8">
          <TabsList className="h-auto bg-transparent p-0 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible justify-start">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="w-full justify-start gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-muted data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-medium data-[state=active]:shadow-none"
                >
                  <Icon className="h-4 w-4" />
                  <span>{t.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="min-w-0">
          <TabsContent value="security" className="mt-0 space-y-6">
            <TwoFactorSettings />
          </TabsContent>

          <TabsContent value="profile" className="mt-0 space-y-6">
            <Card className="bg-white border border-border rounded-xl p-6 shadow-none">
              <CardHeader className="p-0 mb-6">
                <CardTitle className="font-display text-xl font-semibold mb-1">Profile Information</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Update your personal information
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Email</Label>
                    <Input value={user.email} disabled />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Full Name</Label>
                    <Input value={profile?.full_name || ''} disabled />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Username</Label>
                    <Input value={profile?.username || 'Not set'} disabled />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Your Time Zone
                    </Label>
                    <Select 
                      value={profile?.timezone || 'Europe/Zurich'} 
                      onValueChange={async (value) => {
                        const { error } = await db
                          .from('dkai_profiles')
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
                  <div className="flex justify-end pt-2">
                    <Button onClick={() => navigate('/profile')}>
                      Edit Profile
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border border-border rounded-xl p-6 shadow-none">
              <CardHeader className="p-0 mb-6">
                <CardTitle className="font-display text-xl font-semibold mb-1 flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  Seller Account
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  {isSeller 
                    ? 'You have access to sell products on the marketplace'
                    : 'Upgrade to start selling your AI agents and software'}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {roleLoading ? (
                  <div className="text-center py-4">
                    <HourglassLoader size={64} />
                  </div>
                ) : isSeller ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 border border-border rounded-lg bg-muted/40">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <div className="flex-1">
                        <p className="font-medium text-foreground">Seller Account Active</p>
                        <p className="text-sm text-muted-foreground">You can create and manage products</p>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button onClick={() => navigate('/seller-dashboard')} variant="outline">
                        Seller Dashboard
                      </Button>
                      <Button onClick={() => navigate('/create-product')}>
                        Create Product
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 border border-border rounded-lg bg-muted/40">
                      <h4 className="font-medium mb-2">Benefits of Becoming a Seller</h4>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li>• List and sell your AI agents and software</li>
                        <li>• Manage your products and sales</li>
                        <li>• Track analytics and earnings</li>
                        
                      </ul>
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={() => navigate('/seller-onboarding')}>
                        Become a Seller
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="data" className="mt-0">
            <AccountDeletionSettings />
          </TabsContent>

          <TabsContent value="privacy-data" className="mt-0">
            <PrivacyDataSettings />
          </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
