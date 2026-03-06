/**
 * Text Normalization Pipeline for Moderation
 * Handles obfuscation, leetspeak, unicode tricks, and multilingual text
 */

// Leetspeak and character substitution map
const LEET_MAP: Record<string, string> = {
  '0': 'o', 'ø': 'o', 'θ': 'o', 'ọ': 'o', 'ồ': 'o',
  '1': 'i', '|': 'i', '!': 'i', 'ỉ': 'i', 'ị': 'i',
  '2': 'z', '²': 'z',
  '3': 'e', 'ε': 'e', '€': 'e', 'ẹ': 'e', 'ề': 'e',
  '4': 'a', '@': 'a', 'α': 'a', 'ạ': 'a', 'ầ': 'a', 'ả': 'a',
  '5': 's', '$': 's', '§': 's',
  '6': 'g', '9': 'g',
  '7': 't', '+': 't', '†': 't',
  '8': 'b',
  '*': 'a',
  'ü': 'u', 'ù': 'u', 'ú': 'u', 'û': 'u', 'ụ': 'u',
  'ä': 'a', 'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a',
  'ö': 'o', 'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o',
  'ï': 'i', 'ì': 'i', 'í': 'i', 'î': 'i',
  'ë': 'e', 'è': 'e', 'é': 'e', 'ê': 'e',
  'ÿ': 'y', 'ý': 'y',
  'ñ': 'n', 'ń': 'n',
  'ç': 'c', 'ć': 'c',
  'ß': 'ss',
  'æ': 'ae', 'œ': 'oe',
  'ł': 'l', 'ľ': 'l',
  'ř': 'r', 'ŕ': 'r',
  'š': 's', 'ś': 's',
  'ž': 'z', 'ź': 'z', 'ż': 'z',
  'đ': 'd', 'ď': 'd',
  'ť': 't',
  'ň': 'n',
};

// Cyrillic to Latin transliteration
const CYRILLIC_MAP: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd',
  'е': 'e', 'ё': 'yo', 'ж': 'zh', 'з': 'z', 'и': 'i',
  'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n',
  'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't',
  'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch',
  'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '',
  'э': 'e', 'ю': 'yu', 'я': 'ya',
  // Uppercase
  'А': 'a', 'Б': 'b', 'В': 'v', 'Г': 'g', 'Д': 'd',
  'Е': 'e', 'Ё': 'yo', 'Ж': 'zh', 'З': 'z', 'И': 'i',
  'Й': 'y', 'К': 'k', 'Л': 'l', 'М': 'm', 'Н': 'n',
  'О': 'o', 'П': 'p', 'Р': 'r', 'С': 's', 'Т': 't',
  'У': 'u', 'Ф': 'f', 'Х': 'h', 'Ц': 'ts', 'Ч': 'ch',
  'Ш': 'sh', 'Щ': 'sch', 'Ъ': '', 'Ы': 'y', 'Ь': '',
  'Э': 'e', 'Ю': 'yu', 'Я': 'ya',
};

/**
 * Remove repeated characters (e.g., "killllll" -> "kill")
 */
function collapseRepeatedChars(text: string): string {
  return text.replace(/(.)\1{2,}/g, '$1$1');
}

/**
 * Remove punctuation used to obfuscate words (e.g., "f.u.c.k" -> "fuck")
 */
function removePunctuationObfuscation(text: string): string {
  // Remove dots, dashes, underscores between letters
  return text.replace(/([a-z])[\.\-_\*]+([a-z])/gi, '$1$2');
}

/**
 * Normalize spaces used to break words (e.g., "k i l l" -> "kill")
 */
function normalizeSpacedLetters(text: string): string {
  // Detect single letters with spaces between them
  const spacedPattern = /\b([a-z])\s+([a-z])\s+([a-z])\s*([a-z])?/gi;
  return text.replace(spacedPattern, (match, ...groups) => {
    const letters = groups.slice(0, 4).filter(Boolean).join('');
    return letters;
  });
}

/**
 * Apply leetspeak and character substitution
 */
function applyLeetMap(text: string): string {
  let result = '';
  for (const char of text) {
    result += LEET_MAP[char] || char;
  }
  return result;
}

/**
 * Transliterate Cyrillic text
 */
function transliterateCyrillic(text: string): string {
  let result = '';
  for (const char of text) {
    result += CYRILLIC_MAP[char] || char;
  }
  return result;
}

/**
 * Remove zero-width and invisible characters
 */
function removeInvisibleChars(text: string): string {
  return text.replace(/[\u200B-\u200D\uFEFF\u00AD\u2060\u180E]/g, '');
}

/**
 * Normalize unicode homoglyphs (lookalike characters)
 */
function normalizeHomoglyphs(text: string): string {
  const homoglyphMap: Record<string, string> = {
    'ɑ': 'a', 'а': 'a', // Cyrillic а
    'Ь': 'b', 'ь': 'b',
    'с': 'c', 'ϲ': 'c', // Cyrillic с
    'ԁ': 'd',
    'е': 'e', // Cyrillic е
    'ɡ': 'g',
    'һ': 'h', // Cyrillic һ
    'і': 'i', // Cyrillic і
    'ј': 'j', // Cyrillic ј
    'ĸ': 'k',
    'ⅼ': 'l', 'ℓ': 'l',
    'ո': 'n',
    'о': 'o', 'ο': 'o', // Cyrillic о, Greek ο
    'р': 'p', // Cyrillic р
    'ԛ': 'q',
    'ѕ': 's', // Cyrillic ѕ
    'ս': 'u',
    'ν': 'v', // Greek ν
    'ѡ': 'w',
    'х': 'x', // Cyrillic х
    'у': 'y', // Cyrillic у
    'ᴢ': 'z',
  };
  
  let result = '';
  for (const char of text) {
    result += homoglyphMap[char.toLowerCase()] || char;
  }
  return result;
}

/**
 * Full normalization pipeline
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  
  let normalized = text.toLowerCase();
  
  // Step 1: Remove invisible characters
  normalized = removeInvisibleChars(normalized);
  
  // Step 2: Normalize homoglyphs
  normalized = normalizeHomoglyphs(normalized);
  
  // Step 3: Transliterate Cyrillic
  normalized = transliterateCyrillic(normalized);
  
  // Step 4: Apply leetspeak mapping
  normalized = applyLeetMap(normalized);
  
  // Step 5: Remove punctuation obfuscation
  normalized = removePunctuationObfuscation(normalized);
  
  // Step 6: Normalize spaced letters
  normalized = normalizeSpacedLetters(normalized);
  
  // Step 7: Collapse repeated characters
  normalized = collapseRepeatedChars(normalized);
  
  // Step 8: Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

/**
 * Generate a hash for audit logging (privacy-safe)
 */
export function generateContentHash(text: string): string {
  // Simple hash for browser environment
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
