import { useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Upload, X, Video, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const DEMO_VIDEO_BUCKET = 'product-media';
export const MAX_DEMO_VIDEO_BYTES = 500 * 1024 * 1024;

export const DEMO_VIDEO_URL_REGEX =
  /^https?:\/\/(www\.)?(loom\.com\/share\/[\w-]+|youtube\.com\/watch\?[\w=&%-]*v=[\w-]+[\w=&%-]*|youtu\.be\/[\w-]+)/i;

export function isValidDemoVideoUrl(url: string) {
  return DEMO_VIDEO_URL_REGEX.test((url || '').trim());
}

interface DemoVideoStepProps {
  data: { demo_video_url: string; demo_video_storage_path: string };
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
}

export function DemoVideoStep({ data, onChange, errors }: DemoVideoStepProps) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(!!data.demo_video_storage_path);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const url = data.demo_video_url || '';
  const urlInvalid = url.trim().length > 0 && !isValidDemoVideoUrl(url);

  const uploadWithProgress = (path: string, file: File, token: string) =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(
        'POST',
        `https://dwqpkdatzdqhplgyhigg.supabase.co/storage/v1/object/${DEMO_VIDEO_BUCKET}/${path}`,
      );
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else {
          let msg = xhr.responseText;
          try { msg = JSON.parse(xhr.responseText)?.message || msg; } catch { /* raw text */ }
          reject(new Error(msg || `Upload failed (${xhr.status})`));
        }
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      const form = new FormData();
      form.append('', file);
      xhr.send(form);
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
      setFileError('Please use a Loom link for files this large.');
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Your session expired. Please sign in again.');
      const ext = file.name.split('.').pop() || 'mp4';
      const path = `${user.id}/demo/${crypto.randomUUID()}.${ext}`;
      await uploadWithProgress(path, file, token);
      onChange('demo_video_storage_path', `${DEMO_VIDEO_BUCKET}/${path}`);
      setProgress(100);
    } catch (e: any) {
      setFileError(e.message || 'Upload failed');
    } finally {
      setUploading(false);
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
            Don't use Loom? Upload a video file instead
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Video files up to 500 MB. The file stays private and is only shown to our review team.
          </p>

          {data.demo_video_storage_path ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span className="flex items-center gap-2 text-sm truncate">
                <Video className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">{data.demo_video_storage_path.split('/').pop()}</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange('demo_video_storage_path', '')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
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
                {uploading ? 'Uploading…' : 'Choose video file'}
              </Button>
            </div>
          )}

          {uploading && (
            <div className="space-y-1">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground">{progress}% uploaded</p>
            </div>
          )}

          {fileError && (
            <Alert variant="destructive">
              <AlertDescription>{fileError}</AlertDescription>
            </Alert>
          )}
        </CollapsibleContent>
      </Collapsible>

      {!url.trim() && !data.demo_video_storage_path && (
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
