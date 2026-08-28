import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import de from './locales/de.json';
// NOTE: fr.json is a MACHINE-DRAFTED first draft and needs human review
// (Suisse romande audience). Missing keys fall back to German.
import fr from './locales/fr.json';

import {
  detectLanguageFromGeo,
  getStoredLanguage,
  languageFromNavigator,
  storeLanguage,
  type AppLanguage,
} from '@/lib/geoLanguage';

const resources = {
  en: { translation: en },
  de: { translation: de },
  fr: { translation: fr },
};

const stored = getStoredLanguage();
// Render immediately in a sensible default; geo answer may switch it later.
const initialLng: AppLanguage = stored ?? languageFromNavigator();

i18n.use(initReactI18next).init({
  resources,
  lng: initialLng,
  fallbackLng: 'de',
  supportedLngs: ['de', 'fr', 'en'],
  interpolation: {
    escapeValue: false,
  },
});

const applyHtmlLang = (lng: string) => {
  if (typeof document !== 'undefined') document.documentElement.lang = lng;
};
applyHtmlLang(initialLng);
i18n.on('languageChanged', applyHtmlLang);

// First visit only: auto-detect via IP geolocation (client-side, non-blocking).
if (!stored && typeof window !== 'undefined') {
  detectLanguageFromGeo().then((lng) => {
    // A manual choice made while the request was in flight always wins.
    if (getStoredLanguage()) return;
    if (lng !== i18n.language) i18n.changeLanguage(lng);
  });
}

export { storeLanguage };
export default i18n;
