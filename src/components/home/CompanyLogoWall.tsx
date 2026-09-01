import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { db } from '@/lib/dkaiDb';
import { supabase } from '@/integrations/supabase/client';

type LogoRow = { company_name: string | null; logo_path: string | null };

function publicLogoUrl(path: string) {
  return supabase.storage.from('company-logos').getPublicUrl(path).data.publicUrl;
}

/**
 * Homepage logo wall. Shows ONLY companies that explicitly consented to public
 * display during seller onboarding (dkai_public_company_logos filters on that
 * consent flag server-side). Renders nothing when no company has opted in.
 */
export function CompanyLogoWall() {
  const { t } = useTranslation();

  const { data } = useQuery({
    queryKey: ['home-company-logos'],
    queryFn: async () => {
      const { data, error } = await db.rpc('dkai_public_company_logos');
      if (error) throw error;
      return (data ?? []) as LogoRow[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const logos = (data ?? []).filter((l) => !!l.logo_path);
  if (!logos.length) return null;

  return (
    <section className="relative max-w-6xl mx-auto px-6 py-16">
      <h2 className="text-center text-sm uppercase tracking-widest text-[var(--text-dim)] mb-8">
        {t('landing.logoWallTitle', 'Companies selling on DK AI Marketplace')}
      </h2>
      <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-8">
        {logos.map((l, i) => (
          <li key={`${l.logo_path}-${i}`}>
            <img
              src={publicLogoUrl(l.logo_path!)}
              alt={l.company_name ?? t('landing.logoWallAlt', 'Company logo')}
              loading="lazy"
              className="h-10 w-auto max-w-[160px] object-contain opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
