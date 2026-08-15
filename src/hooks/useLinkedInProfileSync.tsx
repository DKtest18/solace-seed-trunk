import { useEffect, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { db } from '@/lib/dkaiDb';

/**
 * When a user signs in (or links) via LinkedIn OIDC, mirror the LinkedIn
 * identity onto their dkai_profiles row: mark verified, and fill in avatar,
 * full name and the LinkedIn profile URL when available.
 */
export function useLinkedInProfileSync(user: User | null) {
  const syncedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      syncedFor.current = null;
      return;
    }
    if (syncedFor.current === user.id) return;

    const identity = user.identities?.find((i) => i.provider === 'linkedin_oidc');
    const meta: Record<string, any> = {
      ...(user.user_metadata || {}),
      ...((identity?.identity_data as Record<string, any>) || {}),
    };
    const isLinkedIn = !!identity || user.app_metadata?.provider === 'linkedin_oidc';
    if (!isLinkedIn) return;

    syncedFor.current = user.id;

    (async () => {
      try {
        const { data: existing } = await db
          .from('dkai_profiles')
          .select('id, full_name, avatar_url, linkedin_url, is_linkedin_verified')
          .eq('id', user.id)
          .maybeSingle();

        const linkedinUrl: string | null =
          meta.linkedin_url || meta.profile || meta.website || null;
        const fullName: string | null =
          meta.name || meta.full_name ||
          [meta.given_name, meta.family_name].filter(Boolean).join(' ') || null;
        const avatarUrl: string | null = meta.picture || meta.avatar_url || null;

        const payload: Record<string, any> = { is_linkedin_verified: true };
        if (fullName && !existing?.full_name) payload.full_name = fullName;
        if (avatarUrl && !existing?.avatar_url) payload.avatar_url = avatarUrl;
        if (linkedinUrl && !existing?.linkedin_url) payload.linkedin_url = linkedinUrl;

        if (existing) {
          await db.from('dkai_profiles').update(payload).eq('id', user.id);
        } else {
          await db.from('dkai_profiles').insert({ id: user.id, ...payload });
        }
      } catch {
        // Non-fatal: profile sync should never block sign-in.
        syncedFor.current = null;
      }
    })();
  }, [user]);
}
