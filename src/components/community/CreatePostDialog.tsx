import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Upload, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useContentModeration } from '@/hooks/useContentModeration';

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPostCreated: () => void;
}

export function CreatePostDialog({ open, onOpenChange, onPostCreated }: CreatePostDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { validateAndWarn } = useContentModeration();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file size (10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Maximum file size is 10MB',
          variant: 'destructive',
        });
        return;
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
      if (!allowedTypes.includes(selectedFile.type)) {
        toast({
          title: 'Invalid file type',
          description: 'Only images (JPEG, PNG, GIF, WebP) and PDFs are allowed',
          variant: 'destructive',
        });
        return;
      }

      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!body.trim()) {
      toast({
        title: 'Missing content',
        description: 'Post body is required',
        variant: 'destructive',
      });
      return;
    }

    // Pre-publish moderation check
    const titleContent = title.trim();
    const bodyContent = body.trim();
    
    if (titleContent && !validateAndWarn(titleContent, { maxLength: 200 })) {
      return; // Validation failed, toast shown by validateAndWarn
    }
    
    if (!validateAndWarn(bodyContent, { maxLength: 10000 })) {
      return; // Validation failed, toast shown by validateAndWarn
    }

    setUploading(true);

    try {
      let attachmentKey: string | undefined;
      let attachmentFileName: string | undefined;
      let attachmentFileSize: number | undefined;
      let attachmentContentType: string | undefined;

      // Upload file if present
      if (file) {
        const formData = new FormData();
        formData.append('file', file);

        const { data: uploadData, error: uploadError } = await supabase.functions.invoke(
          'upload-community-attachment',
          { body: formData }
        );

        if (uploadError) throw uploadError;

        attachmentKey = uploadData.storage_key;
        attachmentFileName = uploadData.file_name;
        attachmentFileSize = uploadData.file_size;
        attachmentContentType = uploadData.content_type;
      }

      // Create post
      const { error: postError } = await supabase.functions.invoke('create-community-post', {
        body: {
          title: title.trim() || undefined,
          body: body.trim(),
          is_public: isPublic,
          attachment_key: attachmentKey,
          attachment_file_name: attachmentFileName,
          attachment_file_size: attachmentFileSize,
          attachment_content_type: attachmentContentType,
        }
      });

      if (postError) throw postError;

      toast({
        title: 'Post created',
        description: 'Your post has been published successfully',
      });

      // Reset form
      setTitle('');
      setBody('');
      setIsPublic(true);
      setFile(null);
      onPostCreated();
    } catch (error) {
      console.error('Error creating post:', error);
      toast({
        title: 'Error',
        description: 'Failed to create post. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create Community Post</DialogTitle>
          <DialogDescription>
            Share your thoughts, experiences, or questions with the community
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title (Optional)</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your post a title..."
              maxLength={200}
            />
          </div>

          <div>
            <Label htmlFor="body">Body *</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What's on your mind?"
              rows={6}
              maxLength={10000}
              required
            />
            <p className="text-sm text-muted-foreground mt-1">
              {body.length} / 10000 characters
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
            <Label htmlFor="public">Make post public</Label>
          </div>

          <div>
            <Label htmlFor="file">Attachment (Optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="file"
                type="file"
                onChange={handleFileChange}
                accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('file')?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Choose File
              </Button>
              {file && (
                <div className="flex items-center gap-2">
                  <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Max 10MB. Images (JPEG, PNG, GIF, WebP) or PDF
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={uploading || !body.trim()}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Post'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
