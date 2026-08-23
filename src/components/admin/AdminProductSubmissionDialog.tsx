import { useEffect, useState } from 'react';
import { db } from '@/lib/dkaiDb';
import { mediaPublicUrl } from '@/hooks/useProductMedia';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Loader2, CheckCircle2, XCircle, Download } from 'lucide-react';
import { downloadUrl } from '@/lib/downloadFile';


import { DemoVideoReviewPanel } from '@/components/admin/DemoVideoReviewPanel';
import { AdminProductFileAccess } from '@/components/admin/AdminProductFileAccess';
import { formatMoney } from '@/lib/money';
import { format } from 'date-fns';

interface MediaRow {
  id: string;
  storage_path: string;
  media_type: string;
  sort_order?: number | null;
}

/**
 * Gallery media lives in the `product-images` / `product-media` buckets. Public
 * URLs work while those buckets are public, but a private bucket (or a future
 * policy change) would break playback and downloads silently — so we always try
 * a signed URL first and fall back to the public URL.
 */
async function resolveMediaUrl(storagePath: string) {
  const [bucket, ...rest] = storagePath.split('/');
  const key = rest.join('/');
  try {
    const { data } = await supabase.storage.from(bucket).createSignedUrl(key, 60 * 60);
    if (data?.signedUrl) return data.signedUrl;
  } catch {
    /* fall through */
  }
  return mediaPublicUrl(storagePath);
}



function Val({ v, currency }: { v: any; currency?: string }) {
  if (v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) {
    return <span className="text-muted-foreground italic">Not provided by seller</span>;
  }
  if (typeof v === 'boolean') {
    return v ? (
      <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle2 className="w-3.5 h-3.5" /> Yes</span>
    ) : (
      <span className="inline-flex items-center gap-1 text-muted-foreground"><XCircle className="w-3.5 h-3.5" /> No</span>
    );
  }
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x === 'string' || typeof x === 'number')) {
      return (
        <span className="flex flex-wrap gap-1">
          {v.map((x, i) => (
            <Badge key={i} variant="secondary" className="font-normal">{String(x)}</Badge>
          ))}
        </span>
      );
    }
    return <pre className="text-xs whitespace-pre-wrap break-all bg-muted/50 rounded p-2">{JSON.stringify(v, null, 2)}</pre>;
  }
  if (typeof v === 'object') {
    return <pre className="text-xs whitespace-pre-wrap break-all bg-muted/50 rounded p-2">{JSON.stringify(v, null, 2)}</pre>;
  }
  return <span className="whitespace-pre-wrap break-words">{String(v)}</span>;
}

function Row({ label, value, currency }: { label: string; value: any; currency?: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 py-1.5 border-b last:border-b-0 border-border/60">
      <div className="text-xs font-medium text-muted-foreground sm:pt-0.5">{label}</div>
      <div className="sm:col-span-2 text-sm">
        <Val v={value} currency={currency} />
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
            {n}
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

export function AdminProductSubmissionDialog({
  product,
  open,
  onOpenChange,
}: {
  product: any;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const p = product ?? {};
  const cur = p.currency;
  const [media, setMedia] = useState<MediaRow[] | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open || !p.id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await db
        .from('dkai_product_media')
        .select('id, storage_path, media_type, sort_order')
        .eq('product_id', p.id)
        .order('sort_order', { ascending: true });
      if (cancelled) return;
      if (error) {
        setMediaError(error.message);
        setMedia([]);
        return;
      }
      const rows = (data as MediaRow[]) ?? [];
      setMediaError(null);
      setMedia(rows);
      const entries = await Promise.all(
        rows.map(async (r) => [r.id, await resolveMediaUrl(r.storage_path)] as const),
      );
      if (!cancelled) setMediaUrls(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [open, p.id]);

  const money = (v: any) => (v === null || v === undefined || v === '' ? null : formatMoney(Number(v), cur));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Full submission — {p.title || 'Untitled product'}</DialogTitle>
          <DialogDescription>
            Everything the seller entered and accepted across all 11 wizard steps. Delivery files can be
            inspected and downloaded at the bottom; every download is audit-logged.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Step n={1} title="Basic Info">
            <Row label="Product title" value={p.title} />
            <Row label="Product type" value={p.product_type} />
            <Row label="Description" value={p.description} />
            <Row label="Demo / live URL" value={p.demo_url} />
            <Row label="Product version" value={p.product_version} />
            <Row label="Category" value={p.category} />
          </Step>

          <Step n={2} title="Purpose & Value">
            <Row label="Purpose" value={p.purpose} />
            <Row label="Target audience" value={p.target_audience} />
            <Row label="Value proposition" value={p.value_proposition} />
            <Row label="Problem solved" value={p.problem_solved} />
          </Step>

          <Step n={3} title="Images & Gallery Media">
            {media === null ? (
              <div className="flex py-4 justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
            ) : mediaError ? (
              <p className="text-sm text-destructive py-2">Could not load gallery media: {mediaError}</p>
            ) : media.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-2">No gallery media uploaded.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-2">
                {media.map((m, idx) => {
                  const url = mediaUrls[m.id] ?? mediaPublicUrl(m.storage_path);
                  const name = m.storage_path.split('/').pop() || `media-${idx + 1}`;
                  return (
                    <div key={m.id} className="space-y-1">
                      {m.media_type === 'video' ? (
                        <video src={url} controls playsInline preload="metadata" className="w-full rounded border" />
                      ) : (
                        <a href={url} target="_blank" rel="noreferrer">
                          <img src={url} alt={p.title || 'Product media'} className="w-full h-32 object-cover rounded border" />
                        </a>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => downloadUrl(url, name)}
                      >
                        <Download className="w-3.5 h-3.5 mr-1.5" /> Download
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
            {media && media.length > 1 && (
              <div className="pb-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    media.forEach((m, i) =>
                      downloadUrl(
                        mediaUrls[m.id] ?? mediaPublicUrl(m.storage_path),
                        m.storage_path.split('/').pop() || `media-${i + 1}`,
                      )
                    )
                  }
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Download all gallery media
                </Button>
              </div>
            )}
            <Row label="Cover image URL" value={p.image_url} />
            {p.image_url && (
              <div className="py-2">
                <Button size="sm" variant="outline" onClick={() => downloadUrl(p.image_url, 'cover-image')}>
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Download cover image
                </Button>
              </div>
            )}
            <Row label="Sample preview URL" value={p.sample_preview_url} />
            {p.sample_preview_url && (
              <div className="py-2">
                <Button size="sm" variant="outline" onClick={() => downloadUrl(p.sample_preview_url, 'sample-preview')}>
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Download sample preview
                </Button>
              </div>
            )}
            <Row label="Sample preview type" value={p.sample_preview_type} />
            <Row label="Sample output text" value={p.sample_output_text} />
            <Row label="Sample is watermarked" value={!!p.sample_is_watermarked} />
          </Step>


          <Step n={4} title="Pricing & Licenses">
            <Row label="Pricing model" value={p.pricing_model} />
            <Row label="Price" value={money(p.price)} />
            <Row label="Currency" value={(p.currency || '').toUpperCase()} />
            <Row label="Billing interval" value={p.billing_interval} />
            <Row label="Billing interval count" value={p.billing_interval_count} />
            <Row label="Subscription deliverables" value={p.subscription_period_deliverables} />
            <Row label="Cancellation note" value={p.subscription_cancellation_note} />
            <Row label="Max active subscribers" value={p.max_active_subscribers} />
            <Separator className="my-2" />
            <Row label="Standard license price" value={money(p.license_personal_price)} />
            <Row label="Standard license description" value={p.license_personal_description} />
            <Row label="Commercial enabled" value={!!p.license_commercial_enabled} />
            <Row label="Commercial price" value={money(p.license_commercial_price)} />
            <Row label="Commercial description" value={p.license_commercial_description} />
            <Row label="Agency enabled" value={!!p.license_agency_enabled} />
            <Row label="Agency price" value={money(p.license_agency_price)} />
            <Row label="Agency description" value={p.license_agency_description} />
            <Row label="Exclusive enabled" value={!!p.license_exclusive_enabled} />
            <Row label="Exclusive price" value={money(p.license_exclusive_price)} />
            <Row label="Exclusive description" value={p.license_exclusive_description} />
            <Row label="Exclusive source files" value={p.exclusive_source_files_description} />
            <Row label="Production cost" value={money(p.production_cost)} />
          </Step>

          <Step n={5} title="Features & Tags">
            <Row label="Features" value={p.features} />
            <Row label="Tags" value={p.tags} />
          </Step>

          <Step n={6} title="Additional Details">
            <Row label="Access details" value={p.access_details} />
            <Row label="Estimated delivery" value={p.estimated_delivery} />
            <Row label="Available quantity" value={p.available_quantity} />
            <Row label="Video URL" value={p.video_url} />
            <Row label="Requires setup credentials" value={!!p.requires_setup_credentials} />
            <Row label="Setup requirements" value={p.setup_requirements} />
            <Row label="Setup access window (hours)" value={p.setup_access_window_hours} />
            <Row label="No credentials needed" value={!!p.setup_no_credentials} />
          </Step>

          <Step n={7} title="FAQ">
            {Array.isArray(p.faqs) && p.faqs.length > 0 ? (
              <div className="space-y-2 py-1">
                {p.faqs.map((f: any, i: number) => (
                  <div key={i} className="rounded border p-2">
                    <p className="text-sm font-medium">{f?.question}</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{f?.answer}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic py-2">No FAQ entries.</p>
            )}
          </Step>

          <Step n={8} title="Delivery Files">
            <Row label="Delivery mode" value={p.delivery_mode} />
            <Row label="Delivery time (hours)" value={p.delivery_time_hours} />
            <Row label="Primary file storage key" value={p.file_storage_key} />
            <Row label="Primary file size (bytes)" value={p.file_size_bytes} />
            <Row label="Primary file scan status" value={p.file_scan_status} />
            <Row label="Accepted payment methods" value={p.payment_methods} />
            <div className="pt-3">
              <AdminProductFileAccess productId={p.id} mode="review" />
            </div>
          </Step>

          <Step n={9} title="Return Policy">
            {/* Returns are platform-mandated: every seller must accept them, so this is always Yes */}
            <Row label="Returns allowed" value={true} />

            <Row label="Return window (days)" value={p.return_window_days} />
            <Row label="Return fee enabled" value={!!p.return_fee_enabled} />
            <Row label="Return fee (%)" value={p.return_fee_percentage} />
            <Row label="Return conditions" value={p.return_conditions} />
            <Row label="Refund policy notes" value={p.refund_policy} />
            <Row
              label="Refund policy accepted"
              value={
                p.seller_ack_refund_policy
                  ? `Yes${p.seller_ack_refund_policy_at ? ` — ${format(new Date(p.seller_ack_refund_policy_at), 'dd MMM yyyy HH:mm')}` : ''}`
                  : false
              }
            />
            <Row label="Subscription cancellation acknowledged" value={!!p.seller_ack_subscription} />
            <Row label="Delivery commitment acknowledged" value={!!p.seller_ack_manual_delivery} />
            <Row label="Credential handling acknowledged" value={!!p.seller_ack_setup_credentials} />
          </Step>

          <Step n={10} title="Terms & Acceptances">
            <Row label="Seller accepted product terms" value={!!p.seller_accepted_terms} />
            <Row label="Seller Rules & Obligations confirmed" value={!!p.seller_rules_confirmed} />
            <Row
              label="Confirmed at"
              value={p.seller_rules_confirmed_at ? format(new Date(p.seller_rules_confirmed_at), 'dd MMM yyyy HH:mm') : null}
            />
          </Step>

          <Step n={11} title="Demo Video">
            <DemoVideoReviewPanel
              demoVideoUrl={p.demo_video_url}
              demoVideoPaths={p.demo_video_paths}
              demoVideoStoragePath={p.demo_video_storage_path}
            />
          </Step>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Submission metadata</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Row label="Product ID" value={p.id} />
              <Row label="Seller ID" value={p.seller_id} />
              <Row label="Review status" value={p.review_status} />
              <Row label="Published" value={!!p.is_published} />
              <Row label="Created at" value={p.created_at ? format(new Date(p.created_at), 'dd MMM yyyy HH:mm') : null} />
              <Row label="Submitted at" value={p.submitted_at ? format(new Date(p.submitted_at), 'dd MMM yyyy HH:mm') : null} />
              <Row label="Previous admin note" value={p.admin_review_note} />
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
