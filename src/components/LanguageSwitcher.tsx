import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe } from 'lucide-react';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { storeLanguage, type AppLanguage } from '@/lib/geoLanguage';

const languages: { code: AppLanguage; name: string; short: string }[] = [
  { code: 'en', name: 'English', short: 'EN' },
  { code: 'de', name: 'Deutsch', short: 'DE' },
  { code: 'fr', name: 'Français', short: 'FR' },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const { user } = useAuth();

  const active = (i18n.language || 'en').slice(0, 2);
  const currentLanguage = languages.find((lang) => lang.code === active) || languages[0];

  const changeLanguage = async (langCode: AppLanguage) => {
    i18n.changeLanguage(langCode);
    // Manual choice always wins over geo auto-detection on future visits.
    storeLanguage(langCode);
    document.documentElement.lang = langCode;

    // Persist to user settings if logged in
    if (user) {
      await db
        .from('dkai_user_settings')
        .upsert({ user_id: user.id, language: langCode }, { onConflict: 'user_id' });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2" aria-label="Language">
          <Globe className="h-4 w-4" />
          <span className="text-xs font-semibold">{currentLanguage.short}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className={active === lang.code ? 'bg-accent' : ''}
          >
            <span className="mr-2 text-xs font-semibold">{lang.short}</span>
            {lang.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
