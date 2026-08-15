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

function toPathList(paths?: string[] | string | null, legacy?: string | null): string[] {
  const list = Array.isArray(paths)
    ? paths
    : typeof paths === 'string' && paths.trim().startsWith('[')
      ? (() => { try { return JSON.parse(paths) as string[]; } catch { return []; } })()
      : typeof paths === 'string' && paths.trim()
        ? [paths.trim()]
        : [];
  const all = list.length ? list : legacy?.trim() ? [legacy.trim()] : [];
  return all.filter((p) => typeof p === 'string' && p.trim());
}

export function hasDemoVideo(p: {
  demo_video_url?: string | null;
  demo_video_storage_path?: string | null;
  demo_video_paths?: string[] | string | null;
}) {
  return !!(p.demo_video_url?.trim() || toPathList(p.demo_video_paths, p.demo_video_storage_path).length);
}

interface Props {
  demoVideoUrl?: string | null;
  demoVideoStoragePath?: string | null;
  demoVideoPaths?: string[] | string | null;
}

export function DemoVideoReviewPanel({ demoVideoUrl, demoVideoStoragePath, demoVideoPaths }: Props) {
  const [signedUrls, setSignedUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const paths = toPathList(demoVideoPaths, demoVideoStoragePath);
  const pathsKey = paths.join('|');

  useEffect(() => {
    if (!paths.length) {
      setSignedUrls([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const urls: string[] = [];
      for (const path of paths) {
        const [bucket, ...rest] = path.split('/');
        const objectPath = rest.join('/') || bucket;
        const realBucket = rest.length ? bucket : 'product-media';
        const { data, error } = await supabase.storage
          .from(realBucket)
          .createSignedUrl(objectPath, 60 * 60);
        if (error) { setError(error.message); continue; }
        if (data?.signedUrl) urls.push(data.signedUrl);
      }
      if (!cancelled) setSignedUrls(urls);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathsKey]);

  const url = demoVideoUrl?.trim() || '';
  const ytId = url ? youtubeId(url) : null;

  if (!url && !paths.length) {
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

      {signedUrls.map((signedUrl, i) => (
        <div key={signedUrl} className="space-y-1">
          {signedUrls.length > 1 && (
            <p className="text-xs text-muted-foreground">Uploaded video {i + 1} of {signedUrls.length}</p>
          )}
          <video src={signedUrl} controls preload="metadata" className="w-full max-w-xl rounded-md" />
        </div>
      ))}
      {error && (
        <p className="text-sm text-destructive">Could not load uploaded video: {error}</p>
      )}
    </div>
  );
}
