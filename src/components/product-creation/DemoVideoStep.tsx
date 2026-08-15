import { useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Upload, X, Video, AlertCircle, CheckCircle2 } from 'lucide-react';
import * as tus from 'tus-js-client';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const DEMO_VIDEO_BUCKET = 'product-media';
/** 2.5 GB per demo video file (resumable TUS upload). */
export const MAX_DEMO_VIDEO_BYTES = 2.5 * 1024 * 1024 * 1024;
export const MAX_DEMO_VIDEOS = 5;

const SUPABASE_URL = 'https://dwqpkdatzdqhplgyhigg.supabase.co';

export const DEMO_VIDEO_URL_REGEX =
  /^https?:\/\/(www\.)?(loom\.com\/share\/[\w-]+|youtube\.com\/watch\?[\w=&%-]*v=[\w-]+[\w=&%-]*|youtu\.be\/[\w-]+)/i;

export function isValidDemoVideoUrl(url: string) {
  return DEMO_VIDEO_URL_REGEX.test((url || '').trim());
}

/** Parses the stored value (JSON array or single legacy path) into a list. */
export function parseDemoVideoPaths(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && !!v.trim());
  if (typeof value === 'string' && value.trim()) {
    const t = value.trim();
    if (t.startsWith('[')) {
      try {
        const parsed = JSON.parse(t);
        if (Array.isArray(parsed)) return parsed.filter((v) => typeof v === 'string' && v.trim());
      } catch { /* fall through to single path */ }
    }
    return [t];
  }
  return [];
}

interface DemoVideoStepProps {
  data: { demo_video_url: string; demo_video_storage_path: string; demo_video_paths?: string[] };
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
}

export function DemoVideoStep({ data, onChange, errors }: DemoVideoStepProps) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const paths = data.demo_video_paths?.length
    ? data.demo_video_paths
    : parseDemoVideoPaths(data.demo_video_storage_path);
  const [open, setOpen] = useState(paths.length > 0);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadingName, setUploadingName] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);

  const url = data.demo_video_url || '';
  const urlInvalid = url.trim().length > 0 && !isValidDemoVideoUrl(url);

  const setPaths = (next: string[]) => {
    onChange('demo_video_paths', next);
    // Keep the legacy single-path column in sync (first video) for back-compat.
    onChange('demo_video_storage_path', next[0] ?? '');
  };

  /** Resumable (TUS) upload — required for multi-GB files. */
  const uploadResumable = (path: string, file: File, token: string) =>
    new Promise<void>((resolve, reject) => {
      const upload = new tus.Upload(file, {
        endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
        retryDelays: [0, 1000, 3000, 5000, 10000],
        headers: {
          authorization: `Bearer ${token}`,
          'x-upsert': 'false',
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        chunkSize: 6 * 1024 * 1024, // Supabase requires exactly 6MB chunks
        metadata: {
          bucketName: DEMO_VIDEO_BUCKET,
          objectName: path,
          contentType: file.type || 'video/mp4',
          cacheControl: '3600',
        },
        onError: (err) => reject(err instanceof Error ? err : new Error(String(err))),
        onProgress: (sent, total) => setProgress(Math.round((sent / total) * 100)),
        onSuccess: () => resolve(),
      });
      upload.findPreviousUploads().then((previous) => {
        if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
        upload.start();
      }).catch(() => upload.start());
    });

  const handleFile = async (file: File) => {
    setFileError(null);
    if (!user) {
      setFileError('Sign in required to upload a video.');
      return;
    }
    if (!file.type.startsWith('video/')) {
      setFileError('Please choose a video file.');
      return;
    }
    if (file.size > MAX_DEMO_VIDEO_BYTES) {
      setFileError('That file is larger than 2.5 GB. Please compress it or use a Loom link.');
      return;
    }
    if (paths.length >= MAX_DEMO_VIDEOS) {
      setFileError(`You can upload up to ${MAX_DEMO_VIDEOS} demo videos.`);
      return;
    }
    setUploading(true);
    setUploadingName(file.name);
    setProgress(0);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Your session expired. Please sign in again.');
      const ext = file.name.split('.').pop() || 'mp4';
      const path = `${user.id}/demo/${crypto.randomUUID()}.${ext}`;
      await uploadResumable(path, file, token);
      setPaths([...paths, `${DEMO_VIDEO_BUCKET}/${path}`]);
      setProgress(100);
    } catch (e: any) {
      setFileError(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadingName('');
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Demo Video (required)</h3>
        <p className="text-sm text-muted-foreground">
          Every product needs a short demo so buyers and reviewers can see it actually works.
          A link is the fastest option.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="demo_video_url">
          Paste your 2-minute demo link (Loom or unlisted YouTube)
        </Label>
        <Input
          id="demo_video_url"
          placeholder="https://www.loom.com/share/... or https://youtu.be/..."
          value={url}
          onChange={(e) => onChange('demo_video_url', e.target.value)}
        />
        {(urlInvalid || errors.demoVideoUrlError) && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {urlInvalid
              ? 'Enter a valid loom.com/share/..., youtube.com/watch?v=... or youtu.be/... link.'
              : errors.demoVideoUrlError}
          </p>
        )}
        {!urlInvalid && url.trim() && (
          <p className="text-sm text-green-600 flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4" /> Link looks good.
          </p>
        )}
      </div>

      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
            Don't use Loom? Upload video files instead
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Up to {MAX_DEMO_VIDEOS} video files, each up to 2.5 GB. Large uploads are resumable — if your
            connection drops, picking the same file again continues where it stopped. Files stay private and
            are only shown to our review team.
          </p>

          {paths.length > 0 && (
            <div className="space-y-2">
              {paths.map((p, i) => (
                <div key={p} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <span className="flex items-center gap-2 text-sm truncate">
                    <Video className="h-4 w-4 text-primary shrink-0" />
                    <span className="truncate">{p.split('/').pop()}</span>
                    {i === 0 && <span className="text-xs text-muted-foreground shrink-0">(main)</span>}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPaths(paths.filter((_, idx) => idx !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {paths.length < MAX_DEMO_VIDEOS && (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <Button
                variant="secondary"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                {uploading ? 'Uploading…' : paths.length ? 'Add another video' : 'Choose video file'}
              </Button>
            </div>
          )}

          {uploading && (
            <div className="space-y-1">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {progress}% uploaded{uploadingName ? ` — ${uploadingName}` : ''}
              </p>
            </div>
          )}

          {fileError && (
            <Alert variant="destructive">
              <AlertDescription>{fileError}</AlertDescription>
            </Alert>
          )}
        </CollapsibleContent>
      </Collapsible>

      {!url.trim() && paths.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Add a demo link or upload a video file — submission stays disabled until then.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
