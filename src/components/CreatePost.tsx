import { useState } from 'react';
import { useCreatePost } from '@/hooks/usePosts';
import { moderateContent, validateImageFile } from '@/utils/contentModeration';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ImagePlus, X } from 'lucide-react';

export function CreatePost() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const createPost = useCreatePost();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.isValid) {
      toast({
        title: 'Invalid image',
        description: validation.reason,
        variant: 'destructive',
      });
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to create posts',
        variant: 'destructive',
      });
      return;
    }

    const moderation = moderateContent(content);
    if (!moderation.isValid) {
      toast({
        title: 'Content not allowed',
        description: moderation.reason,
        variant: 'destructive',
      });
      return;
    }

    try {
      await createPost.mutateAsync({ content, imageFile: imageFile || undefined });
      setContent('');
      setImageFile(null);
      setImagePreview(null);
      toast({
        title: 'Post created',
        description: 'Your post has been published successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create post. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (!user) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a Post</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="content">What's on your mind?</Label>
            <Textarea
              id="content"
              placeholder="Share your thoughts, updates, or AI-related news..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              maxLength={5000}
              required
            />
            <p className="text-sm text-muted-foreground">
              {content.length}/5000 characters
            </p>
          </div>

          {imagePreview && (
            <div className="relative">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full max-h-64 object-cover rounded-lg"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                onClick={removeImage}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            <Label htmlFor="image" className="cursor-pointer">
              <div className="flex items-center gap-2 px-4 py-2 border border-input rounded-md hover:bg-accent transition-colors">
                <ImagePlus className="h-4 w-4" />
                <span className="text-sm">Add Image</span>
              </div>
              <Input
                id="image"
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                onChange={handleImageChange}
                className="hidden"
              />
            </Label>
          </div>

          <Button type="submit" disabled={createPost.isPending || !content.trim()}>
            {createPost.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Post
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
