import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UnderReviewBadge, PreviewDetailNotice, PreviewUnavailableLine } from '@/components/PreviewNotice';
import { supabase } from '@/integrations/supabase/client';
import { usePublicPreviewMedia, type PublicPreview } from '@/hooks/usePublicPreviews';

function publicUrl(storagePath: string) {
  const [bucket, ...rest] = storagePath.split('/');
  return supabase.storage.from(bucket).getPublicUrl(rest.join('/')).data.publicUrl;
}

/**
 * Minimal public preview of a product awaiting review:
 * title, description and explicitly public preview images only.
 * No price, seller data, videos, FAQs, purchase or download action.
 */
export function ProductPreviewDetail({ preview }: { preview: PublicPreview }) {
  const { t } = useTranslation();
  const { data: media = [] } = usePublicPreviewMedia(preview.id);
  const [activeIdx, setActiveIdx] = useState(0);
  const [broken, setBroken] = useState<string[]>([]);

  const images = media
    .filter((m) => m.media_type === 'image')
    .map((m) => ({ id: m.id, url: publicUrl(m.storage_path) }))
    .filter((m) => !broken.includes(m.id));
  const active = images[Math.min(activeIdx, Math.max(images.length - 1, 0))];

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
                <img
                  key={active.id}
                  src={active.url}
                  alt={preview.title}
                  className="w-full h-full object-cover"
                  onError={() => setBroken((p) => [...p, active.id])}
                />
              ) : (
                <span className="text-muted-foreground text-sm">No preview images</span>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {images.map((m, i) => (
                  <button
                    key={m.id}
                    onClick={() => setActiveIdx(i)}
                    aria-label={`Preview image ${i + 1}`}
                    className={`h-16 w-24 flex-shrink-0 rounded-md overflow-hidden border ${
                      i === activeIdx ? 'border-primary' : 'border-border'
                    }`}
                  >
                    <img src={m.url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <UnderReviewBadge />
            <h1 className="text-3xl font-bold tracking-tight">{preview.title}</h1>
            <PreviewUnavailableLine />
            {preview.description && (
              <p className="text-base text-muted-foreground whitespace-pre-line">{preview.description}</p>
            )}
            <p className="text-xs text-muted-foreground">{t('preview.detailNotice')}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
