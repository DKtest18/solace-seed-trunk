import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ExternalLink, Video } from 'lucide-react';

function youtubeId(url: string): string | null {
  const m =
    url.match(/[?&]v=([\w-]+)/) ||
    url.match(/youtu\.be\/([\w-]+)/) ||
    url.match(/youtube\.com\/embed\/([\w-]+)/);
  return m ? m[1] : null;
}

export function hasDemoVideo(p: { demo_video_url?: string | null; demo_video_storage_path?: string | null }) {
  return !!(p.demo_video_url?.trim() || p.demo_video_storage_path?.trim());
}

interface Props {
  demoVideoUrl?: string | null;
  demoVideoStoragePath?: string | null;
}

export function DemoVideoReviewPanel({ demoVideoUrl, demoVideoStoragePath }: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const path = demoVideoStoragePath?.trim();
    if (!path) {
      setSignedUrl(null);
      return;
    }
    const [bucket, ...rest] = path.split('/');
    const objectPath = rest.join('/') || bucket;
    const realBucket = rest.length ? bucket : 'product-media';
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.storage
        .from(realBucket)
        .createSignedUrl(objectPath, 60 * 60);
      if (cancelled) return;
      if (error) setError(error.message);
      else setSignedUrl(data?.signedUrl ?? null);
    })();
    return () => { cancelled = true; };
  }, [demoVideoStoragePath]);

  const url = demoVideoUrl?.trim() || '';
  const ytId = url ? youtubeId(url) : null;

  if (!url && !demoVideoStoragePath?.trim()) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>No demo video submitted — this product cannot be approved.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
      <p className="text-sm font-medium flex items-center gap-2">
        <Video className="h-4 w-4 text-primary" /> Demo video
      </p>

      {ytId ? (
        <div className="aspect-video w-full max-w-xl overflow-hidden rounded-md">
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${ytId}`}
            title="Product demo video"
            allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary underline"
        >
          Watch demo <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : null}

      {signedUrl && (
        <video src={signedUrl} controls className="w-full max-w-xl rounded-md" />
      )}
      {error && (
        <p className="text-sm text-destructive">Could not load uploaded video: {error}</p>
      )}
    </div>
  );
}
