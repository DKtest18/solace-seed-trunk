import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/dkaiDb';

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

interface UserSettingsContextType {
  settings: UserSettings;
  isLoading: boolean;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  isSaving: boolean;
}

const defaultSettings: UserSettings = {
  user_id: '',
  theme_color: 'default',
  sidebar_layout: 'default',
  message_privacy: 'everyone',
};

const UserSettingsContext = createContext<UserSettingsContextType | undefined>(undefined);

export function UserSettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) { fetchSettings(); } else { setSettings(defaultSettings); setIsLoading(false); }
  }, [user?.id]);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme_color && settings.theme_color !== 'default') {
      root.setAttribute('data-theme-color', settings.theme_color);
    } else {
      root.removeAttribute('data-theme-color');
    }
  }, [settings.theme_color]);

  const fetchSettings = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await db.from('dkai_user_settings').select('*').eq('user_id', user.id).single();
      if (error && error.code !== 'PGRST116') console.error('Error fetching settings:', error);
      if (data) {
        setSettings({ ...data, theme_color: data.theme_color as ThemeColor, sidebar_layout: data.sidebar_layout as SidebarLayout, message_privacy: data.message_privacy as MessagePrivacy });
      } else {
        setSettings({ ...defaultSettings, user_id: user.id });
      }
    } finally { setIsLoading(false); }
  };

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { data: existing } = await db.from('dkai_user_settings').select('id').eq('user_id', user.id).single();
      if (existing) {
        const { error } = await db.from('dkai_user_settings').update({ ...newSettings, updated_at: new Date().toISOString() }).eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await db.from('dkai_user_settings').insert({ user_id: user.id, ...newSettings });
        if (error) throw error;
      }
      setSettings(prev => ({ ...prev, ...newSettings }));
    } finally { setIsSaving(false); }
  };

  return (
    <UserSettingsContext.Provider value={{ settings, isLoading, updateSettings, isSaving }}>
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettingsContext() {
  const context = useContext(UserSettingsContext);
  if (!context) throw new Error('useUserSettingsContext must be used within UserSettingsProvider');
  return context;
}
