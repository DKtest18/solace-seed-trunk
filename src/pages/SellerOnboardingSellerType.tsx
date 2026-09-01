import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/dkaiDb';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CountryCombobox } from '@/components/CountryCombobox';
import { useToast } from '@/hooks/use-toast';
import { HourglassLoader } from '@/components/HourglassLoader';
import { resolveNextOnboardingRoute } from '@/lib/sellerOnboardingNav';
import { Building2, User as UserIcon, ArrowLeft, Loader2 } from 'lucide-react';
import {
  LEGAL_FORMS,
  registrationNumberLabelKey,
  validateRegistrationNumber,
  type SellerTypeValue,
} from '@/lib/sellerType';

/**
 * First step of "Become a Seller": private seller vs. company.
 * Company details are collected for our own records only — nothing here is
 * verified against a registry, and Stripe Connect onboarding is untouched.
 */
export default function SellerOnboardingSellerType() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [initializing, setInitializing] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sellerType, setSellerType] = useState<SellerTypeValue | null>(null);
  const [hadSavedType, setHadSavedType] = useState(false);
  const [form, setForm] = useState({
    company_legal_name: '',
    company_legal_form: '',
    company_registration_country: '',
    company_registration_number: '',
    company_address: '',
    company_representative_name: '',
    company_contact_email: '',
  });
  const [regError, setRegError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    (async () => {
      try {
        const { data } = await db
          .from('dkai_seller_applications')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        const row = data as any;
        if (row?.seller_type) {
          setSellerType(row.seller_type);
          setHadSavedType(true);
        }
        if (row) {
          setForm({
            company_legal_name: row.company_legal_name || '',
            company_legal_form: row.company_legal_form || '',
            company_registration_country: row.company_registration_country || row.country || '',
            company_registration_number: row.company_registration_number || '',
            company_address: row.company_address || '',
            company_representative_name: row.company_representative_name || '',
            company_contact_email: row.company_contact_email || '',
          });
        }
      } catch (error) {
        console.error('[onboarding/seller-type] load error:', error);
      } finally {
        setInitializing(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const set = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const companyValid = () =>
    !!(
      form.company_legal_name.trim() &&
      form.company_legal_form &&
      form.company_registration_country &&
      form.company_registration_number.trim() &&
      form.company_address.trim() &&
      form.company_representative_name.trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.company_contact_email.trim())
    );

  const handleSave = async () => {
    if (!user || !sellerType) return;

    if (sellerType === 'company') {
      const check = validateRegistrationNumber(
        form.company_registration_country,
        form.company_registration_number,
      );
      if (!check.valid) {
        setRegError(t('sellerType.errors.invalidUid'));
        return;
      }
      setRegError(null);
      if (!companyValid()) {
        toast({
          title: t('sellerType.errors.missingTitle'),
          description: t('sellerType.errors.missingBody'),
          variant: 'destructive',
        });
        return;
      }
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id;
    if (!uid) {
      toast({ title: t('sellerType.errors.signedOut'), variant: 'destructive' });
      return;
    }

    const nowIso = new Date().toISOString();
    const payload: Record<string, any> =
      sellerType === 'company'
        ? {
            seller_type: 'company',
            company_legal_name: form.company_legal_name.trim(),
            company_legal_form: form.company_legal_form,
            company_registration_country: form.company_registration_country,
            company_registration_number: form.company_registration_number.trim(),
            company_address: form.company_address.trim(),
            company_representative_name: form.company_representative_name.trim(),
            company_contact_email: form.company_contact_email.trim(),
            seller_type_updated_at: nowIso,
            updated_at: nowIso,
          }
        : { seller_type: 'private', seller_type_updated_at: nowIso, updated_at: nowIso };

    setSaving(true);
    try {
      const { data: existing } = await db
        .from('dkai_seller_applications')
        .select('id')
        .eq('user_id', uid)
        .maybeSingle();

      if (existing) {
        const { error } = await db
          .from('dkai_seller_applications')
          .update(payload)
          .eq('user_id', uid);
        if (error) throw error;
      } else {
        let { error } = await db
          .from('dkai_seller_applications')
          .insert({ user_id: uid, status: 'draft', applied_at: nowIso, ...payload });
        if (error) {
          // Some deployments have NOT NULL name columns on the application row;
          // retry with empty placeholders that the identity step then fills in.
          const retry = await db.from('dkai_seller_applications').insert({
            user_id: uid,
            status: 'draft',
            applied_at: nowIso,
            first_name: '',
            last_name: '',
            creator_name: '',
            ...payload,
          });
          error = retry.error;
        }
        if (error) throw error;
      }

      await queryClient.invalidateQueries({ queryKey: ['seller-onboarding-progress'] });
      toast({ title: t('sellerType.saved') });
      const next = await resolveNextOnboardingRoute(queryClient, uid, 'seller-type');
      navigate(next);
    } catch (error: any) {
      console.error('[onboarding/seller-type] save error:', error);
      toast({
        title: t('sellerType.errors.saveFailed'),
        description: error?.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (initializing) {
    return (
      <div className="flex items-center justify-center py-16">
        <HourglassLoader size={128} />
      </div>
    );
  }

  const isCh = form.company_registration_country === 'CH' ||
    form.company_registration_country?.toLowerCase() === 'switzerland' ||
    form.company_registration_country?.toLowerCase() === 'schweiz';

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <Button variant="ghost" onClick={() => navigate('/seller-onboarding')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        {t('common.back', 'Back')}
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{t('sellerType.title')}</CardTitle>
          <CardDescription>{t('sellerType.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setSellerType('private')}
              className={`rounded-lg border p-4 text-left transition-colors hover:border-primary ${
                sellerType === 'private' ? 'border-primary bg-primary/5' : ''
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <UserIcon className="h-4 w-4 text-primary" />
                {t('sellerType.options.private')}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {t('sellerType.options.privateDescription')}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSellerType('company')}
              className={`rounded-lg border p-4 text-left transition-colors hover:border-primary ${
                sellerType === 'company' ? 'border-primary bg-primary/5' : ''
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Building2 className="h-4 w-4 text-primary" />
                {t('sellerType.options.company')}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {t('sellerType.options.companyDescription')}
              </span>
            </button>
          </div>

          {hadSavedType && (
            <Alert>
              <AlertDescription className="text-sm">{t('sellerType.changeNote')}</AlertDescription>
            </Alert>
          )}

          {sellerType === 'private' && (
            <p className="text-sm text-muted-foreground">{t('sellerType.privateNothingExtra')}</p>
          )}

          {sellerType === 'company' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="legal-name">{t('sellerType.fields.legalName')}</Label>
                <Input
                  id="legal-name"
                  value={form.company_legal_name}
                  onChange={(e) => set('company_legal_name', e.target.value)}
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('sellerType.fields.legalForm')}</Label>
                <Select
                  value={form.company_legal_form}
                  onValueChange={(v) => set('company_legal_form', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('sellerType.fields.legalFormPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {LEGAL_FORMS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {t(`sellerType.legalForms.${f}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('sellerType.fields.registrationCountry')}</Label>
                <CountryCombobox
                  value={form.company_registration_country}
                  onChange={(v) => set('company_registration_country', v)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-number">
                  {t(registrationNumberLabelKey(form.company_registration_country))}
                </Label>
                <Input
                  id="reg-number"
                  value={form.company_registration_number}
                  onChange={(e) => {
                    set('company_registration_number', e.target.value);
                    setRegError(null);
                  }}
                  placeholder={isCh ? 'CHE-123.456.789' : ''}
                  maxLength={100}
                />
                {regError && <p className="text-sm text-destructive">{regError}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="company-address">{t('sellerType.fields.address')}</Label>
                <Textarea
                  id="company-address"
                  value={form.company_address}
                  onChange={(e) => set('company_address', e.target.value)}
                  maxLength={500}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="representative">{t('sellerType.fields.representative')}</Label>
                <Input
                  id="representative"
                  value={form.company_representative_name}
                  onChange={(e) => set('company_representative_name', e.target.value)}
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="business-email">{t('sellerType.fields.contactEmail')}</Label>
                <Input
                  id="business-email"
                  type="email"
                  value={form.company_contact_email}
                  onChange={(e) => set('company_contact_email', e.target.value)}
                  maxLength={255}
                />
              </div>

              <p className="text-xs text-muted-foreground">{t('sellerType.noRegistryCheck')}</p>
            </div>
          )}

          <Button onClick={handleSave} disabled={!sellerType || saving} className="w-full sm:w-auto">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('sellerType.save')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
