import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2, Building2, Download, FileText } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

interface OrgBillingSettingsProps {
  orgId: string;
  isAdmin: boolean;
}

interface BillingProfile {
  org_id: string;
  legal_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  vat_id: string | null;
  billing_email: string | null;
  currency_preference: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  amount_cents: number;
  currency: string;
  issued_at: string;
  paid_at: string | null;
  pdf_storage_path: string | null;
}

const COUNTRIES = [
  { code: 'DE', name: 'Germany' },
  { code: 'AT', name: 'Austria' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'ES', name: 'Spain' },
  { code: 'PT', name: 'Portugal' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
];

const CURRENCIES = [
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
];

export function OrgBillingSettings({ orgId, isAdmin }: OrgBillingSettingsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState<string | null>(null);

  const [form, setForm] = useState<BillingProfile>({
    org_id: orgId,
    legal_name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    postal_code: '',
    country: '',
    vat_id: '',
    billing_email: '',
    currency_preference: 'EUR'
  });

  // Fetch billing profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['org-billing-profile', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_billing_profiles')
        .select('*')
        .eq('org_id', orgId)
        .maybeSingle();

      if (error) throw error;
      return data as BillingProfile | null;
    }
  });

  // Fetch invoices
  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['org-invoices', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('org_id', orgId)
        .order('issued_at', { ascending: false });

      if (error) throw error;
      return data as Invoice[];
    }
  });

  // Update form when profile loads
  useEffect(() => {
    if (profile) {
      setForm({
        ...profile,
        legal_name: profile.legal_name || '',
        address_line1: profile.address_line1 || '',
        address_line2: profile.address_line2 || '',
        city: profile.city || '',
        postal_code: profile.postal_code || '',
        country: profile.country || '',
        vat_id: profile.vat_id || '',
        billing_email: profile.billing_email || '',
        currency_preference: profile.currency_preference || 'EUR'
      });
    }
  }, [profile]);

  const handleSave = async () => {
    if (!isAdmin) {
      toast.error('Only admins can edit billing settings');
      return;
    }

    setSaving(true);
    try {
      if (profile) {
        // Update
        const { error } = await supabase
          .from('organization_billing_profiles')
          .update({
            legal_name: form.legal_name || null,
            address_line1: form.address_line1 || null,
            address_line2: form.address_line2 || null,
            city: form.city || null,
            postal_code: form.postal_code || null,
            country: form.country || null,
            vat_id: form.vat_id || null,
            billing_email: form.billing_email || null,
            currency_preference: form.currency_preference || 'EUR'
          })
          .eq('org_id', orgId);

        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from('organization_billing_profiles')
          .insert({
            org_id: orgId,
            legal_name: form.legal_name || null,
            address_line1: form.address_line1 || null,
            address_line2: form.address_line2 || null,
            city: form.city || null,
            postal_code: form.postal_code || null,
            country: form.country || null,
            vat_id: form.vat_id || null,
            billing_email: form.billing_email || null,
            currency_preference: form.currency_preference || 'EUR'
          });

        if (error) throw error;
      }

      toast.success('Billing profile saved');
      queryClient.invalidateQueries({ queryKey: ['org-billing-profile', orgId] });
    } catch (err: any) {
      console.error('Error saving billing profile:', err);
      toast.error(err.message || 'Failed to save billing profile');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadInvoice = async (invoiceId: string) => {
    setDownloadingInvoice(invoiceId);
    try {
      const { data, error } = await supabase.functions.invoke('get-invoice-url', {
        body: { invoice_id: invoiceId }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Open the signed URL in a new tab
      window.open(data.url, '_blank');
    } catch (err: any) {
      console.error('Error downloading invoice:', err);
      toast.error(err.message || 'Failed to download invoice');
    } finally {
      setDownloadingInvoice(null);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'issued':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'refunded':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'void':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Billing Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Billing Profile
          </CardTitle>
          <CardDescription>
            Configure your organization's billing details for invoices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {profileLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="legal_name">Legal Company Name</Label>
                  <Input
                    id="legal_name"
                    value={form.legal_name || ''}
                    onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
                    placeholder="Acme Inc."
                    disabled={!isAdmin}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billing_email">Billing Email</Label>
                  <Input
                    id="billing_email"
                    type="email"
                    value={form.billing_email || ''}
                    onChange={(e) => setForm({ ...form, billing_email: e.target.value })}
                    placeholder="billing@acme.com"
                    disabled={!isAdmin}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address_line1">Address Line 1</Label>
                  <Input
                    id="address_line1"
                    value={form.address_line1 || ''}
                    onChange={(e) => setForm({ ...form, address_line1: e.target.value })}
                    placeholder="123 Main Street"
                    disabled={!isAdmin}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address_line2">Address Line 2</Label>
                  <Input
                    id="address_line2"
                    value={form.address_line2 || ''}
                    onChange={(e) => setForm({ ...form, address_line2: e.target.value })}
                    placeholder="Suite 100"
                    disabled={!isAdmin}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={form.city || ''}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="Berlin"
                    disabled={!isAdmin}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="postal_code">Postal Code</Label>
                  <Input
                    id="postal_code"
                    value={form.postal_code || ''}
                    onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                    placeholder="10115"
                    disabled={!isAdmin}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Select
                    value={form.country || ''}
                    onValueChange={(v) => setForm({ ...form, country: v })}
                    disabled={!isAdmin}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vat_id">VAT ID (optional)</Label>
                  <Input
                    id="vat_id"
                    value={form.vat_id || ''}
                    onChange={(e) => setForm({ ...form, vat_id: e.target.value })}
                    placeholder="DE123456789"
                    disabled={!isAdmin}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Preferred Currency</Label>
                  <Select
                    value={form.currency_preference || 'EUR'}
                    onValueChange={(v) => setForm({ ...form, currency_preference: v })}
                    disabled={!isAdmin}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.symbol} {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isAdmin && (
                <Button onClick={handleSave} disabled={saving} className="mt-4">
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Billing Profile'
                  )}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoices
          </CardTitle>
          <CardDescription>
            View and download your organization's invoices
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoicesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : invoices && invoices.length > 0 ? (
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div 
                  key={invoice.id} 
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{invoice.invoice_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(invoice.issued_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-medium">
                        {(invoice.amount_cents / 100).toFixed(2)} {invoice.currency}
                      </p>
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadgeClass(invoice.status)}`}>
                        {invoice.status}
                      </span>
                    </div>
                    
                    {invoice.pdf_storage_path && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadInvoice(invoice.id)}
                        disabled={downloadingInvoice === invoice.id}
                      >
                        {downloadingInvoice === invoice.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No invoices yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
