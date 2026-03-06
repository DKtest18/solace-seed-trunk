import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br"],
    ALLOWED_ATTR: ["href"],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Sanitize plain text - strips all HTML
 */
export function sanitizeText(text: string): string {
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}

/**
 * Validate and sanitize email
 */
export function sanitizeEmail(email: string): string {
  const sanitized = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(sanitized)) {
    throw new Error("Invalid email format");
  }
  
  return sanitized;
}

/**
 * Validate and sanitize URL
 */
export function sanitizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Only allow http and https protocols
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      throw new Error("Invalid URL protocol");
    }
    return urlObj.toString();
  } catch {
    throw new Error("Invalid URL format");
  }
}

/**
 * Sanitize username - alphanumeric, underscore, hyphen only
 */
export function sanitizeUsername(username: string): string {
  const sanitized = username.trim().toLowerCase();
  
  if (!/^[a-z0-9_-]{3,30}$/.test(sanitized)) {
    throw new Error("Username must be 3-30 characters and contain only letters, numbers, underscores, and hyphens");
  }
  
  return sanitized;
}

/**
 * Sanitize product title
 */
export function sanitizeProductTitle(title: string): string {
  const sanitized = sanitizeText(title).trim();
  
  if (sanitized.length < 3) {
    throw new Error("Title must be at least 3 characters");
  }
  
  if (sanitized.length > 200) {
    throw new Error("Title must not exceed 200 characters");
  }
  
  return sanitized;
}

/**
 * Sanitize and validate price
 */
export function sanitizePrice(price: string | number): number {
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  
  if (isNaN(numPrice) || numPrice < 0) {
    throw new Error("Price must be a positive number");
  }
  
  if (numPrice > 1000000) {
    throw new Error("Price exceeds maximum allowed value");
  }
  
  return Math.round(numPrice * 100) / 100; // Round to 2 decimals
}

/**
 * Sanitize review/comment content
 */
export function sanitizeUserContent(content: string, maxLength: number = 5000): string {
  const sanitized = sanitizeText(content).trim();
  
  if (sanitized.length === 0) {
    throw new Error("Content cannot be empty");
  }
  
  if (sanitized.length > maxLength) {
    throw new Error(`Content must not exceed ${maxLength} characters`);
  }
  
  return sanitized;
}