import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { HelpCircle, Loader2, MessageCircleQuestion, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link, useNavigate } from 'react-router-dom';

interface ProductQAProps {
  productId: string;
  sellerId: string;
}

interface QuestionRow {
  id: string;
  product_id: string;
  asker_id: string;
  seller_id: string;
  question: string;
  answer: string | null;
  created_at: string;
  answered_at: string | null;
}

export function ProductQA({ productId, sellerId }: ProductQAProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const isSeller = user?.id === sellerId;

  const { data, isLoading } = useQuery({
    queryKey: ['product-qa', productId],
    queryFn: async () => {
      const { data, error } = await db
        .from('dkai_product_questions')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data || []) as QuestionRow[];
      const askerIds = Array.from(new Set(rows.map(r => r.asker_id)));
      let profiles: Record<string, { full_name: string | null; avatar_url: string | null; username: string | null }> = {};
      if (askerIds.length) {
        const { data: profs } = await db
          .from('dkai_profiles')
          .select('id, full_name, avatar_url, username')
          .in('id', askerIds);
        profs?.forEach((p: any) => { profiles[p.id] = p; });
      }
      return { rows, profiles };
    },
  });

  const submitQuestion = async () => {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(`/product/${productId}`)}`);
      return;
    }
    const q = question.trim();
    if (q.length < 5) {
      toast({ title: 'Question too short', description: 'Please write at least 5 characters.', variant: 'destructive' });
      return;
    }
    if (q.length > 1000) {
      toast({ title: 'Question too long', description: 'Maximum 1000 characters.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await db.from('dkai_product_questions').insert({
        product_id: productId,
        seller_id: sellerId,
        asker_id: user.id,
        question: q,
      });
      if (error) throw error;
      setQuestion('');
      toast({ title: 'Question posted', description: 'The seller will be notified.' });
      qc.invalidateQueries({ queryKey: ['product-qa', productId] });
    } catch (e: any) {
      toast({ title: 'Failed to post question', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const submitAnswer = async (id: string) => {
    const answer = (answerDrafts[id] || '').trim();
    if (answer.length < 2) return;
    if (answer.length > 2000) {
      toast({ title: 'Answer too long', description: 'Maximum 2000 characters.', variant: 'destructive' });
      return;
    }
    setSavingId(id);
    try {
      const { error } = await db
        .from('dkai_product_questions')
        .update({ answer, answered_at: new Date().toISOString() })
        .eq('id', id)
        .eq('seller_id', user!.id);
      if (error) throw error;
      setAnswerDrafts(prev => { const n = { ...prev }; delete n[id]; return n; });
      qc.invalidateQueries({ queryKey: ['product-qa', productId] });
      toast({ title: 'Answer posted' });
    } catch (e: any) {
      toast({ title: 'Failed to post answer', description: e.message, variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Card id="product-qa" className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <MessageCircleQuestion className="h-6 w-6" />
          Questions & Answers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isSeller && (
          <div className="space-y-2">
            <Textarea
              placeholder={user ? 'Ask a question about this product...' : 'Sign in to ask a question'}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={1000}
              rows={3}
              disabled={!user}
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                Your question and the seller's answer will be public on this page.
              </span>
              <Button onClick={submitQuestion} disabled={submitting || !question.trim()} size="sm">
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                {user ? 'Post question' : 'Sign in to ask'}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !data?.rows.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">No questions yet.</p>
          ) : (
            data.rows.map((row) => {
              const profile = data.profiles[row.asker_id];
              const isOwnerOfQuestion = isSeller;
              return (
                <div key={row.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback>{profile?.full_name?.[0] || profile?.username?.[0] || '?'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {profile?.full_name || profile?.username || 'User'}
                        </span>
                        <span>·</span>
                        <span>{new Date(row.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="mt-1 text-sm whitespace-pre-wrap break-words">
                        <span className="font-semibold text-primary mr-1">Q:</span>{row.question}
                      </p>
                    </div>
                  </div>

                  {row.answer ? (
                    <div className="ml-11 pl-3 border-l-2 border-primary/40">
                      <div className="text-xs text-muted-foreground mb-1">
                        Seller answered · {row.answered_at && new Date(row.answered_at).toLocaleDateString()}
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words">
                        <span className="font-semibold text-primary mr-1">A:</span>{row.answer}
                      </p>
                    </div>
                  ) : isOwnerOfQuestion ? (
                    <div className="ml-11 space-y-2">
                      <Textarea
                        placeholder="Write your answer..."
                        value={answerDrafts[row.id] || ''}
                        onChange={(e) => setAnswerDrafts(prev => ({ ...prev, [row.id]: e.target.value }))}
                        maxLength={2000}
                        rows={2}
                      />
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => submitAnswer(row.id)}
                          disabled={savingId === row.id || !(answerDrafts[row.id] || '').trim()}
                        >
                          {savingId === row.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                          Post answer
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="ml-11 text-xs text-muted-foreground italic">Awaiting seller answer…</div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
