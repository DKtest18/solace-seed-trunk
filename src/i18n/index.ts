import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
// NOTE: de.json and fr.json contain MACHINE-DRAFTED copy that still needs human
// review (DACH and Suisse romande audiences). English (en) is the source of
// truth and the fallback language: missing keys render the English string,
// never a raw key.
import de from './locales/de.json';
import fr from './locales/fr.json';

import {
  getStoredLanguage,
  storeLanguage,
  type AppLanguage,
} from '@/lib/geoLanguage';

const resources = {
  en: { translation: en },
  de: { translation: de },
  fr: { translation: fr },
};

const stored = getStoredLanguage();
// English is the default for every new visitor. An explicit manual choice is
// preserved until the visitor changes it again in the language switcher.
const initialLng: AppLanguage = stored ?? 'en';

i18n.use(initReactI18next).init({
  resources,
  lng: initialLng,
  fallbackLng: 'en',
  supportedLngs: ['en', 'de', 'fr'],
  interpolation: {
    escapeValue: false,
  },
});

const applyHtmlLang = (lng: string) => {
  if (typeof document !== 'undefined') document.documentElement.lang = lng;
};
applyHtmlLang(initialLng);
i18n.on('languageChanged', applyHtmlLang);

export { storeLanguage };
export default i18n;
