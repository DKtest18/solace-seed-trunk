import { useRef, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { validateImageFile } from '@/utils/productValidation';
import { ImagePlus, X, ArrowUp, ArrowDown, Star, Film, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export const MAX_PRODUCT_MEDIA = 10;
export const MAX_PRODUCT_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB per gallery video

export interface ProductMediaItem {
  /** Row id in dkai_product_media once persisted. */
  id?: string;
  /** `bucket/path` of the stored object. */
  storage_path: string;
  media_type: 'image' | 'video';
  mime_type: string;
  size_bytes: number;
  /** Displayable URL (public URL or signed URL). */
  url: string;
  /** True while the file is still uploading. */
  uploading?: boolean;
  /** Set when the upload failed so the user can retry. */
  error?: string;
}

interface ImagesStepProps {
  media: ProductMediaItem[];
  onAddFile: (file: File) => void | Promise<void>;
  onRemove: (index: number) => void | Promise<void>;
  onReorder: (media: ProductMediaItem[]) => void | Promise<void>;
  errors: Record<string, string>;
}

export const MAX_PRODUCT_VIDEO_SECONDS = 180; // 3 minutes per gallery video

function validateVideoFile(file: File): { isValid: boolean; error?: string } {
  if (file.size > MAX_PRODUCT_VIDEO_BYTES) {
    return { isValid: false, error: 'Gallery videos must be under 500MB (use the Demo Video step for larger files)' };
  }
  const type = (file.type || '').toLowerCase();
  const okByExt = /\.(mp4|webm|mov|m4v|avi|mkv|ogv|ogg)$/i.test(file.name);
  if (!type.startsWith('video/') && !okByExt) {
    return { isValid: false, error: 'Unsupported video format. Use MP4, WebM, MOV, M4V, AVI, MKV or OGG' };
  }
  return { isValid: true };

}

/** Reads the video duration in the browser. Returns null when it can't be determined. */
async function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.onloadedmetadata = () => done(Number.isFinite(video.duration) ? video.duration : null);
    video.onerror = () => done(null);
    video.src = url;
  });
}

export function ImagesStep({ media, onAddFile, onRemove, onReorder, errors }: ImagesStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = media.some((m) => m.uploading);

  const accept = useCallback(
    async (file: File) => {
      if (media.length >= MAX_PRODUCT_MEDIA) {
        toast.error(`Maximum ${MAX_PRODUCT_MEDIA} media files allowed`);
        return;
      }
      const isVideo = file.type.startsWith('video/');
      const validation = isVideo ? validateVideoFile(file) : validateImageFile(file);
      if (!validation.isValid) {
        toast.error(validation.error);
        return;
      }
      if (isVideo) {
        const duration = await readVideoDuration(file);
        if (duration !== null && duration > MAX_PRODUCT_VIDEO_SECONDS + 1) {
          toast.error('Gallery videos must be 3 minutes or shorter');
          return;
        }
      }
      await onAddFile(file);
    },
    [media.length, onAddFile],
  );


  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    for (const file of files) await accept(file);
  };

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = Array.from(e.clipboardData.items);
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) await accept(file);
        }
      }
    },
    [accept],
  );

  const move = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= media.length) return;
    const next = [...media];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    onReorder(next);
  };

  const setAsMain = (index: number) => {
    if (index === 0) return;
    const next = [...media];
    const [moved] = next.splice(index, 1);
    next.unshift(moved);
    onReorder(next);
  };

  return (
    <div className="space-y-6" onPaste={handlePaste}>
      <div className="space-y-2">
        <Label>Product Media</Label>
        <p className="text-sm text-muted-foreground">
          Upload up to {MAX_PRODUCT_MEDIA} images and videos (videos max 3 minutes). The first item is the cover.
          Files are saved to your draft immediately, so they stay here when you leave and come back.
          You can also paste images from the clipboard.
        </p>
      </div>

      {media.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {media.map((item, index) => (
            <div key={item.storage_path || index} className="relative group border rounded-lg overflow-hidden bg-muted/30">
              {item.uploading ? (
                <div className="w-full h-40 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-xs">Uploading…</span>
                </div>
              ) : item.error ? (
                <div className="w-full h-40 flex flex-col items-center justify-center gap-2 p-3 text-center text-destructive">
                  <AlertCircle className="h-6 w-6" />
                  <span className="text-xs">{item.error}</span>
                </div>
              ) : item.media_type === 'video' ? (
                <video src={item.url} controls preload="metadata" className="w-full h-40 object-cover" />
              ) : (
                <img
                  src={item.url}
                  alt={`Product media ${index + 1}`}
                  loading="lazy"
                  className="w-full h-40 object-cover"
                />
              )}

              <div className="absolute top-2 left-2 flex gap-1">
                {index === 0 && !item.uploading && (
                  <Badge className="bg-primary text-primary-foreground text-xs">
                    <Star className="h-3 w-3 mr-1" /> Main
                  </Badge>
                )}
                {item.media_type === 'video' && (
                  <Badge variant="secondary" className="text-xs">
                    <Film className="h-3 w-3 mr-1" /> Video
                  </Badge>
                )}
              </div>

              <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button type="button" variant="destructive" size="icon" className="h-7 w-7" onClick={() => onRemove(index)}>
                  <X className="h-3 w-3" />
                </Button>
                {index > 0 && (
                  <Button type="button" variant="secondary" size="icon" className="h-7 w-7" onClick={() => move(index, 'up')}>
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                )}
                {index < media.length - 1 && (
                  <Button type="button" variant="secondary" size="icon" className="h-7 w-7" onClick={() => move(index, 'down')}>
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {index > 0 && !item.uploading && (
                <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button type="button" variant="secondary" size="sm" className="h-7 text-xs" onClick={() => setAsMain(index)}>
                    <Star className="h-3 w-3 mr-1" /> Set as Main
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {media.length < MAX_PRODUCT_MEDIA && (
        <Label htmlFor="media-upload" className="cursor-pointer">
          <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
            {busy ? (
              <Loader2 className="h-12 w-12 mx-auto text-muted-foreground mb-2 animate-spin" />
            ) : (
              <ImagePlus className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            )}
            <p className="text-sm font-medium">
              {busy ? 'Uploading…' : 'Click to upload or paste image'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Images: JPEG, PNG, WEBP up to 10MB · Videos: MP4, WebM, MOV up to 500MB · max 3 minutes
            </p>
          </div>
          <Input
            id="media-upload"
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/jpg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
            onChange={handleFileChange}
            className="hidden"
          />
        </Label>
      )}

      {errors.imagesError && <p className="text-sm text-destructive">{errors.imagesError}</p>}
    </div>
  );
}
