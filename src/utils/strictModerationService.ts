/**
 * Strict Privacy-First AI Moderation Service
 * Runs entirely locally - no external API calls by default
 * Handles obfuscation, leetspeak, multilingual content
 */

import { normalizeText, generateContentHash } from './moderationNormalizer';

// Severity levels
export type ModerationSeverity = 'low' | 'medium' | 'high' | 'critical';

// Categories
export type ModerationCategory = 
  | 'threat'
  | 'violence' 
  | 'sexual'
  | 'sexual_minor'
  | 'harassment'
  | 'hate_speech'
  | 'spam'
  | 'scam'
  | 'profanity'
  | 'illegal';

export interface ModerationResult {
  blocked: boolean;
  categories: ModerationCategory[];
  severity: ModerationSeverity;
  matched_phrases: string[];
  confidence: number;
  reason?: string;
  content_hash?: string;
}



// CRITICAL: Sexual content involving minors - instant ban
const MINOR_SAFETY_PATTERNS = [
  /child\s*(porn|sex|nude|naked)/gi,
  /pedo(phile)?/gi,
  /underage\s*(sex|nude|porn)/gi,
  /minor[s]?\s*(sex|nude|naked|porn)/gi,
  /\bcp\b/gi,
  /young\s*(boy|girl)\s*(sex|nude)/gi,
  /kid[s]?\s*(nude|naked|sex)/gi,
  /loli/gi,
  /shota/gi,
];

// CRITICAL: Block "kill" and variants completely - 100% blocked
const KILL_PATTERNS = [
  /\bkill\b/gi,
  /\bkills\b/gi,
  /\bkilled\b/gi,
  /\bkilling\b/gi,
  /\bkiller\b/gi,
  /\bk\s*i\s*l\s*l/gi,
  /\bk1ll/gi,
  /\bk!ll/gi,
  /\bkil+/gi,
];

// CRITICAL: Death threats and violence
const THREAT_PATTERNS = [
  /i('ll|l|'m\s*going\s*to|will)\s*(fucking\s*)?(kill|murder|shoot|stab|hurt|harm|end)\s*(you|u|him|her|them)/gi,
  /kill\s*(you|u|yourself|urself|him|her|them)/gi,
  /i\s*k\s*i\s*l\s*l\s*(you|u)/gi,
  /you('re|r)?\s*(going\s*to\s*)?(die|dead)/gi,
  /death\s*threat/gi,
  /i\s*will\s*find\s*(you|u)/gi,
  /watch\s*(your|ur)\s*back/gi,
  /murder\s*(you|him|her|them)/gi,
  /shoot\s*(you|u|him|her|them)/gi,
  /stab\s*(you|u|him|her|them)/gi,
  /beat\s*(you|u)\s*up/gi,
  /gonna\s*(kill|murder|hurt)/gi,
  /put\s*a\s*bullet/gi,
  /i('ll)?\s*beat\s*(you|u)/gi,
  /i('ll)?\s*hurt\s*(you|u)/gi,
  /\bmurder\b/gi,
  /\brape\b/gi,
  /\braped\b/gi,
  /\braping\b/gi,
  /\brapist\b/gi,
  /\bslaughter\b/gi,
  /\bexecute\b/gi,
  /\bassassinate\b/gi,
  /\bmassacre\b/gi,
  /\bexterminate\b/gi,
  /\bslit\s*(your|ur|his|her|their)\s*throat/gi,
  /\bstrangle\b/gi,
  /\bchoke\s*(you|u|him|her|them)/gi,
  /\bdrown\s*(you|u|him|her|them)/gi,
  /\bburn\s*(you|u|him|her|them)\s*alive/gi,
  /\bbury\s*(you|u|him|her|them)\s*alive/gi,
  /\bi\s*hope\s*(you|u)\s*die\b/gi,
  /\bwish\s*(you|u)\s*(were\s*)?dead\b/gi,
  /\byou\s*(will|gonna|should)\s*die\b/gi,
  /\bdeath\s*wish\b/gi,
  /\bbleed\s*(out|to\s*death)\b/gi,
];

// CRITICAL: Block "fuck" and variants completely - 100% blocked  
const FUCK_PATTERNS = [
  /\bfuck\b/gi,
  /\bfucks\b/gi,
  /\bfucked\b/gi,
  /\bfucking\b/gi,
  /\bfucker\b/gi,
  /\bfuckers\b/gi,
  /\bf\s*u\s*c\s*k/gi,
  /\bf+u+c+k+/gi,
  /\bf\*ck/gi,
  /\bf\*\*k/gi,
  /\bfuk\b/gi,
  /\bfuq\b/gi,
  /\bfck\b/gi,
  /\bf.ck\b/gi,
  /\bf\.u\.c\.k/gi,
  /\bf_ck/gi,
  /\bphuck/gi,
  /\bfvck/gi,
  /\bf1ck/gi,
  /\bfu\*k/gi,
];

// HIGH: English profanity with obfuscation variations
const PROFANITY_PATTERNS = [
  // F-word variations (additional)
  /\bf+[u\*@0]+c*k+/gi,
  /\bf\*+c*k/gi,
  /\bf[!1i]ck/gi,
  /\bf\s+u\b/gi,
  /\bwtf\b/gi,
  /\bmf\b/gi,
  /\bmotherfuck/gi,
  
  // S-word variations
  /\bs+h+[i1!]+t+/gi,
  /\bs\s*h\s*i\s*t/gi,
  /\bsh\*t/gi,
  /\bsh!t/gi,
  /\bsht/gi,
  /\bshyt/gi,
  
  // A-word variations
  /\bass+h+[o0]+l+e/gi,
  /\ba\s*s\s*s\s*h\s*o\s*l\s*e/gi,
  /\bass\b/gi,
  /\ba\$\$/gi,
  /\b@ss/gi,
  
  // B-word variations
  /\bb+[i1!]+t+c+h+/gi,
  /\bb\s*i\s*t\s*c\s*h/gi,
  /\bb\*tch/gi,
  /\bbish\b/gi,
  /\bbiatch/gi,
  
  // C-word variations
  /\bc+u+n+t+/gi,
  /\bc\s*u\s*n\s*t/gi,
  
  // D-word variations
  /\bd+[i1!]+c+k+/gi,
  /\bd\s*i\s*c\s*k/gi,
  /\bd\*ck/gi,
  /\bdik\b/gi,
  
  // P-word variations (vulgar)
  /\bp+u+s+s+y+/gi,
  /\bp\s*u\s*s\s*s\s*y/gi,
  /\bp\*ssy/gi,
  /\bpvssy/gi,
  
  // W-word variations
  /\bwh+[o0]+r+e+/gi,
  /\bw\s*h\s*o\s*r\s*e/gi,
  /\bh0e\b/gi,
  /\bho\b/gi,
  
  // Slut variations
  /\bs+l+u+t+/gi,
  /\bs\s*l\s*u\s*t/gi,
  
  // Bastard
  /\bb+a+s+t+a+r+d+/gi,
  /\bb\s*a\s*s\s*t\s*a\s*r\s*d/gi,
  
  // Damn/Hell (milder but still filtered)
  /\bdamn/gi,
  /\bdamm/gi,
  /\bdmn\b/gi,
];

// HIGH: Explicit sexual content
const SEXUAL_PATTERNS = [
  /\bp[o0]+r+n+/gi,
  /\bp\s*o\s*r\s*n/gi,
  /\bp0rn/gi,
  /\bxxx\b/gi,
  /\bnude[s]?\b/gi,
  /\bnaked\b/gi,
  /\bmilf\b/gi,
  /\bc[o0]ck\b/gi,
  /\bb[o0]{2}b[s]?\b/gi,
  /\btit[s]?\b/gi,
  /\banus\b/gi,
  /\bvagina/gi,
  /\bpenis/gi,
  /\borgasm/gi,
  /\bmasturbat/gi,
  /\bblowjob/gi,
  /\bhandjob/gi,
  /\bcum\b/gi,
  /\bcumm/gi,
  /\bsex\b/gi,
  /\bsexy\b/gi,
  /\berotic/gi,
  /\bnsfw\b/gi,
  /\bexplicit/gi,
  /\bboner\b/gi,
  /\bjizz/gi,
  /\bfap/gi,
  /\bhentai/gi,
  /\bporn(o|ography)?/gi,
];

// HIGH: Harassment and hate speech
const HARASSMENT_PATTERNS = [
  /\bkys\b/gi,
  /\bk\s*y\s*s\b/gi,
  /kill\s*yourself/gi,
  /go\s*die/gi,
  /\bretard(ed)?\b/gi,
  /\bfagg?ot/gi,
  /\bf\s*a\s*g/gi,
  /\bn[i1!]+gg+[ae3]r?\b/gi,
  /\bn\s*i\s*g\s*g/gi,
  /\bkike\b/gi,
  /\bspic\b/gi,
  /\bchink\b/gi,
  /\bwetback\b/gi,
  /\btranny\b/gi,
  /you('re|r)?\s*(worthless|trash|garbage|disgusting|pathetic|ugly|fat|stupid|dumb|idiot)/gi,
  /nobody\s*(loves|cares\s*about)\s*(you|u)/gi,
  /\bloser\b/gi,
  /\bidiot\b/gi,
  /\bstupid\b/gi,
  /\bmoron\b/gi,
  /\bimbecile/gi,
  /\bdumbass/gi,
  /\bjackass/gi,
];

// MEDIUM: Spam patterns
const SPAM_PATTERNS = [
  /(.)\1{5,}/gi,
  /(buy|sale|discount|free|click|win)\s+(now|here|this)/gi,
  /\b(crypto|bitcoin|forex)\s+(invest|trading|profit)/gi,
  /telegram\.me/gi,
  /wa\.me/gi,
  /double\s*your\s*(money|crypto|bitcoin)/gi,
  /free\s*money/gi,
  /claim\s*your\s*prize/gi,
  /limited\s*time\s*offer/gi,
  /act\s*now/gi,
  /congratulations\s*you\s*won/gi,
  /dm\s*me\s*for\s*(free|deals|offers)/gi,
];

// MEDIUM: Scam patterns
const SCAM_PATTERNS = [
  /send\s*(me\s*)?(money|crypto|bitcoin|payment)/gi,
  /\b(gift\s*)?card\s*(code|number)\b/gi,
  /\bpaypal\s*me\b/gi,
  /\bvenmo\s*me\b/gi,
  /\b(investment|trading)\s*opportunity\b/gi,
  /verify\s*your\s*(account|password|identity)/gi,
  /your\s*account\s*(has\s*been|will\s*be)\s*(suspended|closed)/gi,
  /unusual\s*activity\s*detected/gi,
];

// MEDIUM: Illegal content
const ILLEGAL_PATTERNS = [
  /\b(buy|sell)\s*(drugs|cocaine|heroin|meth|weed|marijuana)/gi,
  /\b(stolen|counterfeit)\s*(cards?|accounts?|items?)/gi,
  /\bhacked?\s*accounts?\b/gi,
  /\bcredit\s*card\s*dumps?\b/gi,
  /\bfake\s*(id|passport|license)/gi,
  /\bweapons?\s*for\s*sale/gi,
  /\bbuy\s*guns?\b/gi,
  /\bhack\s*accounts?\b/gi,
  /\bsteal\s*something/gi,
  /\bfraud/gi,
  /\bblackmail/gi,
];



// German/Swiss-German profanity and threats
const GERMAN_PATTERNS = [
  /\bfick(en|er)?\b/gi,
  /\bf\s*i\s*c\s*k/gi,
  /\bhurensohn\b/gi,
  /\bh\s*u\s*r\s*e\s*n\s*s\s*o\s*h\s*n/gi,
  /\bhure\b/gi,
  /\bschlampe\b/gi,
  /\bich\s*bring\s*dich\s*um\b/gi,
  /\bich\s*töte\s*dich\b/gi,
  /\bich\s*toete\s*dich\b/gi,
  /\bverpiss\s*dich\b/gi,
  /\barschloch\b/gi,
  /\ba\s*r\s*s\s*c\s*h\s*l\s*o\s*c\s*h/gi,
  /\bwichser\b/gi,
  /\bw\s*i\s*c\s*h\s*s\s*e\s*r/gi,
  /\bfotze\b/gi,
  /\bscheisse\b/gi,
  /\bscheiße\b/gi,
  /\bsche1sse\b/gi,
  /\bdreck(s)?sau\b/gi,
  /\bmissgeburt\b/gi,
  /\bspast(i)?\b/gi,
  /\bschwuchtel\b/gi,
  /\bficker\b/gi,
  /\bopfer\b/gi,
  /\bbehindert\b/gi,
  /\bvollpfosten\b/gi,
  /\bsaukerl\b/gi,
  /\bdepp\b/gi,
  /\bblödmann\b/gi,
  /\bidiot\b/gi,
  /\btrottel\b/gi,
  /\bpenner\b/gi,
  /\bwixer\b/gi,
  /\bharamsohn\b/gi,
];

// Spanish profanity and threats
const SPANISH_PATTERNS = [
  /\bputa\b/gi,
  /\bp\s*u\s*t\s*a/gi,
  /\bmierda\b/gi,
  /\bcoño\b/gi,
  /\bte\s*voy\s*a\s*matar\b/gi,
  /\bmuérete\b/gi,
  /\bmuere(te)?\b/gi,
  /\bhijo\s*de\s*puta\b/gi,
  /\bcabr[oó]n\b/gi,
  /\bpendejo\b/gi,
  /\bverga\b/gi,
  /\bchingar/gi,
  /\bculero\b/gi,
  /\bpinche\b/gi,
  /\bmam[oó]n\b/gi,
  /\bjoder\b/gi,
  /\bfollar\b/gi,
  /\bgilipollas\b/gi,
  /\bcojones\b/gi,
  /\bimbécil\b/gi,
  /\bidiota\b/gi,
];

// French profanity and threats
const FRENCH_PATTERNS = [
  /\bmerde\b/gi,
  /\bm\s*e\s*r\s*d\s*e/gi,
  /\bputain\b/gi,
  /\bp\s*u\s*t\s*a\s*i\s*n/gi,
  /\bsalope\b/gi,
  /\bs\s*a\s*l\s*o\s*p\s*e/gi,
  /\bje\s*vais\s*te\s*tuer\b/gi,
  /\bencul[eé]\b/gi,
  /\bconnard\b/gi,
  /\bnique\s*ta\s*m[eè]re\b/gi,
  /\bfils\s*de\s*pute\b/gi,
  /\bfdp\b/gi,
  /\bnique\b/gi,
  /\bbordel\b/gi,
  /\bcon(ne)?\b/gi,
  /\bta\s*gueule\b/gi,
  /\bpd\b/gi,
  /\bntm\b/gi,
  /\bbatard\b/gi,
];

// Italian profanity
const ITALIAN_PATTERNS = [
  /\bcazzo\b/gi,
  /\bmerda\b/gi,
  /\bstronzo\b/gi,
  /\bfanculo\b/gi,
  /\bputtana\b/gi,
  /\bvaffanculo\b/gi,
  /\bminchia\b/gi,
  /\bfottiti\b/gi,
  /\bcoglione\b/gi,
];



interface ModerationContext {
  type: 'message' | 'post' | 'comment' | 'review' | 'listing';
  senderId?: string;
  recipientId?: string;
}

export function moderateContent(
  text: string, 
  context?: ModerationContext
): ModerationResult {
  if (!text || typeof text !== 'string') {
    return {
      blocked: false,
      categories: [],
      severity: 'low',
      matched_phrases: [],
      confidence: 1.0,
    };
  }

  // Normalize text to detect obfuscation
  const originalText = text;
  const normalizedText = normalizeText(text);
  const contentHash = generateContentHash(originalText);
  
  const matchedCategories: ModerationCategory[] = [];
  const matchedPhrases: string[] = [];
  let highestSeverity: ModerationSeverity = 'low';
  let confidence = 0;

  // Helper to check patterns and collect matches
  const checkPatterns = (
    patterns: RegExp[], 
    category: ModerationCategory, 
    severity: ModerationSeverity
  ) => {
    for (const pattern of patterns) {
      // Check both original and normalized text
      const originalMatches = originalText.match(pattern);
      const normalizedMatches = normalizedText.match(pattern);
      
      const matches = [...(originalMatches || []), ...(normalizedMatches || [])];
      
      if (matches.length > 0) {
        if (!matchedCategories.includes(category)) {
          matchedCategories.push(category);
        }
        
        // Add unique matches (don't expose exact content in logs)
        const uniqueMatches = [...new Set(matches)].slice(0, 3);
        matchedPhrases.push(...uniqueMatches.map(m => m.substring(0, 10) + '...'));
        
        // Update severity
        const severityOrder: ModerationSeverity[] = ['low', 'medium', 'high', 'critical'];
        if (severityOrder.indexOf(severity) > severityOrder.indexOf(highestSeverity)) {
          highestSeverity = severity;
        }
        
        confidence = Math.min(confidence + 0.3, 1.0);
      }
    }
  };

  // CRITICAL checks first - Kill and Fuck (100% blocked)
  checkPatterns(KILL_PATTERNS, 'threat', 'critical');
  checkPatterns(FUCK_PATTERNS, 'profanity', 'critical');
  checkPatterns(MINOR_SAFETY_PATTERNS, 'sexual_minor', 'critical');
  
  // If critical violation found, return immediately
  if (matchedCategories.includes('sexual_minor')) {
    return {
      blocked: true,
      categories: matchedCategories,
      severity: 'critical',
      matched_phrases: ['[redacted]'],
      confidence: 1.0,
      reason: 'Content violates critical safety policies.',
      content_hash: contentHash,
    };
  }

  // HIGH severity checks
  checkPatterns(THREAT_PATTERNS, 'threat', 'critical');
  checkPatterns(SEXUAL_PATTERNS, 'sexual', 'high');
  checkPatterns(PROFANITY_PATTERNS, 'profanity', 'high');
  checkPatterns(HARASSMENT_PATTERNS, 'harassment', 'high');
  checkPatterns(HARASSMENT_PATTERNS, 'hate_speech', 'high');

  // MEDIUM severity checks
  checkPatterns(SPAM_PATTERNS, 'spam', 'medium');
  checkPatterns(SCAM_PATTERNS, 'scam', 'medium');
  checkPatterns(ILLEGAL_PATTERNS, 'illegal', 'high');

  // Multilingual checks - all set to HIGH to block immediately
  checkPatterns(GERMAN_PATTERNS, 'profanity', 'high');
  checkPatterns(SPANISH_PATTERNS, 'profanity', 'high');
  checkPatterns(FRENCH_PATTERNS, 'profanity', 'high');
  checkPatterns(ITALIAN_PATTERNS, 'profanity', 'high');

  // Determine if content should be blocked
  const criticalCategories: ModerationCategory[] = ['sexual_minor', 'threat'];
  const highCategories: ModerationCategory[] = ['violence', 'sexual', 'harassment', 'hate_speech', 'illegal', 'profanity'];
  
  const hasCritical = matchedCategories.some(c => criticalCategories.includes(c));
  const hasHigh = matchedCategories.some(c => highCategories.includes(c));
  
  const severityBlocked = highestSeverity === 'critical' as ModerationSeverity || highestSeverity === 'high' as ModerationSeverity;
  const blocked = hasCritical || hasHigh || severityBlocked;

  // Generate human-readable reason
  let reason: string | undefined;
  if (blocked) {
    if (matchedCategories.includes('threat')) {
      reason = 'Your message contains words or content that are not allowed on this platform. Please remove any profanity, threats, sexual or illegal content.';
    } else if (matchedCategories.includes('sexual')) {
      reason = 'Your message contains words or content that are not allowed on this platform. Please remove any profanity, threats, sexual or illegal content.';
    } else if (matchedCategories.includes('profanity')) {
      reason = 'Your message contains words or content that are not allowed on this platform. Please remove any profanity, threats, sexual or illegal content.';
    } else if (matchedCategories.includes('harassment') || matchedCategories.includes('hate_speech')) {
      reason = 'Your message contains words or content that are not allowed on this platform. Please remove any profanity, threats, sexual or illegal content.';
    } else if (matchedCategories.includes('spam')) {
      reason = 'Your message contains words or content that are not allowed on this platform. Please remove any profanity, threats, sexual or illegal content.';
    } else if (matchedCategories.includes('scam')) {
      reason = 'Your message contains words or content that are not allowed on this platform. Please remove any profanity, threats, sexual or illegal content.';
    } else if (matchedCategories.includes('illegal')) {
      reason = 'Your message contains words or content that are not allowed on this platform. Please remove any profanity, threats, sexual or illegal content.';
    } else {
      reason = 'Your message contains words or content that are not allowed on this platform. Please remove any profanity, threats, sexual or illegal content.';
    }
  }

  return {
    blocked,
    categories: matchedCategories,
    severity: highestSeverity,
    matched_phrases: matchedPhrases.slice(0, 5), // Limit for privacy
    confidence: confidence || (blocked ? 0.9 : 0.1),
    reason,
    content_hash: contentHash,
  };
}

/**
 * Quick validation for pre-publish check
 * Returns true if content is safe, false if blocked
 */
export function isContentSafe(text: string): boolean {
  const result = moderateContent(text);
  return !result.blocked;
}

/**
 * Simple checkProfanity function - returns true if profanity detected
 */
export function checkProfanity(text: string): boolean {
  const result = moderateContent(text);
  return result.blocked;
}

/**
 * Get user-friendly block message
 */
export function getBlockMessage(result: ModerationResult): string {
  return result.reason || 'Your content was blocked by moderation.';
}
