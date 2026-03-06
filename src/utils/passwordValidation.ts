export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  // Minimum length
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }

  // Maximum length
  if (password.length > 128) {
    errors.push("Password must not exceed 128 characters");
  }

  // Must contain uppercase
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  // Must contain lowercase
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  // Must contain number
  if (!/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  // Must contain special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  // Check for common weak passwords
  const commonPasswords = [
    "password", "password123", "12345678", "qwerty", "abc123",
    "letmein", "welcome", "monkey", "dragon", "master"
  ];
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push("Password is too common. Please choose a stronger password");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function getPasswordStrength(password: string): {
  strength: "weak" | "medium" | "strong" | "very-strong";
  score: number;
} {
  let score = 0;

  // Length scoring
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // Character variety
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1;

  // Patterns (reduce score for common patterns)
  if (/(.)\1{2,}/.test(password)) score -= 1; // Repeated characters
  if (/^(123|abc|qwe)/i.test(password)) score -= 1; // Sequential patterns

  score = Math.max(0, Math.min(7, score));

  if (score <= 2) return { strength: "weak", score };
  if (score <= 4) return { strength: "medium", score };
  if (score <= 6) return { strength: "strong", score };
  return { strength: "very-strong", score };
}