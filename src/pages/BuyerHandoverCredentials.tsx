import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/dkaiDb';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ShieldAlert, ShieldCheck, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { HourglassLoader } from '@/components/HourglassLoader';

interface Spec { key: string; label: string; description?: string; type: string; required: boolean; }

export default function BuyerHandoverCredentials() {
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [product, setProduct] = useState<any>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    (async () => {
      if (!orderId || !user) return;
      const { data: o, error } = await db.from('dkai_orders').select('*').eq('id', orderId).single();
      if (error || !o) { toast.error('Order not found'); navigate('/purchases'); return; }
      if (o.buyer_id !== user.id) { toast.error('Not your order'); navigate('/purchases'); return; }
      setOrder(o);
      const { data: p } = await db.from('dkai_products').select('id, title, seller_id, requires_setup_credentials, setup_requirements, setup_access_window_hours').eq('id', o.product_id).single();
      setProduct(p);
      setLoading(false);
    })();
  }, [orderId, user]);

  const specs: Spec[] = useMemo(() => Array.isArray(product?.setup_requirements) ? product.setup_requirements : [], [product]);

  const submit = async () => {
    if (!acknowledged) return toast.error('Please confirm the security acknowledgement');
    for (const s of specs) {
      if (s.required && !values[s.key]?.trim()) return toast.error(`${s.label} is required`);
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke('submit-handover-credentials', {
      body: { order_id: orderId, values },
    });
    setSubmitting(false);
    if (error || !data?.success) return toast.error(data?.error || error?.message || 'Submission failed');
    toast.success('Credentials submitted securely');
    navigate('/purchases');
  };

  if (loading) return <AppLayout><div className="p-12 flex justify-center"><HourglassLoader size={64} /></div></AppLayout>;
  if (!product?.requires_setup_credentials) {
    return <AppLayout><div className="container max-w-2xl py-8"><Alert><AlertDescription>This product does not require credential handover.</AlertDescription></Alert></div></AppLayout>;
  }

  const windowH = product.setup_access_window_hours ?? 48;

  return (
    <AppLayout>
      <div className="container max-w-2xl py-8 px-4 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Secure Credential Handover</h1>
          <p className="text-muted-foreground mt-1">{product.title}</p>
        </div>

        <Alert variant="destructive" className="border-destructive/50">
          <ShieldAlert className="w-4 h-4" />
          <AlertDescription className="text-sm">
            <strong>Read this carefully.</strong> You are about to share sensitive access credentials with the seller so they can set up the product for you.
            <ul className="list-disc pl-5 mt-2 space-y-1 text-xs">
              <li>Credentials are AES-256 encrypted and only decrypted server-side.</li>
              <li>The seller can access them for <strong>{windowH} hours</strong> from now. Every access is logged and visible to you.</li>
              <li>Prefer <strong>read-only</strong>, <strong>scoped</strong>, and <strong>short-lived</strong> tokens where possible.</li>
              <li><strong>Rotate or revoke</strong> every credential immediately after handover is complete.</li>
              <li>DK AI Marketplace is not liable for damage caused by shared credentials that were not scoped or rotated as instructed.</li>
            </ul>
          </AlertDescription>
        </Alert>

        <Card className="p-6 space-y-4">
          {specs.map(s => (
            <div key={s.key} className="space-y-1">
              <Label className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5" /> {s.label}{s.required && <span className="text-destructive">*</span>}
              </Label>
              {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
              <Input
                type={s.type === 'password' || s.type === 'api_key' || s.type === 'oauth_token' ? 'password' : 'text'}
                value={values[s.key] || ''}
                onChange={e => setValues(v => ({ ...v, [s.key]: e.target.value }))}
                autoComplete="off"
              />
            </div>
          ))}

          <label className="flex items-start gap-2 pt-3 border-t cursor-pointer">
            <Checkbox checked={acknowledged} onCheckedChange={v => setAcknowledged(v === true)} className="mt-0.5" />
            <span className="text-xs text-muted-foreground">
              I confirm I understand the risks, will rotate/revoke these credentials after setup, and have used the least-privileged scope possible.
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={() => navigate('/purchases')}>Cancel</Button>
            <Button onClick={submit} disabled={submitting || !acknowledged}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <ShieldCheck className="w-4 h-4 mr-2" />
              Submit securely
            </Button>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
