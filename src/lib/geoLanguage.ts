/**
 * Client-side language auto-detection (first visit only).
 *
 * Rules:
 *  - Manual choice in localStorage (LANG_STORAGE_KEY) always wins.
 *  - Switzerland + French-speaking canton (GE, VD, NE, JU, VS, FR) -> "fr"
 *  - Any other Swiss canton and every non-Swiss visitor            -> "de"
 *  - Geo failure/timeout -> navigator.language ("fr*" -> fr, else de)
 *
 * Geo API: https://ipwho.is/ (free, no key, returns country_code + region_code).
 * Never blocks rendering: the app renders in a sensible default and switches
 * when/if the answer arrives.
 */

export type AppLanguage = 'de' | 'fr';

export const LANG_STORAGE_KEY = 'dkaim_lang';

const FRENCH_CANTONS = ['GE', 'VD', 'NE', 'JU', 'VS', 'FR'];

export function getStoredLanguage(): AppLanguage | null {
  try {
    const v = localStorage.getItem(LANG_STORAGE_KEY);
    return v === 'de' || v === 'fr' ? v : null;
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
  const nav = (typeof navigator !== 'undefined' && navigator.language) || '';
  return nav.toLowerCase().startsWith('fr') ? 'fr' : 'de';
}

function normalizeRegion(raw: unknown): string {
  const s = String(raw ?? '').trim().toUpperCase();
  // ipwho.is may return "VD" or "CH-VD"
  const parts = s.split('-');
  return parts[parts.length - 1];
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
    const country = String(data?.country_code ?? '').toUpperCase();
    const region = normalizeRegion(data?.region_code);
    if (country === 'CH') {
      return FRENCH_CANTONS.includes(region) ? 'fr' : 'de';
    }
    if (country) return 'de';
    throw new Error('geo empty');
  } catch {
    return languageFromNavigator();
  } finally {
    clearTimeout(timer);
  }
}
