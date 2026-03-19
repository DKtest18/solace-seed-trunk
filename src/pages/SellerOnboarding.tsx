import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/dkaiDb';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, ArrowLeft, ArrowRight } from 'lucide-react';
import { RulesAcceptanceStep } from '@/components/RulesAcceptanceStep';

const COUNTRIES = [
  "Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda","Argentina","Armenia","Australia","Austria",
  "Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan",
  "Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi","Cabo Verde","Cambodia",
  "Cameroon","Canada","Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo (DRC)","Congo (Republic)",
  "Costa Rica","Croatia","Cuba","Cyprus","Czech Republic","Denmark","Djibouti","Dominica","Dominican Republic","East Timor",
  "Ecuador","Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia","Fiji","Finland",
  "France","Gabon","Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea",
  "Guinea-Bissau","Guyana","Haiti","Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq",
  "Ireland","Israel","Italy","Ivory Coast","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kiribati",
  "Kosovo","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein",
  "Lithuania","Luxembourg","Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Marshall Islands","Mauritania",
  "Mauritius","Mexico","Micronesia","Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar",
  "Namibia","Nauru","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Korea","North Macedonia",
  "Norway","Oman","Pakistan","Palau","Palestine","Panama","Papua New Guinea","Paraguay","Peru","Philippines",
  "Poland","Portugal","Qatar","Romania","Russia","Rwanda","Saint Kitts and Nevis","Saint Lucia","Saint Vincent and the Grenadines",
  "Samoa","San Marino","São Tomé and Príncipe","Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore",
  "Slovakia","Slovenia","Solomon Islands","Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan",
  "Suriname","Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand","Togo","Tonga",
  "Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Tuvalu","Uganda","Ukraine","United Arab Emirates","United Kingdom",
  "United States","Uruguay","Uzbekistan","Vanuatu","Vatican City","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"
];
import { RulesAcceptanceStep } from '@/components/RulesAcceptanceStep';

import QRCode from 'react-qr-code';
import { generateTOTPSecret, generateOTPAuthURI } from '@/utils/totp';

type OnboardingStep = 
  | 'age-verification' 
  | '2fa-setup' 
  | 'profile-setup' 
  | 'terms'
  | 'seller-rules'
  | 'complete';

export default function SellerOnboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [step, setStep] = useState<OnboardingStep>('age-verification');
  const [isLoading, setIsLoading] = useState(false);

  // Age verification fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthdate, setBirthdate] = useState('');
  
  // 2FA fields
  const [twoFASecret, setTwoFASecret] = useState('');
  const [twoFACode, setTwoFACode] = useState('');
  
  // Profile fields
  const [creatorName, setCreatorName] = useState('');
  const [bio, setBio] = useState('');
  const [country, setCountry] = useState('');
  
  // Terms
  const [termsAccepted, setTermsAccepted] = useState(false);

  const steps: OnboardingStep[] = [
    'age-verification',
    '2fa-setup',
    'profile-setup',
    'terms',
    'seller-rules'
  ];

  const currentStepIndex = steps.indexOf(step);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    const checkUserRole = async () => {
      const { data: roles } = await db
        .from('dkai_user_roles')
        .select('role')
        .eq('user_id', user.id);

      const isAdmin = roles?.some((r: any) => r.role === 'admin');
      
      if (isAdmin) {
        navigate('/admin');
        toast({
          title: "Admin Access",
          description: "You have full admin access and don't need to complete seller onboarding",
        });
        return;
      }
    };
    
    checkUserRole();
    
    const check2FAStatus = async () => {
      const { data: profile } = await db
        .from('dkai_profiles')
        .select('is_2fa_enabled')
        .eq('id', user.id)
        .single();
      
      if (profile?.is_2fa_enabled) {
        console.log('2FA already enabled, skipping setup step');
      } else {
        const secret = generateTOTPSecret();
        setTwoFASecret(secret);
      }
    };
    
    check2FAStatus();
  }, [user, navigate, toast]);

  const calculateAge = (birthdate: string): number => {
    const today = new Date();
    const birth = new Date(birthdate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  };

  const handleAgeVerification = async () => {
    if (!firstName.trim() || !lastName.trim() || !birthdate) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    const age = calculateAge(birthdate);
    if (age < 18) {
      toast({
        title: "Age Requirement Not Met",
        description: "You must be at least 18 years old to become a seller",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await db
        .from('dkai_profiles')
        .update({
          full_name: `${firstName} ${lastName}`,
          is_age_verified: true,
          age_verified_at: new Date().toISOString(),
        })
        .eq('id', user?.id);

      if (error) throw error;

      toast({
        title: "Age Verified",
        description: "Your age has been verified successfully",
      });
      
      const { data: profile } = await db
        .from('dkai_profiles')
        .select('is_2fa_enabled')
        .eq('id', user?.id)
        .single();
      
      if (profile?.is_2fa_enabled) {
        setStep('profile-setup');
        toast({
          title: "2FA Already Enabled",
          description: "Skipping 2FA setup as it's already configured",
        });
      } else {
        setStep('2fa-setup');
      }
    } catch (error) {
      console.error('Error verifying age:', error);
      toast({
        title: "Error",
        description: "Failed to verify age",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FASetup = async () => {
    if (!twoFACode) {
      toast({
        title: "Missing Code",
        description: "Please enter the 6-digit code from your authenticator app",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('enable-2fa', {
        body: { secret: twoFASecret, code: twoFACode }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "2FA Enabled",
        description: "Two-factor authentication has been set up successfully",
      });
      
      setTwoFASecret('');
      setStep('profile-setup');
    } catch (error: any) {
      console.error('Error setting up 2FA:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to set up 2FA",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileSetup = async () => {
    if (!creatorName.trim() || !country.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await db
        .from('dkai_profiles')
        .update({
          creator_name: creatorName,
          bio: bio,
          country: country,
        })
        .eq('id', user?.id);

      if (error) throw error;

      toast({
        title: "Profile Updated",
        description: "Your profile has been set up successfully",
      });
      
      setStep('terms');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTermsAcceptance = async () => {
    if (!termsAccepted) {
      toast({
        title: "Terms Required",
        description: "You must accept the terms and conditions",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Create seller application with dkai_ prefix
      const { error: applicationError } = await db
        .from('dkai_seller_applications')
        .upsert({
          user_id: user?.id,
          first_name: firstName,
          last_name: lastName,
          creator_name: creatorName,
          bio: bio,
          country: country,
          status: 'approved',
          applied_at: new Date().toISOString(),
        });

      if (applicationError) throw applicationError;

      const { error: profileError } = await db
        .from('dkai_profiles')
        .update({
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString(),
          seller_verification_status: 'approved',
          seller_application_status: 'approved',
        })
        .eq('id', user?.id);

      if (profileError) throw profileError;

      toast({
        title: "Terms Accepted",
        description: "Your seller application has been approved.",
      });
      
      setStep('seller-rules');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast({
        title: "Error",
        description: "Failed to complete onboarding",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const goBack = () => {
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'age-verification':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Age Verification</CardTitle>
              <CardDescription>
                You must be at least 18 years old to become a seller
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter your first name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Enter your last name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthdate">Date of Birth</Label>
                <Input
                  id="birthdate"
                  type="date"
                  value={birthdate}
                  onChange={(e) => setBirthdate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
              <Button 
                onClick={handleAgeVerification} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        );

      case '2fa-setup':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Two-Factor Authentication Setup</CardTitle>
              <CardDescription>
                Scan the QR code with your authenticator app and enter the 6-digit code
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center space-y-4">
                <div className="p-6 bg-white rounded-lg">
                  <QRCode
                    value={generateOTPAuthURI(user?.email || '', twoFASecret)}
                    size={200}
                  />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Scan this QR code with Google Authenticator, Authy, or any compatible authenticator app
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="twoFACode">Enter 6-Digit Code</Label>
                <Input
                  id="twoFACode"
                  value={twoFACode}
                  onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={goBack} className="flex-1">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button 
                  onClick={handle2FASetup} 
                  disabled={isLoading || twoFACode.length !== 6}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      Verify & Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 'profile-setup':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Profile Setup</CardTitle>
              <CardDescription>
                Tell us about yourself and your business
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="creatorName">Creator/Business Name *</Label>
                <Input
                  id="creatorName"
                  value={creatorName}
                  onChange={(e) => setCreatorName(e.target.value)}
                  placeholder="Your creator or business name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Input
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself (optional)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country *</Label>
                <Input
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Your country"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={goBack} className="flex-1">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button 
                  onClick={handleProfileSetup} 
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 'terms':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Terms and Conditions</CardTitle>
              <CardDescription>Please review and accept our terms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-96 overflow-y-auto border rounded-lg p-4 space-y-4 text-sm">
                <h3 className="font-semibold">DK AI Marketplace Seller Agreement</h3>
                <div><h4 className="font-semibold">1. Acceptance of Terms</h4><p className="text-muted-foreground">By registering as a seller on DK AI Marketplace, you agree to comply with all terms and conditions outlined in this agreement.</p></div>
                <div><h4 className="font-semibold">2. Seller Eligibility</h4><p className="text-muted-foreground">You must be at least 18 years old and have the legal capacity to enter into binding contracts.</p></div>
                <div><h4 className="font-semibold">3. Product Requirements</h4><p className="text-muted-foreground">All AI products must be original or properly licensed. Products must not infringe on intellectual property rights.</p></div>
                <div><h4 className="font-semibold">4. Pricing and Payments</h4><p className="text-muted-foreground">Sellers set their own prices. DK AI Marketplace charges a 10% commission fee on each sale via Stripe Connect.</p></div>
                <div><h4 className="font-semibold">5. Product Moderation</h4><p className="text-muted-foreground">All products are subject to approval by administrators.</p></div>
                <div><h4 className="font-semibold">6. Refund Policy</h4><p className="text-muted-foreground">Sellers must honor their stated refund policies. Minimum 24h return window.</p></div>
                <div><h4 className="font-semibold">7. Data Protection</h4><p className="text-muted-foreground">We comply with GDPR and applicable data protection laws.</p></div>
                <div><h4 className="font-semibold">8. Termination</h4><p className="text-muted-foreground">We may terminate your seller account for violations. You may terminate at any time.</p></div>
                <div><h4 className="font-semibold">9. Contact</h4><p className="text-muted-foreground">For questions, contact support@dkaimarketplace.com</p></div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="terms"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                />
                <label htmlFor="terms" className="text-sm font-medium leading-none">
                  I accept the terms and conditions
                </label>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={goBack} className="flex-1">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button 
                  onClick={handleTermsAcceptance} 
                  disabled={isLoading || !termsAccepted}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      Submit Application
                      <CheckCircle2 className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 'seller-rules':
        return (
          <RulesAcceptanceStep
            ruleType="seller"
            loading={isLoading}
            onBack={goBack}
            onAccept={async () => {
              setIsLoading(true);
              try {
                toast({
                  title: "Seller Rules Accepted",
                  description: "You have accepted all seller obligations.",
                });
                setStep('complete');
              } catch (error) {
                console.error('Error accepting seller rules:', error);
                toast({
                  title: "Error",
                  description: "Failed to accept seller rules.",
                  variant: "destructive",
                });
              } finally {
                setIsLoading(false);
              }
            }}
          />
        );

      case 'complete':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                Setup Complete!
              </CardTitle>
              <CardDescription>Your seller account is ready</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Your seller account has been activated. You can now:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>List and sell your AI products</li>
                <li>Track your sales and earnings</li>
                <li>Manage your product catalog</li>
                <li>Set up Stripe Connect for payments</li>
              </ul>
              <div className="flex gap-2">
                <Button onClick={() => navigate('/seller-onboarding/payment')} className="flex-1">
                  Set Up Payments
                </Button>
                <Button variant="outline" onClick={() => navigate('/seller-dashboard')} className="flex-1">
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/seller-onboarding')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Checklist
          </Button>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Seller Onboarding</h1>
          <p className="text-muted-foreground">
            Complete all steps to become a verified seller
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {renderStep()}
      </div>
    </div>
  );
}
