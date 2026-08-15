import JSZip from 'jszip';
import {
  EducationItem,
  ExperienceItem,
  newId,
} from '@/types/profile';

export interface LinkedInImportResult {
  headline?: string;
  about?: string;
  location?: string;
  website?: string;
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: string[];
  filesFound: string[];
}

/** Minimal RFC4180 CSV parser (handles quoted fields, embedded commas/newlines). */
export function parseCsv(text: string): Record<string, string>[] {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      field = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((v) => v.trim() !== '')) rows.push(row);

  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? '').trim();
    });
    return obj;
  });
}

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

/** LinkedIn exports dates as "Jan 2020", "2020", or empty. Normalise to YYYY-MM. */
export function normaliseLinkedInDate(value?: string): string {
  const raw = (value || '').trim();
  if (!raw) return '';
  const monthYear = raw.match(/^([A-Za-z]{3})[a-z]*\s+(\d{4})$/);
  if (monthYear) {
    const month = MONTHS[monthYear[1].toLowerCase()];
    if (month) return `${monthYear[2]}-${month}`;
  }
  const isoish = raw.match(/^(\d{4})-(\d{1,2})/);
  if (isoish) return `${isoish[1]}-${isoish[2].padStart(2, '0')}`;
  const yearOnly = raw.match(/^(\d{4})$/);
  if (yearOnly) return `${yearOnly[1]}-01`;
  return '';
}

const pick = (row: Record<string, string>, ...keys: string[]) => {
  for (const key of keys) {
    const match = Object.keys(row).find(
      (k) => k.toLowerCase() === key.toLowerCase(),
    );
    if (match && row[match]) return row[match];
  }
  return '';
};

export function mapPositions(rows: Record<string, string>[]): ExperienceItem[] {
  return rows
    .map((row) => {
      const end = normaliseLinkedInDate(pick(row, 'Finished On', 'End Date'));
      const item: ExperienceItem = {
        id: newId(),
        title: pick(row, 'Title', 'Position'),
        company: pick(row, 'Company Name', 'Company'),
        start_date: normaliseLinkedInDate(pick(row, 'Started On', 'Start Date')),
        end_date: end || null,
        is_current_role: !end,
        location: pick(row, 'Location'),
        description: pick(row, 'Description'),
      };
      return item;
    })
    .filter((item) => item.title || item.company)
    .sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''));
}

export function mapEducation(rows: Record<string, string>[]): EducationItem[] {
  return rows
    .map((row) => {
      const item: EducationItem = {
        id: newId(),
        school: pick(row, 'School Name', 'School'),
        degree: pick(row, 'Degree Name', 'Degree'),
        field_of_study: pick(row, 'Field Of Study', 'Notes'),
        start_date: normaliseLinkedInDate(pick(row, 'Start Date', 'Started On')),
        end_date: normaliseLinkedInDate(pick(row, 'End Date', 'Finished On')) || null,
        description: pick(row, 'Activities and Societies', 'Activities', 'Description'),
      };
      return item;
    })
    .filter((item) => item.school)
    .sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''));
}

export function mapSkills(rows: Record<string, string>[]): string[] {
  const names = rows
    .map((row) => pick(row, 'Name', 'Skill'))
    .filter(Boolean)
    .map((s) => s.slice(0, 60));
  return Array.from(new Set(names)).slice(0, 30);
}

const findEntry = (names: string[], target: string) =>
  names.find((n) => {
    const base = n.split('/').pop()?.toLowerCase() ?? '';
    return base === `${target}.csv`;
  });

/** Reads a LinkedIn "Get a copy of your data" archive (ZIP) or a single CSV file. */
export async function parseLinkedInExport(file: File): Promise<LinkedInImportResult> {
  const result: LinkedInImportResult = {
    experience: [],
    education: [],
    skills: [],
    filesFound: [],
  };

  const isZip = file.name.toLowerCase().endsWith('.zip');

  if (!isZip) {
    const rows = parseCsv(await file.text());
    const headers = Object.keys(rows[0] ?? {}).map((h) => h.toLowerCase());
    result.filesFound.push(file.name);
    if (headers.includes('company name') || headers.includes('title')) {
      result.experience = mapPositions(rows);
    } else if (headers.includes('school name')) {
      result.education = mapEducation(rows);
    } else if (headers.includes('headline') || headers.includes('summary')) {
      const p = rows[0] ?? {};
      result.headline = pick(p, 'Headline').slice(0, 160) || undefined;
      result.about = pick(p, 'Summary') || undefined;
      result.location = pick(p, 'Geo Location', 'Address') || undefined;
      result.website = pick(p, 'Websites').split(':').slice(1).join(':') || undefined;
    } else {
      result.skills = mapSkills(rows);
    }
    return result;
  }

  const zip = await JSZip.loadAsync(file);
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);

  const read = async (target: string) => {
    const entry = findEntry(names, target);
    if (!entry) return null;
    result.filesFound.push(entry.split('/').pop() as string);
    return parseCsv(await zip.files[entry].async('string'));
  };

  const [profile, positions, education, skills] = await Promise.all([
    read('Profile'),
    read('Positions'),
    read('Education'),
    read('Skills'),
  ]);

  if (profile && profile[0]) {
    const p = profile[0];
    result.headline = pick(p, 'Headline').slice(0, 160) || undefined;
    result.about = pick(p, 'Summary') || undefined;
    result.location = pick(p, 'Geo Location', 'Address') || undefined;
    const websites = pick(p, 'Websites');
    const url = websites.match(/https?:\/\/[^\s,\]]+/);
    result.website = url ? url[0] : undefined;
  }
  if (positions) result.experience = mapPositions(positions);
  if (education) result.education = mapEducation(education);
  if (skills) result.skills = mapSkills(skills);

  return result;
}
