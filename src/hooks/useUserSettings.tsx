import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export type ThemeColor = 'default' | 'gold' | 'silver' | 'white' | 'black' | 'blue' | 'red' | 'green' | 'purple';
export type SidebarLayout = 'default' | 'messages-seller' | 'messages-search' | 'search-seller';
export type MessagePrivacy = 'everyone' | 'following_only' | 'messaged_only';

export interface UserSettings {
  id?: string;
  user_id: string;
  theme_color: ThemeColor;
  sidebar_layout: SidebarLayout;
  message_privacy: MessagePrivacy;
}

// Apply theme to document root
const applyTheme = (themeColor: ThemeColor) => {
  const root = document.documentElement;
  if (themeColor && themeColor !== 'default') {
    root.setAttribute('data-theme-color', themeColor);
  } else {
    root.removeAttribute('data-theme-color');
  }
};

export function useUserSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings, isLoading, refetch } = useQuery({
    queryKey: ['user-settings', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('dkai_user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as UserSettings | null;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Apply theme when settings are loaded or changed
  useEffect(() => {
    if (settings?.theme_color) {
      applyTheme(settings.theme_color);
    } else {
      applyTheme('default'); // Blue is the default theme
    }
  }, [settings?.theme_color]);

  const updateSettings = useMutation({
    mutationFn: async (newSettings: Partial<UserSettings>): Promise<void> => {
      if (!user) throw new Error('Not authenticated');
      
      // Immediately apply theme if it's being updated
      if (newSettings.theme_color) {
        applyTheme(newSettings.theme_color);
      }
      
      const { data: existing } = await supabase
        .from('dkai_user_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('dkai_user_settings')
          .update({ ...newSettings, updated_at: new Date().toISOString() })
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('dkai_user_settings')
          .insert({ user_id: user.id, ...newSettings });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings'] });
    },
  });

  const updateSettingsAsync = async (newSettings: Partial<UserSettings>): Promise<void> => {
    return updateSettings.mutateAsync(newSettings);
  };

  return {
    settings: settings || {
      user_id: user?.id || '',
      theme_color: 'default' as ThemeColor,
      sidebar_layout: 'default' as SidebarLayout,
      message_privacy: 'everyone' as MessagePrivacy,
    },
    isLoading,
    updateSettings: updateSettingsAsync,
    isSaving: updateSettings.isPending,
    refetch,
  };
}

// Theme color mappings for CSS
export const themeColorMap: Record<ThemeColor, { bg: string; accent: string; border: string }> = {
  default: { bg: 'bg-background', accent: 'text-primary', border: 'border-border' },
  gold: { bg: 'bg-amber-50 dark:bg-amber-950/20', accent: 'text-amber-600', border: 'border-amber-300' },
  silver: { bg: 'bg-slate-100 dark:bg-slate-900/50', accent: 'text-slate-500', border: 'border-slate-400' },
  white: { bg: 'bg-white dark:bg-zinc-900', accent: 'text-zinc-800 dark:text-zinc-200', border: 'border-zinc-200' },
  black: { bg: 'bg-zinc-900 dark:bg-black', accent: 'text-white', border: 'border-zinc-700' },
  blue: { bg: 'bg-blue-50 dark:bg-blue-950/20', accent: 'text-blue-600', border: 'border-blue-300' },
  red: { bg: 'bg-red-50 dark:bg-red-950/20', accent: 'text-red-600', border: 'border-red-300' },
  green: { bg: 'bg-green-50 dark:bg-green-950/20', accent: 'text-green-600', border: 'border-green-300' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-950/20', accent: 'text-purple-600', border: 'border-purple-300' },
};
