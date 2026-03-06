import { useCallback } from 'react';
import { moderateContent, ModerationResult, getBlockMessage, checkProfanity } from '@/utils/strictModerationService';
import { toast } from 'sonner';

// Localized error messages for profanity detection
const LOCALIZED_MESSAGES: Record<string, string> = {
  'en': 'Profanity is not allowed. Please rewrite your comment.',
  'de': 'Beleidigungen sind nicht erlaubt. Bitte schreibe deinen Kommentar um.',
  'ar': 'الألفاظ النابية غير مسموح بها. يرجى إعادة كتابة تعليقك.',
  'tr': 'Küfür yasaktır. Lütfen yorumunuzu yeniden yazın.',
  'fr': 'Les propos vulgaires ne sont pas autorisés. Veuillez réécrire votre commentaire.',
  'es': 'No se permiten groserías. Por favor, reescribe tu comentario.',
  'it': 'Le volgarità non sono ammesse. Per favore riscrivi il tuo commento.',
  'pt': 'Linguagem imprópria não é permitida. Por favor, reescreva seu comentário.',
  'ru': 'Ненормативная лексика запрещена. Пожалуйста, перепишите ваш комментарий.',
  'nl': 'Schuttingtaal is niet toegestaan. Herschrijf alstublieft uw reactie.',
};

/**
 * Get localized profanity error message
 */
export function getLocalizedProfanityMessage(language?: string): string {
  return LOCALIZED_MESSAGES[language || 'en'] || LOCALIZED_MESSAGES['en'];
}

/**
 * Handle API error response for profanity detection
 */
export function handleProfanityError(error: { code?: string; error?: string; detected_language?: string }): string {
  if (error.code === 'PROFANITY_DETECTED') {
    return error.error || getLocalizedProfanityMessage(error.detected_language);
  }
  return error.error || 'An error occurred. Please try again.';
}

/**
 * Hook for strict pre-publish content moderation
 * All user-generated content must pass through this before submission
 */
export function useStrictModeration() {
  /**
   * Check content and return moderation result
   */
  const checkContent = useCallback((text: string): ModerationResult => {
    return moderateContent(text);
  }, []);

  /**
   * Validate content and show toast if blocked
   * Returns true if content is safe, false if blocked
   */
  const validateAndBlock = useCallback((text: string): boolean => {
    const result = moderateContent(text);
    
    if (result.blocked) {
      // Show user-friendly error (without revealing matched patterns)
      toast.error(getBlockMessage(result), {
        duration: 5000,
        description: 'Please modify your content and try again.',
      });
      
      // Log for debugging (category only, no content)
      console.warn(`[Moderation] Blocked: ${result.categories.join(', ')} (${result.severity})`);
      
      return false;
    }
    
    return true;
  }, []);

  /**
   * Validate with custom error handling
   */
  const validateWithCallback = useCallback((
    text: string,
    onBlocked?: (result: ModerationResult) => void,
    onAllowed?: () => void
  ): boolean => {
    const result = moderateContent(text);
    
    if (result.blocked) {
      onBlocked?.(result);
      return false;
    }
    
    onAllowed?.();
    return true;
  }, []);

  /**
   * Show profanity error toast from API response
   */
  const showProfanityError = useCallback((error: { code?: string; error?: string; detected_language?: string }) => {
    const message = handleProfanityError(error);
    toast.error(message, {
      duration: 5000,
      description: 'Please modify your content and try again.',
    });
  }, []);

  return {
    checkContent,
    validateAndBlock,
    validateWithCallback,
    moderateContent,
    checkProfanity,
    showProfanityError,
    getLocalizedProfanityMessage,
    handleProfanityError,
  };
}
