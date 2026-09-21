import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { LinkedInVerifiedBadge } from '@/components/LinkedInVerifiedBadge';
import { UnderReviewBadge, PreviewDetailNotice, PreviewUnavailableLine } from '@/components/PreviewNotice';
import { formatMoney } from '@/lib/money';
import { supabase } from '@/integrations/supabase/client';
import { usePublicPreviewMedia, type PublicPreview } from '@/hooks/usePublicPreviews';

function publicUrl(storagePath: string) {
  const [bucket, ...rest] = storagePath.split('/');
  return supabase.storage.from(bucket).getPublicUrl(rest.join('/')).data.publicUrl;
}

/**
 * Public preview page for a product awaiting review.
 * Renders ONLY the allowlisted public fields returned by the restricted API —
 * there is no purchase, cart, preorder or download action anywhere on it.
 */
export function ProductPreviewDetail({ preview }: { preview: PublicPreview }) {
  const { t } = useTranslation();
  const { data: media = [] } = usePublicPreviewMedia(preview.id);
  const [activeIdx, setActiveIdx] = useState(0);
  const [broken, setBroken] = useState<string[]>([]);

  // Demo videos the seller uploaded (stored as "bucket/path" strings) are shown
  // alongside the gallery media whenever the demo-video consent is given.
  const demoVideos = (preview.demo_video_paths ?? []).filter(Boolean);
  const galleryItems = [
    ...media.map((m) => ({
      id: m.id,
      type: m.media_type,
      url: publicUrl(m.storage_path),
    })),
    ...demoVideos.map((p, i) => ({
      id: `demo-${i}`,
      type: 'video' as const,
      url: publicUrl(p),
    })),
  ];

  const usable = galleryItems.filter((m) => !broken.includes(m.id));
  const active = usable[Math.min(activeIdx, Math.max(usable.length - 1, 0))];
  const faqs = (preview.faqs ?? []).filter((f) => f?.question || f?.answer);
  const specs: any[] = Array.isArray(preview.setup_requirements) ? (preview.setup_requirements as any[]) : [];

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Button asChild variant="ghost" className="mb-6">
          <Link to="/marketplace">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Marketplace
          </Link>
        </Button>

        <div className="mb-6">
          <PreviewDetailNotice />
        </div>

        <section className="grid gap-8 lg:grid-cols-2 items-start">
          <div className="space-y-3">
            <div className="aspect-video bg-muted overflow-hidden rounded-lg flex items-center justify-center">
              {active ? (
                active.type === 'video' ? (
                  <video
                    key={active.id}
                    src={active.url}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-contain bg-black"
                    onError={() => setBroken((p) => [...p, active.id])}
                  />
                ) : (
                  <img
                    key={active.id}
                    src={active.url}
                    alt={preview.title}
                    className="w-full h-full object-cover"
                    onError={() => setBroken((p) => [...p, active.id])}
                  />
                )
              ) : preview.image_url ? (
                <img src={preview.image_url} alt={preview.title} className="w-full h-full object-cover" />
              ) : (
                <span className="text-muted-foreground text-sm">No media available</span>
              )}
            </div>
            {usable.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {usable.map((m, i) => (
                  <button
                    key={m.id}
                    onClick={() => setActiveIdx(i)}
                    aria-label={`Preview media ${i + 1}`}
                    className={`h-16 w-24 flex-shrink-0 rounded-md overflow-hidden border ${
                      i === activeIdx ? 'border-primary' : 'border-border'
                    }`}
                  >
                    {m.type === 'video' ? (
                      <span className="flex h-full w-full items-center justify-center text-xs">Video</span>
                    ) : (
                      <img src={m.url} alt="" className="h-full w-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{t('preview.mediaCacheNote')}</p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <UnderReviewBadge />
              {preview.product_type && (
                <Badge variant="secondary" className="text-xs">{preview.product_type}</Badge>
              )}
            </div>

            <h1 className="text-3xl font-bold tracking-tight">{preview.title}</h1>

            <div>
              <p className="text-2xl font-semibold text-foreground">
                {formatMoney(Number(preview.price ?? 0), preview.currency || undefined)}
              </p>
              <p className="text-xs text-muted-foreground">{t('preview.plannedPrice')}</p>
            </div>

            <PreviewUnavailableLine />

            {preview.description && (
              <p className="text-base text-muted-foreground whitespace-pre-line">{preview.description}</p>
            )}

            {specs.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Requirements &amp; setup</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {specs.map((s, i) => (
                      <li key={i}>{s.label || s.key}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {preview.demo_video_url && (
              <a
                href={preview.demo_video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary underline underline-offset-4"
              >
                Watch demo video
              </a>
            )}

            {faqs.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Questions &amp; answers</CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    {faqs.map((f, i) => (
                      <AccordionItem key={i} value={`faq-${i}`}>
                        <AccordionTrigger className="text-left text-sm">{f.question}</AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground whitespace-pre-line">
                          {f.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            )}


            {(preview.seller_name || preview.seller_username) && (
              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={preview.seller_avatar_url || undefined} />
                      <AvatarFallback>
                        {preview.seller_name?.[0] || preview.seller_username?.[0] || 'S'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">Seller</p>
                      <p className="font-semibold inline-flex items-center gap-1">
                        {preview.seller_name || preview.seller_username}
                        {preview.seller_linkedin_verified && <LinkedInVerifiedBadge />}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('preview.sellerIdentityNote')}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
