import { Card } from '@/components/ui/card';
import { Briefcase, GraduationCap } from 'lucide-react';
import { EducationItem, ExperienceItem, formatDateRange } from '@/types/profile';

interface Props {
  about?: string | null;
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: string[];
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-6 sm:p-8 rounded-2xl">
      <h2 className="font-display text-xl font-semibold text-gray-900 mb-5">{title}</h2>
      {children}
    </Card>
  );
}

export function ProfileDetailSections({ about, experience, education, skills }: Props) {
  const hasAny = !!about || experience.length > 0 || education.length > 0 || skills.length > 0;
  if (!hasAny) return null;

  return (
    <div className="space-y-6">
      {about && (
        <SectionCard title="About">
          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{about}</p>
        </SectionCard>
      )}

      {experience.length > 0 && (
        <SectionCard title="Experience">
          <ul className="divide-y divide-border">
            {experience.map((item) => (
              <li key={item.id} className="flex gap-4 py-5 first:pt-0 last:pb-0">
                <div className="h-12 w-12 rounded-md bg-background-soft flex items-center justify-center shrink-0">
                  <Briefcase className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">{item.title}</p>
                  <p className="text-sm text-gray-700">{item.company}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDateRange(item.start_date, item.end_date, item.is_current_role)}
                    {item.location ? ` · ${item.location}` : ''}
                  </p>
                  {item.description && (
                    <p className="text-sm text-gray-700 mt-3 leading-relaxed whitespace-pre-wrap">
                      {item.description}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {education.length > 0 && (
        <SectionCard title="Education">
          <ul className="divide-y divide-border">
            {education.map((item) => (
              <li key={item.id} className="flex gap-4 py-5 first:pt-0 last:pb-0">
                <div className="h-12 w-12 rounded-md bg-background-soft flex items-center justify-center shrink-0">
                  <GraduationCap className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">{item.school}</p>
                  {(item.degree || item.field_of_study) && (
                    <p className="text-sm text-gray-700">
                      {[item.degree, item.field_of_study].filter(Boolean).join(', ')}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDateRange(item.start_date, item.end_date)}
                  </p>
                  {item.description && (
                    <p className="text-sm text-gray-700 mt-3 leading-relaxed whitespace-pre-wrap">
                      {item.description}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {skills.length > 0 && (
        <SectionCard title="Skills">
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <span key={skill} className="bg-primary-soft text-primary text-sm px-3 py-1.5 rounded-full">
                {skill}
              </span>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
