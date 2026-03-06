import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useUserSettings, ThemeColor, themeColorMap } from '@/hooks/useUserSettings';
import { Palette, Check, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const themeOptions: { value: ThemeColor; label: string; colorClass: string }[] = [
  { value: 'default', label: 'Default Blue', colorClass: 'bg-[hsl(213,94%,50%)]' },
  { value: 'blue', label: 'Blue', colorClass: 'bg-[hsl(217,91%,60%)]' },
  { value: 'purple', label: 'Purple', colorClass: 'bg-[hsl(270,70%,55%)]' },
  { value: 'green', label: 'Green', colorClass: 'bg-[hsl(142,71%,45%)]' },
  { value: 'red', label: 'Red', colorClass: 'bg-[hsl(0,72%,51%)]' },
  { value: 'gold', label: 'Gold', colorClass: 'bg-[hsl(45,93%,47%)]' },
  { value: 'silver', label: 'Silver', colorClass: 'bg-[hsl(210,11%,50%)]' },
  { value: 'white', label: 'White', colorClass: 'bg-white border border-zinc-300' },
  { value: 'black', label: 'Black', colorClass: 'bg-zinc-900' },
];

export function AppearanceSettings() {
  const { settings, updateSettings, isSaving, isLoading } = useUserSettings();
  const [selectedTheme, setSelectedTheme] = useState<ThemeColor>(settings.theme_color);
  const [saving, setSaving] = useState(false);

  // Sync selected theme when settings load
  useEffect(() => {
    if (settings.theme_color) {
      setSelectedTheme(settings.theme_color);
    }
  }, [settings.theme_color]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({ theme_color: selectedTheme });
      toast.success('Theme saved successfully!');
    } catch (error) {
      toast.error('Failed to save theme');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = selectedTheme !== settings.theme_color;

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
          <Palette className="h-5 w-5" />
          <CardTitle>Profile Appearance</CardTitle>
        </div>
        <CardDescription>
          Customize how your pages look across the platform
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <Label className="text-base font-medium">Theme Color</Label>
          <div className="grid grid-cols-4 gap-3">
            {themeOptions.map((theme) => (
              <button
                key={theme.value}
                onClick={() => setSelectedTheme(theme.value)}
                disabled={saving}
                className={`relative p-4 rounded-lg border-2 transition-all ${
                  selectedTheme === theme.value
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-muted hover:border-muted-foreground/50'
                }`}
              >
                <div className={`w-full h-12 rounded-md ${theme.colorClass} mb-2`} />
                <span className="text-sm font-medium">{theme.label}</span>
                {selectedTheme === theme.value && (
                  <div className="absolute top-2 right-2">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Profile Preview */}
        <div className="space-y-2">
          <Label className="text-base font-medium">Profile Preview</Label>
          <div className={`p-6 rounded-lg border-2 ${themeColorMap[selectedTheme].bg} ${themeColorMap[selectedTheme].border}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-muted" />
              <div>
                <p className={`font-semibold ${themeColorMap[selectedTheme].accent}`}>
                  Your Username
                </p>
                <p className="text-sm text-muted-foreground">@username</p>
              </div>
            </div>
            <p className="text-sm">This is how your profile will appear to others.</p>
          </div>
        </div>

        {/* Marketplace Preview */}
        <div className="space-y-2">
          <Label className="text-base font-medium">Marketplace Preview</Label>
          <div className={`p-4 rounded-lg border-2 ${themeColorMap[selectedTheme].bg} ${themeColorMap[selectedTheme].border}`}>
            <div className="grid grid-cols-3 gap-2">
              <div className="h-16 rounded bg-muted/50" />
              <div className="col-span-2 space-y-2">
                <div className="flex gap-2">
                  <div className="h-20 w-20 rounded bg-muted/60" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-3/4 rounded bg-muted/60" />
                    <div className="h-2 w-1/2 rounded bg-muted/40" />
                    <div className={`h-4 w-16 rounded ${themeColorMap[selectedTheme].accent} opacity-50`} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Community Preview */}
        <div className="space-y-2">
          <Label className="text-base font-medium">Community Preview</Label>
          <div className={`p-4 rounded-lg border-2 ${themeColorMap[selectedTheme].bg} ${themeColorMap[selectedTheme].border}`}>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-muted/60" />
                <div className="h-3 w-24 rounded bg-muted/50" />
              </div>
              <div className="h-12 rounded bg-muted/40" />
              <div className="flex gap-2 ml-10">
                <div className="w-6 h-6 rounded-full bg-muted/50" />
                <div className="flex-1 p-2 rounded bg-muted/30">
                  <div className="h-2 w-3/4 rounded bg-muted/40" />
                </div>
              </div>
            </div>
          </div>
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
              Save Theme
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
