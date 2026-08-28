import { useTranslation } from 'react-i18next';

/**
 * Binding-language notice + "subject to lawyer review" marker, shown at the end
 * of every legal page in the active language. The German version is the legally
 * binding one; other languages are convenience translations.
 */
export function LegalBindingNotice({ className = '' }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <div className={`mt-12 pt-6 border-t border-border space-y-2 ${className}`}>
      <p className="text-sm font-semibold text-foreground">{t('legalPage.bindingLanguageTitle')}</p>
      <p className="text-sm text-muted-foreground">{t('legalPage.bindingLanguage')}</p>
      <p className="text-xs text-muted-foreground">{t('legalPage.lawyerReview')}</p>
    </div>
  );
}
