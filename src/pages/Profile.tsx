import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/dkaiDb';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, User, Globe, MapPin, Mail, Calendar, Camera, AlertTriangle, Crop, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { AppLayout } from '@/components/AppLayout';
import { useHasRole } from '@/hooks/useUserRole';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AvatarCropEditor, getAvatarCropStyle } from '@/components/AvatarCropEditor';

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromChecklist = searchParams.get('from') === 'checklist';
  const { toast } = useToast();
  const { hasRole: isAdmin } = useHasRole('admin');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [showCropEditor, setShowCropEditor] = useState(false);

  const [originalData, setOriginalData] = useState({
    username: '',
    full_name: '',
    bio: '',
    website_url: '',
    country: '',
    avatar_url: '',
    expanded_bio: '',
    banner_url: '',
    avatar_zoom: 1,
    avatar_position_x: 50,
    avatar_position_y: 50,
  });

  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    bio: '',
    website_url: '',
    country: '',
    avatar_url: '',
    expanded_bio: '',
    avatar_zoom: 1,
    avatar_position_x: 50,
    avatar_position_y: 50,
  });

  const [bannerUrl, setBannerUrl] = useState('');
  const [previousBannerUrl, setPreviousBannerUrl] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchProfile();
  }, [user, navigate]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data, error } = await db
      .from('dkai_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return;
    }

    const profileData = {
      username: data.username || '',
      full_name: data.full_name || '',
      bio: data.bio || '',
      website_url: data.website_url || '',
      country: data.country || '',
      avatar_url: data.avatar_url || '',
      expanded_bio: data.expanded_bio || '',
      banner_url: data.banner_url || '',
      avatar_zoom: data.avatar_zoom ?? 1,
      avatar_position_x: data.avatar_position_x ?? 50,
      avatar_position_y: data.avatar_position_y ?? 50,
    };

    setFormData({
      username: profileData.username,
      full_name: profileData.full_name,
      bio: profileData.bio,
      website_url: profileData.website_url,
      country: profileData.country,
      avatar_url: profileData.avatar_url,
      expanded_bio: profileData.expanded_bio,
      avatar_zoom: profileData.avatar_zoom,
      avatar_position_x: profileData.avatar_position_x,
      avatar_position_y: profileData.avatar_position_y,
    });
    setOriginalData(profileData);
    setBannerUrl(data.banner_url || '');
    setPreviousBannerUrl(data.banner_url || '');
    setHasUnsavedChanges(false);
  };

  useEffect(() => {
    const hasChanges =
      formData.username !== originalData.username ||
      formData.full_name !== originalData.full_name ||
      formData.bio !== originalData.bio ||
      formData.website_url !== originalData.website_url ||
      formData.country !== originalData.country ||
      formData.avatar_url !== originalData.avatar_url ||
      formData.expanded_bio !== originalData.expanded_bio ||
      formData.avatar_zoom !== originalData.avatar_zoom ||
      formData.avatar_position_x !== originalData.avatar_position_x ||
      formData.avatar_position_y !== originalData.avatar_position_y ||
      bannerUrl !== originalData.banner_url;

    setHasUnsavedChanges(hasChanges);
  }, [formData, bannerUrl, originalData]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({ title: 'Invalid file type', description: 'Please upload a JPG, PNG, or WebP image.', variant: 'destructive' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Please upload an image smaller than 10MB.', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-avatar-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, avatar_url: urlData.publicUrl }));
      toast({ title: 'Avatar uploaded', description: 'Click "Save Changes" to persist your new avatar.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to upload avatar', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleAvatarDelete = () => {
    setFormData(prev => ({ ...prev, avatar_url: '' }));
    toast({ title: 'Avatar removed', description: 'Click "Save Changes" to persist the removal.' });
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({ title: 'Invalid file type', description: 'Please upload a JPG, PNG, or WebP image.', variant: 'destructive' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Please upload an image smaller than 10MB.', variant: 'destructive' });
      return;
    }

    const maxWidth = isAdmin ? 1536 : 1200;
    const maxHeight = isAdmin ? 1024 : 400;

    setUploadingBanner(true);
    try {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = async (event) => {
        img.src = event.target?.result as string;
        img.onload = async () => {
          if (isAdmin && (img.width < maxWidth || img.height < maxHeight)) {
            toast({ title: 'Image too small', description: `Admin banner must be at least ${maxWidth}×${maxHeight}px.`, variant: 'destructive' });
            setUploadingBanner(false);
            return;
          }
          if (img.width > maxWidth || img.height > maxHeight) {
            toast({ title: 'Image too large', description: `Banner max ${maxWidth}×${maxHeight}px. Current: ${img.width}×${img.height}px`, variant: 'destructive' });
            setUploadingBanner(false);
            return;
          }

          const fileExt = file.name.split('.').pop();
          const fileName = `${user.id}-banner-${Date.now()}.${fileExt}`;
          const filePath = `${user.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, file, { cacheControl: '3600', upsert: true });
          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

          setBannerUrl(urlData.publicUrl);
          toast({ title: 'Banner uploaded', description: 'Click "Save Changes" to persist your new banner.' });
          setUploadingBanner(false);
        };
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to upload banner', variant: 'destructive' });
      setUploadingBanner(false);
    }
  };

  const handleRevertBanner = () => {
    setBannerUrl(previousBannerUrl);
    toast({ title: 'Reverted', description: 'Banner reverted to previously saved image.' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.full_name.trim()) {
      toast({ title: 'Required', description: 'Display Name is required.', variant: 'destructive' });
      return;
    }
    if (!formData.username.trim()) {
      toast({ title: 'Required', description: 'Username is required.', variant: 'destructive' });
      return;
    }

    // Check if username is already taken by another user
    if (formData.username !== originalData.username) {
      const { data: existingUsername } = await db
        .from('dkai_profiles')
        .select('id')
        .eq('username', formData.username.trim())
        .neq('id', user.id)
        .maybeSingle();

      if (existingUsername) {
        toast({ title: 'Username taken', description: 'This username is already in use. Please choose another.', variant: 'destructive' });
        return;
      }
    }

    // Check if display name is already taken by another user
    if (formData.full_name !== originalData.full_name) {
      const { data: existingName } = await db
        .from('dkai_profiles')
        .select('id')
        .eq('full_name', formData.full_name.trim())
        .neq('id', user.id)
        .maybeSingle();

      if (existingName) {
        toast({ title: 'Display Name taken', description: 'This display name is already in use. Please choose another.', variant: 'destructive' });
        return;
      }
    }

    setLoading(true);
    try {
      const { data: updatedData, error } = await db
        .from('dkai_profiles')
        .update({
          username: formData.username || null,
          full_name: formData.full_name || null,
          bio: formData.bio || null,
          website_url: formData.website_url || null,
          country: formData.country || null,
          avatar_url: formData.avatar_url || null,
          expanded_bio: formData.expanded_bio || null,
          banner_url: bannerUrl || null,
          avatar_zoom: formData.avatar_zoom,
          avatar_position_x: formData.avatar_position_x,
          avatar_position_y: formData.avatar_position_y,
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      const savedData = {
        username: updatedData.username || '',
        full_name: updatedData.full_name || '',
        bio: updatedData.bio || '',
        website_url: updatedData.website_url || '',
        country: updatedData.country || '',
        avatar_url: updatedData.avatar_url || '',
        expanded_bio: updatedData.expanded_bio || '',
        banner_url: updatedData.banner_url || '',
        avatar_zoom: updatedData.avatar_zoom ?? 1,
        avatar_position_x: updatedData.avatar_position_x ?? 50,
        avatar_position_y: updatedData.avatar_position_y ?? 50,
      };
      setFormData({
        username: savedData.username,
        full_name: savedData.full_name,
        bio: savedData.bio,
        website_url: savedData.website_url,
        country: savedData.country,
        avatar_url: savedData.avatar_url,
        expanded_bio: savedData.expanded_bio,
        avatar_zoom: savedData.avatar_zoom,
        avatar_position_x: savedData.avatar_position_x,
        avatar_position_y: savedData.avatar_position_y,
      });
      setOriginalData(savedData);
      setBannerUrl(savedData.banner_url);
      setPreviousBannerUrl(savedData.banner_url);
      setHasUnsavedChanges(false);

      toast({ title: 'Success', description: 'Profile saved successfully.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to update profile', variant: 'destructive' });
      setFormData({
        username: originalData.username,
        full_name: originalData.full_name,
        bio: originalData.bio,
        website_url: originalData.website_url,
        country: originalData.country,
        avatar_url: originalData.avatar_url,
        expanded_bio: originalData.expanded_bio,
        avatar_zoom: originalData.avatar_zoom,
        avatar_position_x: originalData.avatar_position_x,
        avatar_position_y: originalData.avatar_position_y,
      });
      setBannerUrl(originalData.banner_url);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      setPendingNavigation('back');
      setShowUnsavedDialog(true);
    } else {
      navigate(-1);
    }
  };

  const handleDiscardChanges = () => {
    setFormData({
      username: originalData.username,
      full_name: originalData.full_name,
      bio: originalData.bio,
      website_url: originalData.website_url,
      country: originalData.country,
      avatar_url: originalData.avatar_url,
      expanded_bio: originalData.expanded_bio,
      avatar_zoom: originalData.avatar_zoom,
      avatar_position_x: originalData.avatar_position_x,
      avatar_position_y: originalData.avatar_position_y,
    });
    setBannerUrl(originalData.banner_url);
    setHasUnsavedChanges(false);
    setShowUnsavedDialog(false);
    if (pendingNavigation) {
      if (pendingNavigation === 'back') navigate(-1);
      else navigate(pendingNavigation);
      setPendingNavigation(null);
    }
  };

  if (!user) return null;

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        {/* Banner Section */}
        <div className="relative h-48 md:h-64 bg-gradient-to-br from-primary/20 via-primary/10 to-background overflow-hidden group">
          {bannerUrl && (
            <img src={bannerUrl} alt="Profile banner" className="w-full h-full object-cover" />
          )}
          <div className="absolute top-4 right-4 flex gap-2">
            <Label htmlFor="banner-upload" className="cursor-pointer">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={uploadingBanner}
                className="bg-background/80 backdrop-blur-sm hover:bg-background/90"
                asChild
              >
                <span>
                  {uploadingBanner ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Camera className="h-4 w-4 mr-2" />
                  )}
                  Edit Banner
                </span>
              </Button>
            </Label>
            {bannerUrl !== previousBannerUrl && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleRevertBanner}
                className="bg-background/80 backdrop-blur-sm hover:bg-background/90"
              >
                Revert
              </Button>
            )}
          </div>
          <Input
            id="banner-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleBannerUpload}
            disabled={uploadingBanner}
          />
        </div>

        {/* Avatar overlapping banner */}
        <div className="max-w-3xl mx-auto px-4 -mt-20">
          <div className="flex flex-col items-center">
            <div className="relative group">
              <Avatar className="h-40 w-40 border-4 border-background shadow-xl overflow-hidden">
                <AvatarImage
                  src={formData.avatar_url}
                  style={getAvatarCropStyle(formData.avatar_zoom, formData.avatar_position_x, formData.avatar_position_y)}
                />
                <AvatarFallback className="text-4xl">
                  <User className="h-20 w-20" />
                </AvatarFallback>
              </Avatar>
              <Label htmlFor="avatar-upload" className="absolute bottom-2 right-2 cursor-pointer">
                <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                </div>
              </Label>
              {formData.avatar_url && (
                <div className="absolute bottom-2 left-2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => setShowCropEditor(true)}
                    className="h-10 w-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shadow-lg hover:bg-secondary/90 transition-colors"
                  >
                    <Crop className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleAvatarDelete}
                    className="h-10 w-10 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-lg hover:bg-destructive/90 transition-colors"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              )}
              <Input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={uploading}
              />
            </div>
          </div>

          {/* Profile Form - pushed below avatar */}
          <form onSubmit={handleSubmit} className="mt-8 pb-12">
            <Card>
              <CardContent className="pt-6 space-y-6">
                {/* Display Name & Username - Required */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name" className="text-sm font-medium">
                      Display Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="full_name"
                      placeholder="John Doe"
                      value={formData.full_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                      className="text-lg font-semibold"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-sm font-medium">
                      Username <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                      <Input
                        id="username"
                        placeholder="johndoe"
                        value={formData.username}
                        onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                        className="pl-7"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Bio - Optional */}
                <div className="space-y-2">
                  <Label htmlFor="bio" className="text-sm font-medium">Bio</Label>
                  <Textarea
                    id="bio"
                    placeholder="Tell people about yourself in a few words..."
                    value={formData.bio}
                    onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                    rows={3}
                    maxLength={150}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground text-right">{formData.bio.length}/150</p>
                </div>

                <Separator />

                {/* About - Optional */}
                <div className="space-y-2">
                  <Label htmlFor="expanded_bio" className="text-sm font-medium">About</Label>
                  <Textarea
                    id="expanded_bio"
                    placeholder="Share your story, interests, or anything you'd like people to know..."
                    value={formData.expanded_bio}
                    onChange={(e) => setFormData(prev => ({ ...prev, expanded_bio: e.target.value }))}
                    rows={5}
                    className="resize-none"
                  />
                </div>

                <Separator />

                {/* Website & Location - Optional */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="website_url" className="text-sm font-medium flex items-center gap-2">
                      <Globe className="h-4 w-4" /> Website
                    </Label>
                    <Input
                      id="website_url"
                      type="url"
                      placeholder="https://yourwebsite.com"
                      value={formData.website_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, website_url: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country" className="text-sm font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4" /> Location
                    </Label>
                    <Input
                      id="country"
                      placeholder="New York, USA"
                      value={formData.country}
                      onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                    />
                  </div>
                </div>

                <Separator />

                {/* Read-only info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{user.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Joined {new Date(user.created_at || '').toLocaleDateString()}</span>
                  </div>
                </div>

                <Separator />

                {/* Actions */}
                {hasUnsavedChanges && (
                  <div className="flex items-center gap-2 text-sm text-warning bg-warning/10 p-3 rounded-md">
                    <AlertTriangle className="h-4 w-4" />
                    <span>You have unsaved changes</span>
                  </div>
                )}
                <div className="flex gap-3">
                  <Button type="submit" disabled={loading || !hasUnsavedChanges} className="flex-1">
                    {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Save Changes
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </div>
      </div>

      {/* Unsaved Changes Dialog */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes that will be lost if you leave this page. Do you want to discard your changes?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowUnsavedDialog(false)}>Stay on Page</AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscardChanges} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Avatar Crop Editor */}
      {formData.avatar_url && (
        <AvatarCropEditor
          open={showCropEditor}
          onOpenChange={setShowCropEditor}
          imageUrl={formData.avatar_url}
          initialZoom={formData.avatar_zoom}
          initialPositionX={formData.avatar_position_x}
          initialPositionY={formData.avatar_position_y}
          onSave={(zoom, posX, posY) => {
            setFormData(prev => ({ ...prev, avatar_zoom: zoom, avatar_position_x: posX, avatar_position_y: posY }));
          }}
        />
      )}
    </AppLayout>
  );
}
