import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Plus, Trash2, ShieldCheck, Info } from 'lucide-react';
import { toast } from 'sonner';
import { HourglassLoader } from '@/components/HourglassLoader';

type SpecType = 'api_key' | 'password' | 'oauth_token' | 'url' | 'text';
interface Spec {
  key: string;
  label: string;
  description?: string;
  type: SpecType;
  required: boolean;
}

export default function SellerSetupRequirements() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [windowHours, setWindowHours] = useState(48);
  const [specs, setSpecs] = useState<Spec[]>([]);

  useEffect(() => {
    (async () => {
      if (!id || !user) return;
      const { data, error } = await db
        .from('dkai_products')
        .select('id, seller_id, requires_setup_credentials, setup_requirements, setup_access_window_hours')
        .eq('id', id)
        .single();
      if (error || !data) { toast.error('Product not found'); navigate('/seller-products'); return; }
      if (data.seller_id !== user.id) { toast.error('Not your product'); navigate('/seller-products'); return; }
      setEnabled(!!data.requires_setup_credentials);
      setWindowHours(Number(data.setup_access_window_hours ?? 48));
      setSpecs(Array.isArray(data.setup_requirements) ? data.setup_requirements : []);
      setLoading(false);
    })();
  }, [id, user]);

  const addSpec = () => setSpecs(s => [...s, { key: '', label: '', description: '', type: 'api_key', required: true }]);
  const removeSpec = (i: number) => setSpecs(s => s.filter((_, idx) => idx !== i));
  const updateSpec = (i: number, patch: Partial<Spec>) => setSpecs(s => s.map((sp, idx) => idx === i ? { ...sp, ...patch } : sp));

  const save = async () => {
    if (enabled) {
      for (const sp of specs) {
        if (!sp.key.trim() || !sp.label.trim()) return toast.error('Each requirement needs a key and label');
        if (!/^[a-z0-9_]+$/.test(sp.key)) return toast.error(`Key "${sp.key}" must be lowercase letters, digits, underscore`);
      }
      const dup = specs.map(s => s.key).find((k, i, a) => a.indexOf(k) !== i);
      if (dup) return toast.error(`Duplicate key: ${dup}`);
    }
    setSaving(true);
    const { error } = await db.from('dkai_products').update({
      requires_setup_credentials: enabled,
      setup_requirements: enabled ? specs : [],
      setup_access_window_hours: Math.max(1, Math.min(168, windowHours)),
    }).eq('id', id!);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Setup requirements saved');
  };

  if (loading) return <AppLayout><div className="p-12 flex justify-center"><HourglassLoader size={64} /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="container max-w-3xl py-8 px-4 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Setup Requirements</h1>
          <p className="text-muted-foreground mt-1">Define what credentials or access the buyer must temporarily hand over so you can install and configure the product for them.</p>
        </div>

        <Alert>
          <ShieldCheck className="w-4 h-4" />
          <AlertDescription>
            Credentials are AES-256-GCM encrypted at rest, only decrypted server-side, and every access is logged and shown to the buyer. They auto-purge after your access window expires or once the buyer marks the handover complete.
          </AlertDescription>
        </Alert>

        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">This product requires temporary credentials</Label>
              <p className="text-sm text-muted-foreground">Enable if setup, deployment, or account access is needed.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {enabled && (
            <>
              <div className="grid gap-2">
                <Label>Access window (hours)</Label>
                <Input type="number" min={1} max={168} value={windowHours} onChange={e => setWindowHours(parseInt(e.target.value || '48', 10))} className="max-w-[160px]" />
                <p className="text-xs text-muted-foreground">Max 168h (7 days). Credentials auto-purge after this window.</p>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Required items</h3>
                  <Button size="sm" variant="outline" onClick={addSpec}><Plus className="w-4 h-4 mr-1" /> Add item</Button>
                </div>

                {specs.length === 0 && <p className="text-sm text-muted-foreground">No items yet — add at least one.</p>}

                {specs.map((sp, i) => (
                  <Card key={i} className="p-4 space-y-3 bg-muted/30">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <Label>Key (internal id)</Label>
                        <Input placeholder="openai_api_key" value={sp.key} onChange={e => updateSpec(i, { key: e.target.value.toLowerCase() })} />
                      </div>
                      <div>
                        <Label>Label shown to buyer</Label>
                        <Input placeholder="OpenAI API Key" value={sp.label} onChange={e => updateSpec(i, { label: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <Label>Instructions for the buyer</Label>
                      <Textarea rows={2} placeholder="Read-only key with GPT-4 access. Revoke after setup." value={sp.description || ''} onChange={e => updateSpec(i, { description: e.target.value })} />
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <Label>Type</Label>
                        <Select value={sp.type} onValueChange={(v: SpecType) => updateSpec(i, { type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="api_key">API Key</SelectItem>
                            <SelectItem value="password">Password</SelectItem>
                            <SelectItem value="oauth_token">OAuth Token</SelectItem>
                            <SelectItem value="url">URL / Webhook</SelectItem>
                            <SelectItem value="text">Text</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <label className="flex items-center gap-2 pt-6">
                        <Checkbox checked={sp.required} onCheckedChange={v => updateSpec(i, { required: v === true })} />
                        <span className="text-sm">Required</span>
                      </label>
                      <Button size="icon" variant="ghost" className="mt-6 text-destructive" onClick={() => removeSpec(i)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </Card>
                ))}
              </div>

              <Alert variant="default" className="bg-primary/5">
                <Info className="w-4 h-4" />
                <AlertDescription className="text-xs">
                  Ask only for what you strictly need. Prefer read-only, scoped, or short-lived tokens. Instruct buyers to rotate the credentials after handover.
                </AlertDescription>
              </Alert>
            </>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save</Button>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
