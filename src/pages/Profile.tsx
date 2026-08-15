import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { CountryCombobox } from '@/components/CountryCombobox';

import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/dkaiDb';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, User, Globe, MapPin, Mail, Calendar, Camera, AlertTriangle, Crop, Trash2, ArrowLeft, ImageIcon, Sparkles } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';

import { AppLayout } from '@/components/AppLayout';
import { useHasRole } from '@/hooks/useUserRole';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AvatarCropEditor, getAvatarCropStyle } from '@/components/AvatarCropEditor';
import { ExperienceEditor } from '@/components/profile/ExperienceEditor';
import { EducationEditor } from '@/components/profile/EducationEditor';
import { SkillsTagInput } from '@/components/profile/SkillsTagInput';
import { LinkedInImportCard } from '@/components/profile/LinkedInImportCard';
import type { LinkedInImportResult } from '@/lib/linkedinImport';

import { EducationItem, ExperienceItem, parseJsonArray } from '@/types/profile';



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

  const emptyProfile = {
    username: '',
    full_name: '',
    headline: '',
    bio: '',
    website_url: '',
    country: '',
    avatar_url: '',
    expanded_bio: '',
    avatar_zoom: 1,
    avatar_position_x: 50,
    avatar_position_y: 50,
  };

  const [originalData, setOriginalData] = useState({ ...emptyProfile, banner_url: '' });
  const [formData, setFormData] = useState({ ...emptyProfile });

  const [bannerUrl, setBannerUrl] = useState('');
  const [previousBannerUrl, setPreviousBannerUrl] = useState('');

  const [experience, setExperience] = useState<ExperienceItem[]>([]);
  const [education, setEducation] = useState<EducationItem[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [originalRich, setOriginalRich] = useState({ experience: '[]', education: '[]', skills: '[]' });

  const emptyStatus = { open_to_work: false, open_to_roles: '', is_hiring: false, hiring_roles: '' };
  const [status, setStatus] = useState(emptyStatus);
  const [originalStatus, setOriginalStatus] = useState(emptyStatus);

  /** Merges a parsed LinkedIn data export into the form (does not save until the user submits). */
  const applyLinkedInImport = (result: LinkedInImportResult) => {
    setFormData(prev => ({
      ...prev,
      headline: result.headline ? result.headline.slice(0, 160) : prev.headline,
      expanded_bio: result.about ? result.about.slice(0, 2000) : prev.expanded_bio,
      website_url: result.website || prev.website_url,
    }));
    if (result.experience.length) setExperience(result.experience);
    if (result.education.length) setEducation(result.education);
    if (result.skills.length) {
      setSkills(prev => Array.from(new Set([...prev, ...result.skills])).slice(0, 30));
    }
  };




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
      headline: data.headline || '',
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

    const { banner_url, ...rest } = profileData;
    setFormData(rest);
    setOriginalData(profileData);
    setBannerUrl(banner_url);
    setPreviousBannerUrl(banner_url);

    const exp = parseJsonArray<ExperienceItem>(data.experience);
    const edu = parseJsonArray<EducationItem>(data.education);
    const sk = parseJsonArray<string>(data.skills);
    setExperience(exp);
    setEducation(edu);
    setSkills(sk);
    setOriginalRich({
      experience: JSON.stringify(exp),
      education: JSON.stringify(edu),
      skills: JSON.stringify(sk),
    });

    const statusData = {
      open_to_work: !!data.open_to_work,
      open_to_roles: data.open_to_roles || '',
      is_hiring: !!data.is_hiring,
      hiring_roles: data.hiring_roles || '',
    };
    setStatus(statusData);
    setOriginalStatus(statusData);
    setHasUnsavedChanges(false);
  };

  useEffect(() => {
    const hasChanges =
      formData.username !== originalData.username ||
      formData.full_name !== originalData.full_name ||
      formData.headline !== originalData.headline ||
      formData.bio !== originalData.bio ||
      formData.website_url !== originalData.website_url ||
      formData.country !== originalData.country ||
      formData.avatar_url !== originalData.avatar_url ||
      formData.expanded_bio !== originalData.expanded_bio ||
      formData.avatar_zoom !== originalData.avatar_zoom ||
      formData.avatar_position_x !== originalData.avatar_position_x ||
      formData.avatar_position_y !== originalData.avatar_position_y ||
      bannerUrl !== originalData.banner_url ||
      JSON.stringify(experience) !== originalRich.experience ||
      JSON.stringify(education) !== originalRich.education ||
      JSON.stringify(skills) !== originalRich.skills ||
      JSON.stringify(status) !== JSON.stringify(originalStatus);

    setHasUnsavedChanges(hasChanges);
  }, [formData, bannerUrl, originalData, experience, education, skills, originalRich, status, originalStatus]);



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

    // Oversized banners are downscaled automatically instead of being rejected.
    const maxWidth = isAdmin ? 1920 : 1600;

    setUploadingBanner(true);
    try {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      const loaded = await new Promise<boolean>((resolve) => {
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = objectUrl;
      });
      if (!loaded) throw new Error('Could not read this image file.');

      let uploadBody: Blob = file;
      let uploadExt = (file.name.split('.').pop() || 'jpg').toLowerCase();

      if (img.width > maxWidth) {
        const scale = maxWidth / img.width;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9),
          );
          if (blob) {
            uploadBody = blob;
            uploadExt = 'jpg';
          }
        }
      }
      URL.revokeObjectURL(objectUrl);

      const fileName = `${user.id}-banner-${Date.now()}.${uploadExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, uploadBody, {
          cacheControl: '3600',
          upsert: true,
          contentType: uploadBody instanceof File ? file.type : 'image/jpeg',
        });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setBannerUrl(urlData.publicUrl);
      toast({ title: 'Banner uploaded', description: 'Click "Save Changes" to persist your new banner.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to upload banner', variant: 'destructive' });
    } finally {
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
          headline: formData.headline || null,
          bio: formData.bio || null,
          website_url: formData.website_url || null,
          country: formData.country || null,
          avatar_url: formData.avatar_url || null,
          expanded_bio: formData.expanded_bio || null,
          banner_url: bannerUrl || null,
          experience,
          education,
          skills,
          open_to_work: status.open_to_work,
          open_to_roles: status.open_to_roles || null,
          is_hiring: status.is_hiring,
          hiring_roles: status.hiring_roles || null,

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
        headline: updatedData.headline || '',
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
      const { banner_url, ...savedForm } = savedData;
      setFormData(savedForm);
      setOriginalData(savedData);
      setBannerUrl(banner_url);
      setPreviousBannerUrl(banner_url);

      const savedExp = parseJsonArray<ExperienceItem>(updatedData.experience);
      const savedEdu = parseJsonArray<EducationItem>(updatedData.education);
      const savedSkills = parseJsonArray<string>(updatedData.skills);
      setExperience(savedExp);
      setEducation(savedEdu);
      setSkills(savedSkills);
      setOriginalRich({
        experience: JSON.stringify(savedExp),
        education: JSON.stringify(savedEdu),
        skills: JSON.stringify(savedSkills),
      });
      const savedStatus = {
        open_to_work: !!updatedData.open_to_work,
        open_to_roles: updatedData.open_to_roles || '',
        is_hiring: !!updatedData.is_hiring,
        hiring_roles: updatedData.hiring_roles || '',
      };
      setStatus(savedStatus);
      setOriginalStatus(savedStatus);
      setHasUnsavedChanges(false);


      window.dispatchEvent(new Event('dkai:profile-updated'));
      toast({ title: 'Success', description: 'Profile saved successfully.' });

      if (fromChecklist) {
        navigate('/seller-onboarding');
        return;
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to update profile', variant: 'destructive' });
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
    const { banner_url, ...form } = originalData;
    setFormData(form);
    setBannerUrl(banner_url);
    setExperience(parseJsonArray<ExperienceItem>(JSON.parse(originalRich.experience)));
    setEducation(parseJsonArray<EducationItem>(JSON.parse(originalRich.education)));
    setSkills(parseJsonArray<string>(JSON.parse(originalRich.skills)));
    setStatus(originalStatus);


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
        {fromChecklist && (
          <div className="max-w-3xl mx-auto px-4 pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/seller-onboarding')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Checklist
            </Button>
          </div>
        )}
        {/* Banner + overlapping avatar (LinkedIn style) */}
        <div className="max-w-3xl mx-auto px-4 pt-8">
          <Input
            id="banner-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleBannerUpload}
            disabled={uploadingBanner}
          />

          <Card className="overflow-hidden">
            <div className="relative">
              <div className="relative aspect-[4/1] w-full bg-background-soft">
                {bannerUrl ? (
                  <img src={bannerUrl} alt="Profile banner" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground gap-1">
                    <ImageIcon className="h-6 w-6" />
                    <span className="text-xs">Add a banner image (4:1 recommended)</span>
                  </div>
                )}
                <div className="absolute top-3 right-3 flex gap-2">
                  <Label htmlFor="banner-upload" className="cursor-pointer">
                    <div className="h-9 px-3 rounded-full bg-primary text-primary-foreground text-sm flex items-center gap-2 shadow-md hover:bg-primary/90 transition-colors">
                      {uploadingBanner ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                      <span className="hidden sm:inline">{bannerUrl ? 'Change banner' : 'Upload banner'}</span>
                    </div>
                  </Label>
                  {bannerUrl && (
                    <button
                      type="button"
                      aria-label="Remove banner"
                      onClick={() => setBannerUrl('')}
                      className="h-9 w-9 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md hover:bg-destructive/90 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Avatar overlapping bottom-left */}
              <div className="px-4 sm:px-6 pb-5">
                <div className="relative -mt-12 sm:-mt-16 w-fit">
                  <Avatar className="h-24 w-24 sm:h-32 sm:w-32 border-4 border-background shadow-xl overflow-hidden">
                    <AvatarImage
                      src={formData.avatar_url}
                      style={getAvatarCropStyle(formData.avatar_zoom, formData.avatar_position_x, formData.avatar_position_y)}
                    />
                    <AvatarFallback className="text-3xl">
                      <User className="h-12 w-12" />
                    </AvatarFallback>
                  </Avatar>
                  <Label htmlFor="avatar-upload" className="absolute bottom-0 right-0 cursor-pointer">
                    <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors">
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    </div>
                  </Label>
                  <Input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={uploading}
                  />
                </div>
                {formData.avatar_url && (
                  <div className="flex gap-2 mt-3">
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowCropEditor(true)}>
                      <Crop className="h-4 w-4 mr-1" /> Adjust photo
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={handleAvatarDelete}>
                      <Trash2 className="h-4 w-4 mr-1 text-destructive" /> Remove photo
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>


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

                {/* Headline */}
                <div className="space-y-2">
                  <Label htmlFor="headline" className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> Headline
                  </Label>
                  <Input
                    id="headline"
                    placeholder="Founder at DK AI Marketplace"
                    maxLength={220}
                    value={formData.headline}
                    onChange={(e) => setFormData(prev => ({ ...prev, headline: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">A short, one-line professional title.</p>
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
                    <CountryCombobox
                      id="country"
                      value={formData.country}
                      onChange={(value) => setFormData(prev => ({ ...prev, country: value }))}
                    />

                  </div>
                </div>

                <Separator />

                {/* One-click import from a LinkedIn data export */}
                <LinkedInImportCard onImported={applyLinkedInImport} />

                <Separator />

                {/* Work Experience */}
                <ExperienceEditor items={experience} onChange={setExperience} />


                <Separator />

                {/* Education */}
                <EducationEditor items={education} onChange={setEducation} />

                <Separator />

                {/* Skills */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Skills</Label>
                  <SkillsTagInput skills={skills} onChange={setSkills} />
                </div>

                <Separator />

                {/* Profile status frame */}
                <div className="space-y-4">
                  <Label className="text-sm font-medium">Profile status frame</Label>
                  <p className="text-xs text-muted-foreground">
                    Shows a badge around your profile photo, like LinkedIn's "Open to work" and "Hiring" frames.
                  </p>

                  <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
                    <div className="space-y-1">
                      <Label htmlFor="open_to_work" className="text-sm">Open to work</Label>
                      <p className="text-xs text-muted-foreground">Let buyers and sellers know you're available.</p>
                    </div>
                    <Switch
                      id="open_to_work"
                      checked={status.open_to_work}
                      onCheckedChange={(v) => setStatus(prev => ({ ...prev, open_to_work: v }))}
                    />
                  </div>
                  {status.open_to_work && (
                    <Input
                      placeholder="Roles you're open to (e.g. AI Automation Consultant)"
                      maxLength={160}
                      value={status.open_to_roles}
                      onChange={(e) => setStatus(prev => ({ ...prev, open_to_roles: e.target.value }))}
                    />
                  )}

                  <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
                    <div className="space-y-1">
                      <Label htmlFor="is_hiring" className="text-sm">Hiring</Label>
                      <p className="text-xs text-muted-foreground">Show that you're recruiting for your team.</p>
                    </div>
                    <Switch
                      id="is_hiring"
                      checked={status.is_hiring}
                      onCheckedChange={(v) => setStatus(prev => ({ ...prev, is_hiring: v }))}
                    />
                  </div>
                  {status.is_hiring && (
                    <Input
                      placeholder="Roles you're hiring for (e.g. Prompt Engineer)"
                      maxLength={160}
                      value={status.hiring_roles}
                      onChange={(e) => setStatus(prev => ({ ...prev, hiring_roles: e.target.value }))}
                    />
                  )}
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
