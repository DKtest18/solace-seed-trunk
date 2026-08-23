export function validateProductTitle(title: string): { isValid: boolean; error?: string } {
  if (!title || title.trim().length === 0) {
    return { isValid: false, error: 'Title is required' };
  }
  if (title.length < 5) {
    return { isValid: false, error: 'Title must be at least 5 characters' };
  }
  if (title.length > 100) {
    return { isValid: false, error: 'Title must be less than 100 characters' };
  }
  return { isValid: true };
}

export function validateProductDescription(description: string): { isValid: boolean; error?: string } {
  if (!description || description.trim().length === 0) {
    return { isValid: false, error: 'Description is required' };
  }
  if (description.length < 20) {
    return { isValid: false, error: 'Description must be at least 20 characters' };
  }
  if (description.length > 2000) {
    return { isValid: false, error: 'Description must be less than 2000 characters' };
  }
  return { isValid: true };
}

export function validatePrice(price: number): { isValid: boolean; error?: string } {
  if (price < 0) {
    return { isValid: false, error: 'Price cannot be negative' };
  }
  if (price === 0) {
    return { isValid: false, error: 'Price must be greater than 0' };
  }
  if (price > 1000000) {
    return { isValid: false, error: 'Price is too high' };
  }
  return { isValid: true };
}

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/bmp',
  'image/tiff',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
  'image/svg+xml',
];

const IMAGE_EXTENSION_FALLBACK =
  /\.(jpe?g|png|webp|gif|avif|bmp|tiff?|heic|heif|svg)$/i;

export function validateImageFile(file: File): { isValid: boolean; error?: string } {
  const maxSize = 25 * 1024 * 1024; // 25MB

  const type = (file.type || '').toLowerCase();
  const typeOk =
    ALLOWED_IMAGE_MIME_TYPES.includes(type) ||
    (type === '' && IMAGE_EXTENSION_FALLBACK.test(file.name)) ||
    (type.startsWith('image/') && IMAGE_EXTENSION_FALLBACK.test(file.name));

  if (!typeOk) {
    return {
      isValid: false,
      error: `Unsupported image format (${file.type || 'unknown'}). Allowed: JPG, PNG, WEBP, GIF, AVIF, BMP, TIFF, HEIC/HEIF, SVG`,
    };
  }

  if (file.size > maxSize) {
    return { isValid: false, error: 'File is too large. Maximum size is 25MB' };
  }


  return { isValid: true };
}

export function validateFeatures(features: string[]): { isValid: boolean; error?: string } {
  if (features.length === 0) {
    return { isValid: false, error: 'At least one feature is required' };
  }
  if (features.some(f => f.trim().length === 0)) {
    return { isValid: false, error: 'Features cannot be empty' };
  }
  if (features.length > 10) {
    return { isValid: false, error: 'Maximum 10 features allowed' };
  }
  return { isValid: true };
}

export function validateTags(tags: string[]): { isValid: boolean; error?: string } {
  if (tags.length === 0) {
    return { isValid: false, error: 'At least one tag is required' };
  }
  if (tags.length > 10) {
    return { isValid: false, error: 'Maximum 10 tags allowed' };
  }
  return { isValid: true };
}
