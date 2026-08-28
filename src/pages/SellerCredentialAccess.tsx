import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/dkaiDb';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, EyeOff, Trash2, ShieldCheck, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { HourglassLoader } from '@/components/HourglassLoader';

export default function SellerCredentialAccess() {
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [handovers, setHandovers] = useState<any[]>([]);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revealing, setRevealing] = useState<string | null>(null);
  const [order, setOrder] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [purging, setPurging] = useState(false);

  const load = async () => {
    if (!orderId || !user) return;
    const { data: o } = await db.from('dkai_orders').select('*').eq('id', orderId).single();
    if (!o || o.seller_id !== user.id) { toast.error('Not your order'); navigate('/seller-orders'); return; }
    setOrder(o);
    const { data: h } = await db.from('dkai_credential_handovers').select('*').eq('order_id', orderId).order('spec_label');
    setHandovers(h || []);
    const { data: l } = await db.from('dkai_credential_access_log').select('*').in('handover_id', (h || []).map((x: any) => x.id)).order('created_at', { ascending: false });
    setLogs(l || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [orderId, user]);

  const reveal = async (handoverId: string) => {
    setRevealing(handoverId);
    const { data, error } = await supabase.functions.invoke('seller-access-credentials', {
      body: { handover_id: handoverId },
    });
    setRevealing(null);
    if (error || !data?.plaintext) return toast.error(data?.error || error?.message || 'Access denied');
    setRevealed(r => ({ ...r, [handoverId]: data.plaintext }));
    load();
  };

  const hide = (id: string) => setRevealed(r => { const c = { ...r }; delete c[id]; return c; });

  const completeAndPurge = async () => {
    if (!confirm('Mark handover complete and permanently delete all credentials for this order?')) return;
    setPurging(true);
    const { data, error } = await supabase.functions.invoke('complete-handover-purge', { body: { order_id: orderId } });
    setPurging(false);
    if (error || !data?.success) return toast.error(data?.error || error?.message || 'Failed to purge');
    toast.success('Credentials purged');
    load();
  };

  if (loading) return <AppLayout><div className="p-12 flex justify-center"><HourglassLoader size={64} /></div></AppLayout>;

  const anyLive = handovers.some(h => !h.purged_at);

  return (
    <AppLayout>
      <div className="container max-w-3xl py-8 px-4 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Buyer Credentials</h1>
          <p className="text-muted-foreground mt-1">Order #{orderId?.slice(0, 8)}</p>
        </div>

        <Alert>
          <ShieldCheck className="w-4 h-4" />
          <AlertDescription className="text-sm">
            Every reveal is timestamped and visible to the buyer. Purge credentials as soon as setup is complete. Do not screenshot, copy to unencrypted notes, or share outside DK AI Marketplace.
          </AlertDescription>
        </Alert>

        {handovers.length === 0 && (
          <Card className="p-6 text-sm text-muted-foreground">Buyer has not submitted credentials yet.</Card>
        )}

        <div className="space-y-3">
          {handovers.map(h => {
            const expired = new Date(h.access_expires_at) < new Date();
            const purged = !!h.purged_at;
            const plain = revealed[h.id];
            return (
              <Card key={h.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{h.spec_label}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {purged ? `Purged ${formatDistanceToNow(new Date(h.purged_at), { addSuffix: true })}`
                        : expired ? 'Access window expired'
                        : `Access ends ${formatDistanceToNow(new Date(h.access_expires_at), { addSuffix: true })}`}
                    </div>
                  </div>
                  {!purged && !expired && (
                    plain ? (
                      <Button size="sm" variant="outline" onClick={() => hide(h.id)}><EyeOff className="w-4 h-4 mr-1" /> Hide</Button>
                    ) : (
                      <Button size="sm" onClick={() => reveal(h.id)} disabled={revealing === h.id}>
                        {revealing === h.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Eye className="w-4 h-4 mr-1" /> Reveal</>}
                      </Button>
                    )
                  )}
                </div>
                {plain && (
                  <div className="p-3 bg-muted rounded text-sm font-mono break-all select-all">{plain}</div>
                )}
              </Card>
            );
          })}
        </div>

        {anyLive && (
          <div className="flex justify-end">
            <Button variant="destructive" onClick={completeAndPurge} disabled={purging}>
              {purging && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Trash2 className="w-4 h-4 mr-2" /> Complete & Purge All
            </Button>
          </div>
        )}

        <Card className="p-4">
          <h3 className="font-semibold mb-2 text-sm">Access log</h3>
          {logs.length === 0 ? <p className="text-xs text-muted-foreground">No access recorded.</p> : (
            <ul className="text-xs space-y-1">
              {logs.map(l => (
                <li key={l.id} className="flex justify-between border-b py-1">
                  <span>{l.action} by {l.actor_role}</span>
                  <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
