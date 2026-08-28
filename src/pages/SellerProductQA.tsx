import { useEffect, useState } from 'react';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MessageCircleQuestion, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { HourglassLoader } from '@/components/HourglassLoader';

interface Row {
  id: string;
  product_id: string;
  asker_id: string;
  question: string;
  answer: string | null;
  created_at: string;
  answered_at: string | null;
  product?: { title: string | null } | null;
  asker?: { full_name: string | null; username: string | null } | null;
}

export default function SellerProductQA() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  const load = async () => {
    if (!user) return;
    setLoading(true);
    let q = db.from('dkai_product_questions').select('*').eq('seller_id', user.id).order('created_at', { ascending: false });
    if (filter === 'pending') q = q.is('answer', null);
    const { data, error } = await q;
    if (error) { setLoading(false); return; }
    const list = (data || []) as Row[];
    const productIds = Array.from(new Set(list.map(r => r.product_id)));
    const askerIds = Array.from(new Set(list.map(r => r.asker_id)));
    const [{ data: prods }, { data: askers }] = await Promise.all([
      productIds.length ? db.from('dkai_products').select('id, title').in('id', productIds) : Promise.resolve({ data: [] as any[] }),
      askerIds.length ? db.from('dkai_profiles').select('id, full_name, username').in('id', askerIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const prodMap = new Map((prods || []).map((p: any) => [p.id, p]));
    const askerMap = new Map((askers || []).map((a: any) => [a.id, a]));
    setRows(list.map(r => ({ ...r, product: prodMap.get(r.product_id) || null, asker: askerMap.get(r.asker_id) || null })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user, filter]);

  const submitAnswer = async (id: string) => {
    const ans = (drafts[id] || '').trim();
    if (!ans) return;
    setSaving(id);
    const { error } = await db
      .from('dkai_product_questions')
      .update({ answer: ans, answered_at: new Date().toISOString() })
      .eq('id', id)
      .eq('seller_id', user!.id);
    setSaving(null);
    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Answer posted' });
    setDrafts(prev => { const n = { ...prev }; delete n[id]; return n; });
    load();
  };

  return (
    <AppLayout showMessagesSidebar={false}>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MessageCircleQuestion className="h-7 w-7" /> Product Q&A
          </h1>
          <div className="flex gap-2">
            <Button variant={filter === 'pending' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('pending')}>Pending</Button>
            <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>All</Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><HourglassLoader size={64} /></div>
        ) : rows.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No questions {filter === 'pending' ? 'pending answers' : 'yet'}.</CardContent></Card>
        ) : (
          <div className="space-y-4">
            {rows.map(row => (
              <Card key={row.id}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <Link to={`/product/${row.product_id}#product-qa`} className="hover:underline">
                      {row.product?.title || 'Product'}
                    </Link>
                    <span className="text-xs font-normal text-muted-foreground">
                      {new Date(row.created_at).toLocaleString()}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Asked by {row.asker?.full_name || row.asker?.username || 'User'}
                    </p>
                    <p className="text-sm whitespace-pre-wrap"><span className="font-semibold text-primary mr-1">Q:</span>{row.question}</p>
                  </div>
                  {row.answer ? (
                    <div className="pl-3 border-l-2 border-primary/40">
                      <p className="text-xs text-muted-foreground mb-1">
                        Answered {row.answered_at && new Date(row.answered_at).toLocaleString()}
                      </p>
                      <p className="text-sm whitespace-pre-wrap"><span className="font-semibold text-primary mr-1">A:</span>{row.answer}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Write your answer..."
                        value={drafts[row.id] || ''}
                        onChange={(e) => setDrafts(prev => ({ ...prev, [row.id]: e.target.value }))}
                        maxLength={2000}
                        rows={3}
                      />
                      <div className="flex justify-end">
                        <Button size="sm" onClick={() => submitAnswer(row.id)} disabled={saving === row.id || !(drafts[row.id] || '').trim()}>
                          {saving === row.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                          Post answer
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
