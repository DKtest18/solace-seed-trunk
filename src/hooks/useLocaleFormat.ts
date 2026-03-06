import { useTranslation } from 'react-i18next';
import { useCallback, useMemo } from 'react';

export function useLocaleFormat() {
  const { i18n } = useTranslation();

  const locale = useMemo(() => {
    return i18n.language === 'de' ? 'de-DE' : 'en-US';
  }, [i18n.language]);

  const formatCurrency = useCallback((amount: number, currency?: string) => {
    const curr = currency || (i18n.language === 'de' ? 'EUR' : 'USD');
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: curr,
    }).format(amount);
  }, [locale, i18n.language]);

  const formatNumber = useCallback((num: number, options?: Intl.NumberFormatOptions) => {
    return new Intl.NumberFormat(locale, options).format(num);
  }, [locale]);

  const formatDate = useCallback((date: Date | string, options?: Intl.DateTimeFormatOptions) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat(locale, options || {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d);
  }, [locale]);

  const formatDateTime = useCallback((date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }, [locale]);

  const formatRelativeTime = useCallback((date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return i18n.language === 'de' ? 'Gerade eben' : 'Just now';
    if (diffMins < 60) return i18n.language === 'de' ? `vor ${diffMins} Minuten` : `${diffMins} minutes ago`;
    if (diffHours < 24) return i18n.language === 'de' ? `vor ${diffHours} Stunden` : `${diffHours} hours ago`;
    if (diffDays < 7) return i18n.language === 'de' ? `vor ${diffDays} Tagen` : `${diffDays} days ago`;
    return formatDate(d);
  }, [i18n.language, formatDate]);

  const formatPercent = useCallback((value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(value / 100);
  }, [locale]);

  return {
    locale,
    formatCurrency,
    formatNumber,
    formatDate,
    formatDateTime,
    formatRelativeTime,
    formatPercent,
  };
}
