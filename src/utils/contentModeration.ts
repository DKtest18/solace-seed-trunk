// Content moderation utilities
const prohibitedWords = [
  'nsfw',
  'porn',
  'xxx',
  'sex',
  'nude',
  'naked',
  'explicit',
  // Add more inappropriate words as needed
];

const profanityWords = [
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'damn',
  // Add more profanity as needed
];

export function containsProhibitedContent(text: string): boolean {
  const lowerText = text.toLowerCase();
  return prohibitedWords.some(word => lowerText.includes(word));
}

export function containsProfanity(text: string): boolean {
  const lowerText = text.toLowerCase();
  return profanityWords.some(word => lowerText.includes(word));
}

export function moderateContent(text: string): {
  isValid: boolean;
  reason?: string;
} {
  if (!text || text.trim().length === 0) {
    return { isValid: false, reason: 'Content cannot be empty' };
  }

  if (text.length > 5000) {
    return { isValid: false, reason: 'Content is too long (max 5000 characters)' };
  }

  if (containsProhibitedContent(text)) {
    return { isValid: false, reason: 'Content contains prohibited material (NSFW/adult content)' };
  }

  if (containsProfanity(text)) {
    return { isValid: false, reason: 'Content contains inappropriate language' };
  }

  return { isValid: true };
}

export function validateImageFile(file: File): {
  isValid: boolean;
  reason?: string;
} {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, reason: 'Invalid file type. Only JPEG, PNG, WEBP, and GIF images are allowed' };
  }

  if (file.size > maxSize) {
    return { isValid: false, reason: 'File is too large. Maximum size is 5MB' };
  }

  return { isValid: true };
}
