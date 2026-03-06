/**
 * Content Moderation Service
 * Pre-publish moderation that runs on all user-generated content
 */

// Prohibited content patterns
const EXPLICIT_PATTERNS = [
  /\bp[o0]rn/gi,
  /\bxxx\b/gi,
  /\bnude[s]?\b/gi,
  /\bnaked\b/gi,
  /\bs[e3]x(y|ual)?\b/gi,
  /\bmilf\b/gi,
  /\bc[u0]m\b/gi,
  /\bf[1!i]ck/gi,
  /\bc[1!i]m\b/gi,
  /\bs[3e]x\b/gi,
  /\bd[1!i]ck\b/gi,
  /\bp[u0]ssy\b/gi,
  /\bass\b/gi,
  /\bb[o0][o0]bs?\b/gi,
  /\btits?\b/gi,
];

const VIOLENCE_PATTERNS = [
  /\bkill\s+(you|him|her|them)\b/gi,
  /\bmurder\b/gi,
  /\bsuicide\b/gi,
  /\bshoot\s+(you|him|her|them)\b/gi,
  /\bstab\b/gi,
  /\bbeat\s+(you|him|her|them)\s+up\b/gi,
  /\bdie\s+(bitch|you)\b/gi,
  /\bi('ll|'m going to)\s+hurt\b/gi,
];

const HARASSMENT_PATTERNS = [
  /\bkys\b/gi,
  /\bkill\s+yourself\b/gi,
  /\bgo\s+die\b/gi,
  /\bretard(ed)?\b/gi,
  /\bfaggot\b/gi,
  /\bn[i!1]gg[ae3]r?\b/gi,
];

const SPAM_PATTERNS = [
  /(.)\1{10,}/gi, // Repeated characters (aaaaaaaaaa)
  /(buy|sale|discount|free|click|win)\s+(now|here|this)/gi,
  /\b(crypto|bitcoin|forex)\s+(invest|trading|profit)/gi,
  /\bwww\.\S+\.(com|net|org)\b/gi, // URLs (but allow some)
  /telegram\.me/gi,
  /wa\.me/gi,
];

const SCAM_PATTERNS = [
  /\bsend\s+(me\s+)?(money|crypto|bitcoin|payment)\b/gi,
  /\b(gift\s+)?card\s+(code|number)\b/gi,
  /\bpaypal\s+me\b/gi,
  /\bvenmo\s+me\b/gi,
  /\b(investment|trading)\s+opportunity\b/gi,
  /\bdouble\s+your\s+(money|crypto|bitcoin)\b/gi,
];

const MINOR_SAFETY_PATTERNS = [
  /\bchild\s+(porn|sex|nude)/gi,
  /\bpedo(phile)?\b/gi,
  /\bunderage\b/gi,
  /\bminor[s]?\s+(sex|nude|naked)/gi,
  /\bcp\b/gi, // Common abbreviation for illegal content
];

export type ModerationCategory = 
  | 'explicit_content'
  | 'violence'
  | 'harassment' 
  | 'spam'
  | 'scam'
  | 'minor_safety'
  | 'profanity';

export type ModerationSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ModerationResult {
  allowed: boolean;
  category?: ModerationCategory;
  severity?: ModerationSeverity;
  reason?: string;
  flaggedTokens?: string[];
}

/**
 * Check content for prohibited material before publishing
 * Returns whether content should be allowed and why if not
 */
export function moderateContent(text: string): ModerationResult {
  if (!text || typeof text !== 'string') {
    return { allowed: true };
  }

  const normalizedText = text.toLowerCase();
  const flaggedTokens: string[] = [];

  // CRITICAL: Check for minor safety violations first (instant block)
  for (const pattern of MINOR_SAFETY_PATTERNS) {
    const matches = normalizedText.match(pattern);
    if (matches) {
      return {
        allowed: false,
        category: 'minor_safety',
        severity: 'critical',
        reason: 'Content violates platform safety policies. This has been logged.',
        flaggedTokens: matches,
      };
    }
  }

  // HIGH: Check for violence/threats
  for (const pattern of VIOLENCE_PATTERNS) {
    const matches = normalizedText.match(pattern);
    if (matches) {
      return {
        allowed: false,
        category: 'violence',
        severity: 'high',
        reason: 'Content contains threatening or violent language.',
        flaggedTokens: matches,
      };
    }
  }

  // HIGH: Check for harassment
  for (const pattern of HARASSMENT_PATTERNS) {
    const matches = normalizedText.match(pattern);
    if (matches) {
      return {
        allowed: false,
        category: 'harassment',
        severity: 'high',
        reason: 'Content contains harassing or hateful language.',
        flaggedTokens: matches,
      };
    }
  }

  // MEDIUM: Check for explicit content
  for (const pattern of EXPLICIT_PATTERNS) {
    const matches = normalizedText.match(pattern);
    if (matches) {
      flaggedTokens.push(...matches);
    }
  }

  if (flaggedTokens.length > 0) {
    return {
      allowed: false,
      category: 'explicit_content',
      severity: 'medium',
      reason: 'Content contains explicit or adult material.',
      flaggedTokens,
    };
  }

  // MEDIUM: Check for scam patterns
  for (const pattern of SCAM_PATTERNS) {
    const matches = normalizedText.match(pattern);
    if (matches) {
      return {
        allowed: false,
        category: 'scam',
        severity: 'medium',
        reason: 'Content appears to contain scam or fraud attempts.',
        flaggedTokens: matches,
      };
    }
  }

  // LOW: Check for spam patterns
  let spamScore = 0;
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(normalizedText)) {
      spamScore++;
    }
  }

  if (spamScore >= 2) {
    return {
      allowed: false,
      category: 'spam',
      severity: 'low',
      reason: 'Content appears to be spam.',
    };
  }

  // Content passed all checks
  return { allowed: true };
}

/**
 * Validate content length limits
 */
export function validateContentLength(
  text: string, 
  maxLength: number = 5000,
  minLength: number = 1
): { valid: boolean; reason?: string } {
  if (!text || text.trim().length < minLength) {
    return { valid: false, reason: 'Content is too short.' };
  }
  if (text.length > maxLength) {
    return { valid: false, reason: `Content exceeds maximum length of ${maxLength} characters.` };
  }
  return { valid: true };
}

/**
 * Full pre-publish validation combining moderation and length checks
 */
export function validateForPublish(
  text: string,
  options: { maxLength?: number; minLength?: number } = {}
): ModerationResult & { valid: boolean } {
  const { maxLength = 5000, minLength = 1 } = options;

  // Length check
  const lengthResult = validateContentLength(text, maxLength, minLength);
  if (!lengthResult.valid) {
    return {
      allowed: false,
      valid: false,
      reason: lengthResult.reason,
    };
  }

  // Content moderation
  const moderationResult = moderateContent(text);
  
  return {
    ...moderationResult,
    valid: moderationResult.allowed,
  };
}
