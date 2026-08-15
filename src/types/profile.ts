export interface ExperienceItem {
  id: string;
  title: string;
  company: string;
  start_date: string; // YYYY-MM
  end_date: string | null; // YYYY-MM or null when current
  is_current_role: boolean;
  location: string;
  description: string;
}

export interface EducationItem {
  id: string;
  school: string;
  degree: string;
  field_of_study: string;
  start_date: string; // YYYY-MM
  end_date: string | null;
  description: string;
}

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const emptyExperience = (): ExperienceItem => ({
  id: newId(),
  title: '',
  company: '',
  start_date: '',
  end_date: '',
  is_current_role: false,
  location: '',
  description: '',
});

export const emptyEducation = (): EducationItem => ({
  id: newId(),
  school: '',
  degree: '',
  field_of_study: '',
  start_date: '',
  end_date: '',
  description: '',
});

/** Formats "YYYY-MM" into "Mon YYYY". Falls back to raw value. */
export function formatMonthYear(value?: string | null): string {
  if (!value) return '';
  const [y, m] = value.split('-');
  const year = Number(y);
  const month = Number(m);
  if (!year || !month || month < 1 || month > 12) return value;
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function formatDateRange(
  start?: string | null,
  end?: string | null,
  isCurrent?: boolean,
): string {
  const from = formatMonthYear(start);
  const to = isCurrent ? 'Present' : formatMonthYear(end);
  if (from && to) return `${from} – ${to}`;
  return from || to || '';
}

export function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}
