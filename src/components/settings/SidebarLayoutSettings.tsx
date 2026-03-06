import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useUserSettings, SidebarLayout } from '@/hooks/useUserSettings';
import { LayoutGrid, Check, MessageSquare, Search, Store, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const layoutOptions: { value: SidebarLayout; label: string; left: string; right: string; leftIcon: any; rightIcon: any }[] = [
  { value: 'default', label: 'Default', left: 'Messages', right: 'Seller Panel', leftIcon: MessageSquare, rightIcon: Store },
  { value: 'messages-seller', label: 'Messages + Seller', left: 'Messages', right: 'Seller Panel', leftIcon: MessageSquare, rightIcon: Store },
  { value: 'messages-search', label: 'Messages + Search', left: 'Messages', right: 'Search', leftIcon: MessageSquare, rightIcon: Search },
  { value: 'search-seller', label: 'Search + Seller', left: 'Search', right: 'Seller Panel', leftIcon: Search, rightIcon: Store },
];

export function SidebarLayoutSettings() {
  const { settings, updateSettings, isSaving, isLoading } = useUserSettings();
  const [selectedLayout, setSelectedLayout] = useState<SidebarLayout>(settings.sidebar_layout);
  const [saving, setSaving] = useState(false);

  // Sync selected layout when settings load
  useEffect(() => {
    if (settings.sidebar_layout) {
      setSelectedLayout(settings.sidebar_layout);
    }
  }, [settings.sidebar_layout]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({ sidebar_layout: selectedLayout });
      toast.success('Layout saved successfully!');
    } catch (error) {
      toast.error('Failed to save layout');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = selectedLayout !== settings.sidebar_layout;

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
          <LayoutGrid className="h-5 w-5" />
          <CardTitle>Sidebar Layout</CardTitle>
        </div>
        <CardDescription>
          Choose how the left and right panels are arranged across all pages
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          {layoutOptions.map((layout) => {
            const LeftIcon = layout.leftIcon;
            const RightIcon = layout.rightIcon;
            return (
              <button
                key={layout.value}
                onClick={() => setSelectedLayout(layout.value)}
                disabled={saving}
                className={`relative p-4 rounded-lg border-2 transition-all ${
                  selectedLayout === layout.value
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-muted hover:border-muted-foreground/50'
                }`}
              >
                <div className="flex gap-2 mb-3">
                  {/* Layout preview */}
                  <div className="flex-1 h-16 rounded bg-muted flex items-center justify-center">
                    <LeftIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-[2] h-16 rounded bg-muted/50" />
                  <div className="flex-1 h-16 rounded bg-muted flex items-center justify-center">
                    <RightIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <p className="text-sm font-medium">{layout.label}</p>
                <p className="text-xs text-muted-foreground">
                  {layout.left} | {layout.right}
                </p>
                {selectedLayout === layout.value && (
                  <div className="absolute top-2 right-2">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Live Preview Section */}
        <div className="space-y-2">
          <Label className="text-base font-medium">Layout Preview</Label>
          <div className="p-4 rounded-lg border-2 border-border bg-muted/20">
            <div className="flex gap-2 h-32">
              <div className="flex-1 rounded bg-primary/20 flex items-center justify-center">
                <span className="text-xs font-medium text-muted-foreground">
                  {layoutOptions.find(l => l.value === selectedLayout)?.left}
                </span>
              </div>
              <div className="flex-[3] rounded bg-background border flex items-center justify-center">
                <span className="text-xs text-muted-foreground">Main Content</span>
              </div>
              <div className="flex-1 rounded bg-primary/20 flex items-center justify-center">
                <span className="text-xs font-medium text-muted-foreground">
                  {layoutOptions.find(l => l.value === selectedLayout)?.right}
                </span>
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
              Save Layout
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
