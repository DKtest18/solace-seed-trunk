import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { useUserSettings, MessagePrivacy } from '@/hooks/useUserSettings';
import { Mail, Shield, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const privacyOptions: { value: MessagePrivacy; label: string; description: string }[] = [
  { 
    value: 'everyone', 
    label: 'Everyone can message me', 
    description: 'Anyone on the platform can send you messages' 
  },
  { 
    value: 'following_only', 
    label: 'Only users I follow', 
    description: 'Only users you follow can send you messages. Others go to spam.' 
  },
  { 
    value: 'messaged_only', 
    label: 'Only users I have messaged before', 
    description: 'Only users you have previously messaged can reply. Others go to spam.' 
  },
];

export function MessagePrivacySettings() {
  const { settings, updateSettings, isSaving, isLoading } = useUserSettings();
  const [selectedPrivacy, setSelectedPrivacy] = useState<MessagePrivacy>(settings.message_privacy);
  const [saving, setSaving] = useState(false);

  // Sync selected privacy when settings load
  useEffect(() => {
    if (settings.message_privacy) {
      setSelectedPrivacy(settings.message_privacy);
    }
  }, [settings.message_privacy]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({ message_privacy: selectedPrivacy });
      toast.success('Privacy settings saved!');
    } catch (error) {
      toast.error('Failed to save privacy settings');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = selectedPrivacy !== settings.message_privacy;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          <CardTitle>Message Privacy</CardTitle>
        </div>
        <CardDescription>
          Control who can send you direct messages
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup
          value={selectedPrivacy}
          onValueChange={(value) => setSelectedPrivacy(value as MessagePrivacy)}
          className="space-y-4"
          disabled={saving}
        >
          {privacyOptions.map((option) => (
            <div key={option.value} className="flex items-start space-x-3">
              <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
              <div className="space-y-1">
                <Label htmlFor={option.value} className="font-medium cursor-pointer">
                  {option.label}
                </Label>
                <p className="text-sm text-muted-foreground">{option.description}</p>
              </div>
            </div>
          ))}
        </RadioGroup>
        
        <div className="p-3 rounded-lg bg-muted/50 flex items-start gap-2">
          <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Messages that don't meet your privacy settings will be moved to your <strong>Spam/Müll</strong> folder, where you can review, delete, or move them to your inbox.
          </p>
        </div>

        {/* Save Button */}
        <Button 
          onClick={handleSave} 
          disabled={saving || !hasChanges}
          className="w-full"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Privacy Settings
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
