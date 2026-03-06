// Local AI content moderation - privacy-safe, no external API calls
// This runs entirely client-side with pattern matching

// Prohibited content patterns
const spamPatterns = [
  /free\s+money/i,
  /click\s+here\s+now/i,
  /limited\s+time\s+offer/i,
  /act\s+now/i,
  /congratulations\s+you\s+won/i,
  /claim\s+your\s+prize/i,
  /earn\s+\$\d+\s+per\s+(day|hour|week)/i,
  /make\s+money\s+fast/i,
  /work\s+from\s+home\s+\$\d+/i,
  /bitcoin\s+investment/i,
  /crypto\s+giveaway/i,
  /double\s+your\s+money/i,
  /(telegram|whatsapp)\s*:?\s*\+?\d+/i,
  /DM\s+me\s+for\s+(free|deals|offers)/i,
];

const phishingPatterns = [
  /verify\s+your\s+(account|password|identity)/i,
  /your\s+account\s+(has\s+been|will\s+be)\s+(suspended|closed)/i,
  /click\s+to\s+confirm\s+your/i,
  /update\s+your\s+payment/i,
  /unusual\s+activity\s+detected/i,
  /login\s+immediately\s+to\s+avoid/i,
  /suspended\s+unless\s+you/i,
  /password\s+expired/i,
];

const violencePatterns = [
  /\b(kill|murder|shoot|stab|attack)\s+(you|him|her|them)\b/i,
  /\bi('ll|'m\s+going\s+to)\s+(kill|hurt|harm)/i,
  /\bdeath\s+threat/i,
  /\bI\s+will\s+find\s+you/i,
  /\bwatch\s+your\s+back/i,
];

const illegalPatterns = [
  /\b(buy|sell)\s+(drugs|cocaine|heroin|meth)/i,
  /\b(stolen|counterfeit)\s+(cards?|accounts?|items?)/i,
  /\bhacked?\s+accounts?\b/i,
  /\bcredit\s+card\s+dumps?\b/i,
  /\bfake\s+(id|passport|license)/i,
  /\bweapons?\s+for\s+sale/i,
];

const adultPatterns = [
  /\b(nsfw|xxx|porn|nude|naked|sex\s+tape)/i,
  /\bonlyfans\s+(link|account)/i,
  /\bexplicit\s+content/i,
  /\badult\s+content/i,
];

const harassmentPatterns = [
  /\b(retard|faggot|nigger|kike|spic|chink)\b/i,
  /\bkill\s+yourself\b/i,
  /\bgo\s+die\b/i,
  /\byou\s+(are|'re)\s+(worthless|trash|garbage|disgusting)/i,
];

export type ModerationResult = {
  isClean: boolean;
  reason?: string;
  category?: 'spam' | 'phishing' | 'violence' | 'illegal' | 'adult' | 'harassment';
};

export function moderateContent(text: string): ModerationResult {
  if (!text || text.trim().length === 0) {
    return { isClean: true };
  }

  const normalizedText = text.toLowerCase().replace(/\s+/g, ' ');

  // Check spam
  for (const pattern of spamPatterns) {
    if (pattern.test(normalizedText)) {
      return { isClean: false, reason: 'Content appears to be spam', category: 'spam' };
    }
  }

  // Check phishing
  for (const pattern of phishingPatterns) {
    if (pattern.test(normalizedText)) {
      return { isClean: false, reason: 'Content appears to be a phishing attempt', category: 'phishing' };
    }
  }

  // Check violence
  for (const pattern of violencePatterns) {
    if (pattern.test(normalizedText)) {
      return { isClean: false, reason: 'Content contains violent or threatening language', category: 'violence' };
    }
  }

  // Check illegal content
  for (const pattern of illegalPatterns) {
    if (pattern.test(normalizedText)) {
      return { isClean: false, reason: 'Content promotes illegal activities', category: 'illegal' };
    }
  }

  // Check adult content
  for (const pattern of adultPatterns) {
    if (pattern.test(normalizedText)) {
      return { isClean: false, reason: 'Content contains adult/explicit material', category: 'adult' };
    }
  }

  // Check harassment
  for (const pattern of harassmentPatterns) {
    if (pattern.test(normalizedText)) {
      return { isClean: false, reason: 'Content contains harassment or hate speech', category: 'harassment' };
    }
  }

  return { isClean: true };
}

// Max character limit for posts
export const MAX_POST_CHARACTERS = 1000000;

export function validatePostLength(text: string): { isValid: boolean; message?: string } {
  if (text.length > MAX_POST_CHARACTERS) {
    return { 
      isValid: false, 
      message: `Max character limit of ${MAX_POST_CHARACTERS.toLocaleString()} exceeded.` 
    };
  }
  return { isValid: true };
}
