import { useCallback } from 'react';
import { moderateContent, validateForPublish, ModerationResult } from '@/utils/contentModerationService';
import { toast } from 'sonner';

/**
 * Hook for pre-publish content moderation
 * Use this before submitting any user-generated content
 */
export function useContentModeration() {
  const checkContent = useCallback((text: string): ModerationResult => {
    return moderateContent(text);
  }, []);

  const validateAndWarn = useCallback((
    text: string, 
    options?: { maxLength?: number; minLength?: number }
  ): boolean => {
    const result = validateForPublish(text, options);
    
    if (!result.valid || !result.allowed) {
      // Show user-friendly error
      const message = result.reason || 'Content violates community guidelines.';
      toast.error(message);
      
      // Log for debugging (category only, not the content itself)
      if (result.category) {
        console.warn(`Content moderation blocked: ${result.category} (${result.severity})`);
      }
      
      return false;
    }
    
    return true;
  }, []);

  const getSeverityColor = useCallback((severity?: string): string => {
    switch (severity) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-blue-600';
      default: return 'text-muted-foreground';
    }
  }, []);

  return {
    checkContent,
    validateAndWarn,
    getSeverityColor,
  };
}
