/**
 * Client-side language auto-detection (first visit only).
 *
 * Rules:
 *  - Manual choice in localStorage (LANG_STORAGE_KEY) always wins.
 *  - CH + French-speaking canton (GE, VD, NE, JU, VS, FR) -> "fr"
 *  - CH, any other canton (incl. Ticino, out of scope)    -> "de"
 *  - DE, AT, LI                                           -> "de"
 *  - FR, BE, LU, MC                                       -> "fr"
 *  - Every other country                                  -> "en"
 *  - Geo failure/timeout -> navigator.language ("fr*" -> fr, "de*" -> de, else en)
 *
 * Geo API: https://ipwho.is/ (free, no key, returns country_code + region_code).
 * Never blocks rendering: the app renders in English (default) and switches
 * when/if the answer arrives.
 */

export type AppLanguage = 'en' | 'de' | 'fr';

export const LANG_STORAGE_KEY = 'dkaim_lang';

export const SUPPORTED_LANGUAGES: AppLanguage[] = ['en', 'de', 'fr'];

const FRENCH_CANTONS = ['GE', 'VD', 'NE', 'JU', 'VS', 'FR'];
const GERMAN_COUNTRIES = ['DE', 'AT', 'LI'];
const FRENCH_COUNTRIES = ['FR', 'BE', 'LU', 'MC'];

export function getStoredLanguage(): AppLanguage | null {
  try {
    const v = localStorage.getItem(LANG_STORAGE_KEY);
    return v === 'de' || v === 'fr' || v === 'en' ? v : null;
  } catch {
    return null;
  }
}

export function storeLanguage(lang: AppLanguage) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
    // keep the i18next detector cache in sync
    localStorage.setItem('i18nextLng', lang);
  } catch {
    /* ignore (private mode) */
  }
}

export function languageFromNavigator(): AppLanguage {
  const nav = ((typeof navigator !== 'undefined' && navigator.language) || '').toLowerCase();
  if (nav.startsWith('fr')) return 'fr';
  if (nav.startsWith('de')) return 'de';
  return 'en';
}

function normalizeRegion(raw: unknown): string {
  const s = String(raw ?? '').trim().toUpperCase();
  // ipwho.is may return "VD" or "CH-VD"
  const parts = s.split('-');
  return parts[parts.length - 1];
}

export function languageFromGeo(countryRaw: unknown, regionRaw: unknown): AppLanguage | null {
  const country = String(countryRaw ?? '').trim().toUpperCase();
  if (!country) return null;
  if (country === 'CH') {
    return FRENCH_CANTONS.includes(normalizeRegion(regionRaw)) ? 'fr' : 'de';
  }
  if (GERMAN_COUNTRIES.includes(country)) return 'de';
  if (FRENCH_COUNTRIES.includes(country)) return 'fr';
  return 'en';
}

export async function detectLanguageFromGeo(timeoutMs = 2000): Promise<AppLanguage> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('https://ipwho.is/?fields=success,country_code,region_code', {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error('geo http error');
    const data = await res.json();
    const lang = languageFromGeo(data?.country_code, data?.region_code);
    if (!lang) throw new Error('geo empty');
    return lang;
  } catch {
    return languageFromNavigator();
  } finally {
    clearTimeout(timer);
  }
}
