import { useState, useRef, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { validateImageFile } from '@/utils/productValidation';
import { ImagePlus, X, ArrowUp, ArrowDown, Star, Film, Loader2 } from 'lucide-react';

interface ImagesStepProps {
  images: File[];
  onAddImage: (file: File) => void;
  onRemoveImage: (index: number) => void;
  onReorderImages?: (images: File[]) => void;
  errors: Record<string, string>;
}

function validateVideoFile(file: File): { isValid: boolean; error?: string } {
  const maxSize = 100 * 1024 * 1024; // 100MB
  if (file.size > maxSize) {
    return { isValid: false, error: 'Video must be under 100MB' };
  }
  const validTypes = ['video/mp4', 'video/webm'];
  if (!validTypes.includes(file.type)) {
    return { isValid: false, error: 'Only MP4 and WebM videos are allowed' };
  }
  return { isValid: true };
}

function checkVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => reject(new Error('Failed to load video'));
    video.src = URL.createObjectURL(file);
  });
}

export function ImagesStep({ images, onAddImage, onRemoveImage, onReorderImages, errors }: ImagesStepProps) {
  const [previews, setPreviews] = useState<Array<{ url: string; type: 'image' | 'video' }>>([]);
  const [validatingVideo, setValidatingVideo] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const addFileWithPreview = useCallback((file: File) => {
    onAddImage(file);
    if (file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      setPreviews((prev) => [...prev, { url, type: 'video' }]);
    } else {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews((prev) => [...prev, { url: reader.result as string, type: 'image' }]);
      };
      reader.readAsDataURL(file);
    }
  }, [onAddImage]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('video/')) {
      const validation = validateVideoFile(file);
      if (!validation.isValid) {
        alert(validation.error);
        return;
      }
      setValidatingVideo(true);
      try {
        const duration = await checkVideoDuration(file);
        if (duration > 180) {
          alert('Video must be 3 minutes or shorter');
          return;
        }
        addFileWithPreview(file);
      } catch {
        alert('Could not read video file');
      } finally {
        setValidatingVideo(false);
      }
    } else {
      const validation = validateImageFile(file);
      if (!validation.isValid) {
        alert(validation.error);
        return;
      }
      if (images.length >= 10) {
        alert('Maximum 10 media files allowed');
        return;
      }
      addFileWithPreview(file);
    }
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  // Paste support
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file && images.length < 10) {
          const validation = validateImageFile(file);
          if (validation.isValid) {
            addFileWithPreview(file);
          }
        }
      }
    }
  }, [images.length, addFileWithPreview]);

  const handleRemove = (index: number) => {
    onRemoveImage(index);
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const moveImage = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= images.length) return;

    const newImages = [...images];
    [newImages[index], newImages[newIndex]] = [newImages[newIndex], newImages[index]];

    const newPreviews = [...previews];
    [newPreviews[index], newPreviews[newIndex]] = [newPreviews[newIndex], newPreviews[index]];

    setPreviews(newPreviews);
    if (onReorderImages) {
      onReorderImages(newImages);
    }
  };

  const setAsMain = (index: number) => {
    if (index === 0) return;
    const newImages = [...images];
    const [moved] = newImages.splice(index, 1);
    newImages.unshift(moved);

    const newPreviews = [...previews];
    const [movedPreview] = newPreviews.splice(index, 1);
    newPreviews.unshift(movedPreview);

    setPreviews(newPreviews);
    if (onReorderImages) {
      onReorderImages(newImages);
    }
  };

  return (
    <div className="space-y-6" onPaste={handlePaste}>
      <div className="space-y-2">
        <Label>Product Media</Label>
        <p className="text-sm text-muted-foreground">
          Upload up to 10 images and videos. First item is the cover. Videos max 3 minutes. You can also paste images from clipboard.
        </p>
      </div>

      {previews.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {previews.map((preview, index) => (
            <div key={index} className="relative group border rounded-lg overflow-hidden">
              {preview.type === 'video' ? (
                <video
                  src={preview.url}
                  controls
                  className="w-full h-40 object-cover"
                />
              ) : (
                <img
                  src={preview.url}
                  alt={`Product media ${index + 1}`}
                  className="w-full h-40 object-cover"
                />
              )}
              {/* Badges */}
              <div className="absolute top-2 left-2 flex gap-1">
                {index === 0 && (
                  <Badge className="bg-primary text-primary-foreground text-xs">
                    <Star className="h-3 w-3 mr-1" /> Main
                  </Badge>
                )}
                {preview.type === 'video' && (
                  <Badge variant="secondary" className="text-xs">
                    <Film className="h-3 w-3 mr-1" /> Video
                  </Badge>
                )}
              </div>
              {/* Actions */}
              <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button type="button" variant="destructive" size="icon" className="h-7 w-7" onClick={() => handleRemove(index)}>
                  <X className="h-3 w-3" />
                </Button>
                {index > 0 && (
                  <Button type="button" variant="secondary" size="icon" className="h-7 w-7" onClick={() => moveImage(index, 'up')}>
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                )}
                {index < previews.length - 1 && (
                  <Button type="button" variant="secondary" size="icon" className="h-7 w-7" onClick={() => moveImage(index, 'down')}>
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                )}
              </div>
              {/* Set as Main */}
              {index > 0 && (
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

      {images.length < 10 && (
        <Label htmlFor="media-upload" className="cursor-pointer">
          <div
            ref={dropZoneRef}
            className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors"
          >
            {validatingVideo ? (
              <Loader2 className="h-12 w-12 mx-auto text-muted-foreground mb-2 animate-spin" />
            ) : (
              <ImagePlus className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            )}
            <p className="text-sm font-medium">
              {validatingVideo ? 'Validating video...' : 'Click to upload or paste image'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Images: JPEG, PNG, WEBP up to 10MB · Videos: MP4, WebM up to 100MB (3 min max)
            </p>
          </div>
          <Input
            id="media-upload"
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,video/mp4,video/webm"
            onChange={handleFileChange}
            className="hidden"
            disabled={validatingVideo}
          />
        </Label>
      )}

      {errors.imagesError && (
        <p className="text-sm text-destructive">{errors.imagesError}</p>
      )}
    </div>
  );
}
