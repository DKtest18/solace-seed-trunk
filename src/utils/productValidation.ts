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

export function validateImageFile(file: File): { isValid: boolean; error?: string } {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, error: 'Invalid file type. Only JPEG, PNG, and WEBP images are allowed' };
  }

  if (file.size > maxSize) {
    return { isValid: false, error: 'File is too large. Maximum size is 10MB' };
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
