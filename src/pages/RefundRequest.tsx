import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck, Upload, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { toast } from 'sonner';

const MAX_EVIDENCE = 5;
const MAX_FILE_MB = 10;
const MAX_DESC = 5000;
const REFUND_WINDOW_DAYS = 14;

type Step = 'verify' | 'form' | 'submitted';

export default function RefundRequest() {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const emailFromLink = searchParams.get('email') ?? '';
  const { user } = useAuth();

  const [step, setStep] = useState<Step>(user ? 'form' : 'verify');
  const [email, setEmail] = useState(emailFromLink);
  const [orderInfo, setOrderInfo] = useState<{
    productTitle: string;
    price: number;
    currency: string;
    createdAt: string;
    daysLeft: number;
  } | null>(null);

  const [reason, setReason] = useState<'not_delivered' | 'not_as_described' | ''>('');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState<File[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [existingRequestStatus, setExistingRequestStatus] = useState<string | null>(null);

  // Auto-verify for logged-in buyers
  useEffect(() => {
    if (!user || !orderId || orderInfo) return;
    verifyOrder(user.email ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, orderId]);

  const verifyOrder = async (checkEmail: string) => {
    if (!orderId) return;
    setVerifying(true);
    setError('');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('lookup-order-for-refund', {
        body: { orderId, email: checkEmail },
      });
      if (fnError) throw fnError;
      if (!data?.order) {
        setError(data?.message ?? 'We could not find that order with the email you entered.');
        return;
      }
      const createdAt = new Date(data.order.created_at);
      const deadline = new Date(createdAt.getTime() + REFUND_WINDOW_DAYS * 24 * 3600 * 1000);
      const daysLeft = Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / (24 * 3600 * 1000)));
      setOrderInfo({
        productTitle: data.order.product_title,
        price: data.order.price,
        currency: (data.order.currency || 'USD').toUpperCase(),
        createdAt: data.order.created_at,
        daysLeft,
      });
      setExistingRequestStatus(data.existing_request_status ?? null);
      setEmail(checkEmail);
      setStep('form');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to verify order. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleAddEvidence = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const f of files) {
      if (evidence.length >= MAX_EVIDENCE) break;
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`${f.name} exceeds ${MAX_FILE_MB} MB`);
        continue;
      }
      setEvidence((prev) => [...prev, f]);
    }
    e.target.value = '';
  };

  const submit = async () => {
    if (!orderId || !orderInfo) return;
    if (!reason) return toast.error('Please select a reason');
    if (description.trim().length < 10) return toast.error('Description must be at least 10 characters');
    if (orderInfo.daysLeft <= 0) return toast.error('The 14-day refund window has expired.');

    setSubmitting(true);
    try {
      // 1) Upload evidence (if any) to private bucket under {orderId}/{timestamp}-{name}
      const evidencePaths: string[] = [];
      for (const file of evidence) {
        const path = `${orderId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { error: upErr } = await supabase.storage
          .from('refund-evidence')
          .upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        evidencePaths.push(path);
      }

      // 2) Submit the request through the edge function (validates + inserts server-side).
      const { data, error: fnError } = await supabase.functions.invoke('submit-refund-request', {
        body: {
          orderId,
          email,
          reason,
          description: description.trim(),
          evidencePaths,
        },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setStep('submitted');
      toast.success('Refund request submitted');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to submit refund request');
    } finally {
      setSubmitting(false);
    }
  };

  const content = (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">Request a refund</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Reviewed by DK AI Marketplace support. Approved refunds are issued via Stripe to your
          original payment method, typically within 24–72 hours.
        </p>
      </div>

      {step === 'verify' && (
        <Card>
          <CardHeader>
            <CardTitle>Verify your purchase</CardTitle>
            <CardDescription>
              Enter the email address you used at checkout so we can find your order.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email used at checkout</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={verifying}
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button
              className="w-full"
              onClick={() => verifyOrder(email.trim().toLowerCase())}
              disabled={verifying || !email || !orderId}
            >
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continue'}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Have an account? <Link to="/login" className="text-primary underline">Log in</Link>{' '}
              to skip email verification.
            </p>
          </CardContent>
        </Card>
      )}

      {step === 'form' && orderInfo && (
        <Card>
          <CardHeader>
            <CardTitle>{orderInfo.productTitle}</CardTitle>
            <CardDescription>
              Purchased {new Date(orderInfo.createdAt).toLocaleDateString()} —{' '}
              {orderInfo.price.toFixed(2)} {orderInfo.currency}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {existingRequestStatus && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You already have a refund request for this order (status:{' '}
                  <Badge variant="secondary">{existingRequestStatus}</Badge>). Support will be
                  in touch by email.
                </AlertDescription>
              </Alert>
            )}

            {!existingRequestStatus && orderInfo.daysLeft <= 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  The 14-day refund window for this order has expired.
                </AlertDescription>
              </Alert>
            )}

            {!existingRequestStatus && orderInfo.daysLeft > 0 && (
              <>
                <Alert className="border-primary/30 bg-primary/5">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-sm">
                    <strong>{orderInfo.daysLeft} day{orderInfo.daysLeft === 1 ? '' : 's'} left</strong>{' '}
                    to file this request (14 days from purchase).
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <Label>Reason for refund</Label>
                  <RadioGroup value={reason} onValueChange={(v: any) => setReason(v)}>
                    <label
                      htmlFor="r-not-delivered"
                      className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                        reason === 'not_delivered' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <RadioGroupItem value="not_delivered" id="r-not-delivered" className="mt-1" />
                      <div>
                        <p className="font-medium text-sm">Product not delivered</p>
                        <p className="text-xs text-muted-foreground">
                          The seller did not deliver the product within the promised delivery time.
                        </p>
                      </div>
                    </label>
                    <label
                      htmlFor="r-not-as-described"
                      className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                        reason === 'not_as_described' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <RadioGroupItem value="not_as_described" id="r-not-as-described" className="mt-1" />
                      <div>
                        <p className="font-medium text-sm">Product not as described</p>
                        <p className="text-xs text-muted-foreground">
                          The delivered product materially differs from the listing.
                        </p>
                      </div>
                    </label>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Describe what went wrong</Label>
                  <Textarea
                    id="description"
                    rows={5}
                    value={description}
                    onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESC))}
                    placeholder="Provide as much detail as possible. Include timestamps, expected vs actual behavior, and anything the seller said."
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {description.length}/{MAX_DESC}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Evidence (optional, up to {MAX_EVIDENCE} files, {MAX_FILE_MB} MB each)</Label>
                  <div className="border-2 border-dashed rounded-lg p-4 text-center">
                    <input
                      id="evidence-input"
                      type="file"
                      className="hidden"
                      multiple
                      accept="image/*,application/pdf,text/plain,.log,.zip"
                      onChange={handleAddEvidence}
                      disabled={evidence.length >= MAX_EVIDENCE}
                    />
                    <label
                      htmlFor="evidence-input"
                      className="inline-flex items-center gap-2 text-sm cursor-pointer text-primary"
                    >
                      <Upload className="h-4 w-4" /> Add screenshots, PDFs, or logs
                    </label>
                  </div>
                  {evidence.length > 0 && (
                    <div className="space-y-1">
                      {evidence.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 border rounded text-xs">
                          <span className="flex-1 truncate">{f.name}</span>
                          <span className="text-muted-foreground">
                            {(f.size / 1024).toFixed(0)} KB
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setEvidence((prev) => prev.filter((_, x) => x !== i))}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  disabled={submitting || !reason || description.trim().length < 10}
                  onClick={submit}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit refund request'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {step === 'submitted' && (
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
            <h2 className="text-xl font-semibold">Request submitted</h2>
            <p className="text-sm text-muted-foreground">
              DK AI Marketplace support will review your request and follow up by email
              ({email}). You&apos;ll hear back within 24–72 hours.
            </p>
            <p className="text-xs text-muted-foreground">
              Questions? <a href="mailto:support@dkaimarketplace.com" className="text-primary underline">support@dkaimarketplace.com</a>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  // Guests see a plain layout; logged-in users get the AppLayout chrome.
  return user ? <AppLayout>{content}</AppLayout> : <div className="min-h-screen bg-background">{content}</div>;
}
