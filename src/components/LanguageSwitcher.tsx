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

const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' }
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const { user } = useAuth();

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  const changeLanguage = async (langCode: string) => {
    i18n.changeLanguage(langCode);
    localStorage.setItem('i18nextLng', langCode);
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
        <Button variant="ghost" size="sm" className="gap-2">
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">{currentLanguage.flag} {currentLanguage.name}</span>
          <span className="sm:hidden">{currentLanguage.flag}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className={i18n.language === lang.code ? 'bg-accent' : ''}
          >
            <span className="mr-2">{lang.flag}</span>
            {lang.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
