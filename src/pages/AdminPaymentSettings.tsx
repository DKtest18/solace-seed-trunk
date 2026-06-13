import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, Building, CheckCircle, XCircle, Shield, Settings, CreditCard } from "lucide-react";
import { useHasRole } from "@/hooks/useUserRole";
import { IOSToggle } from "@/components/ui/ios-toggle";

export default function AdminPaymentSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { hasRole: isAdmin, isLoading: roleLoading } = useHasRole("admin");
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  
  // Form state
  const [adminIban, setAdminIban] = useState("");
  const [adminAccountHolder, setAdminAccountHolder] = useState("");
  const [provider, setProvider] = useState("stripe");
  const [providerMode, setProviderMode] = useState("test");
  const [cardPaymentsGloballyEnabled, setCardPaymentsGloballyEnabled] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    
    if (!roleLoading && !isAdmin) {
      toast.error("Only admins can access platform payment settings");
      navigate("/");
      return;
    }
    
    if (isAdmin) {
      fetchSettings();
    }
  }, [user, isAdmin, roleLoading]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("platform_payment_settings")
        .select("*")
        .eq("id", "platform_payments")
        .single();

      if (error && error.code !== "PGRST116") throw error;
      
      if (data) {
        setSettings(data);
        setProvider(data.provider || "stripe");
        setProviderMode(data.provider_mode || "test");
        setCardPaymentsGloballyEnabled(data.card_payments_globally_enabled ?? true);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAdminIban = async () => {
    if (!adminIban.trim()) {
      toast.error("Please enter an IBAN");
      return;
    }

    setSaving(true);
    try {
      // Use edge function to encrypt and save admin IBAN
      const { data, error } = await supabase.functions.invoke("save-admin-payment-config", {
        body: {
          admin_iban: adminIban.trim(),
          admin_account_holder: adminAccountHolder.trim() || undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Admin IBAN saved successfully!");
      setAdminIban("");
      setAdminAccountHolder("");
      await fetchSettings();
    } catch (error: any) {
      console.error("Error saving admin IBAN:", error);
      toast.error(error.message || "Failed to save IBAN");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("platform_payment_settings")
        .upsert({
          id: "platform_payments",
          provider,
          provider_mode: providerMode,
          card_payments_globally_enabled: cardPaymentsGloballyEnabled,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast.success("Settings updated successfully!");
      await fetchSettings();
    } catch (error: any) {
      console.error("Error updating settings:", error);
      toast.error(error.message || "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivateAdminIban = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("platform_payment_settings")
        .update({
          admin_iban_encrypted: null,
          admin_iban_masked: null,
          admin_account_holder: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", "platform_payments");

      if (error) throw error;

      toast.success("Admin IBAN deactivated. Sellers will receive 100% of payments.");
      await fetchSettings();
    } catch (error: any) {
      console.error("Error deactivating admin IBAN:", error);
      toast.error(error.message || "Failed to deactivate IBAN");
    } finally {
      setSaving(false);
    }
  };

  if (loading || roleLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container max-w-3xl mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-2">Platform Payment Settings</h1>
        <p className="text-muted-foreground mb-8">
          Configure platform-wide payment settings and admin IBAN for fee collection
        </p>

        {/* Security Notice */}
        <Alert className="mb-6">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Admin IBAN is encrypted and stored securely. The platform fee (default 5%) is sent to this IBAN.
            If no admin IBAN is set, sellers receive 100% of payments.
          </AlertDescription>
        </Alert>

        {/* Admin IBAN Status */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Platform Fee Account
            </CardTitle>
            <CardDescription>
              Configure the bank account for collecting platform fees
            </CardDescription>
          </CardHeader>
          <CardContent>
            {settings?.admin_iban_masked ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium">Admin IBAN Connected</p>
                      <p className="text-sm text-muted-foreground font-mono">{settings.admin_iban_masked}</p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleDeactivateAdminIban}
                    disabled={saving}
                  >
                    Deactivate
                  </Button>
                </div>
                <p className="text-sm text-green-600 dark:text-green-400">
                  ✓ The platform fee (default 5%) of card payments is sent to this account
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                  <XCircle className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="font-medium">No Admin IBAN configured</p>
                    <p className="text-sm text-muted-foreground">Sellers currently receive 100% of payments</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add/Update Admin IBAN */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{settings?.admin_iban_masked ? "Update Admin IBAN" : "Add Admin IBAN"}</CardTitle>
            <CardDescription>
              Set the bank account for collecting platform fees
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adminIban">Admin IBAN</Label>
              <Input
                id="adminIban"
                placeholder="DE89 3704 0044 0532 0130 00"
                value={adminIban}
                onChange={(e) => setAdminIban(e.target.value.toUpperCase())}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminAccountHolder">Account Holder Name (optional)</Label>
              <Input
                id="adminAccountHolder"
                placeholder="Platform Inc."
                value={adminAccountHolder}
                onChange={(e) => setAdminAccountHolder(e.target.value)}
              />
            </div>

            <Button onClick={handleSaveAdminIban} disabled={saving || !adminIban.trim()}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                settings?.admin_iban_masked ? "Update IBAN" : "Save IBAN"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Provider Settings */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Payment Provider
            </CardTitle>
            <CardDescription>
              Configure the payment provider and mode
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="payrexx">Payrexx</SelectItem>
                  <SelectItem value="wallee">Wallee</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="providerMode">Mode</Label>
              <Select value={providerMode} onValueChange={setProviderMode}>
                <SelectTrigger>
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="test">Test Mode</SelectItem>
                  <SelectItem value="live">Live Mode</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Use test mode for development, live mode for real payments
              </p>
            </div>

            <Button onClick={handleUpdateSettings} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Update Provider Settings"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Global Card Payments Toggle */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Global Card Payments
            </CardTitle>
            <CardDescription>
              Enable or disable card payments platform-wide
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="space-y-1">
                <p className="font-medium">Card Payments Globally Enabled</p>
                <p className="text-sm text-muted-foreground">
                  When disabled, no one can make card payments regardless of seller settings
                </p>
              </div>
              <IOSToggle
                checked={cardPaymentsGloballyEnabled}
                onCheckedChange={(checked) => {
                  setCardPaymentsGloballyEnabled(checked);
                  handleUpdateSettings();
                }}
                disabled={saving}
                size="md"
              />
            </div>

            {!cardPaymentsGloballyEnabled && (
              <Alert className="mt-4" variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  Card payments are currently disabled platform-wide. Buyers can only use invoice method.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
