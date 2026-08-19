-- =============================================================================
-- 2FA ENFORCEMENT: authoritative server-side MFA state
-- Idempotent. Safe to run multiple times.
-- =============================================================================

-- Returns the CURRENT user's verified TOTP factors straight from auth.mfa_factors.
-- SECURITY DEFINER so the client can read its own factor state even when the
-- client-side factor list is empty/stale (old accounts enrolled before this
-- release). Only ever exposes data for auth.uid().
create or replace function public.dkai_my_mfa_state()
returns table (has_verified_factor boolean, factor_ids uuid[])
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    exists (
      select 1 from auth.mfa_factors f
      where f.user_id = auth.uid()
        and f.status = 'verified'
    ) as has_verified_factor,
    coalesce(
      (select array_agg(f.id order by f.created_at)
       from auth.mfa_factors f
       where f.user_id = auth.uid()
         and f.status = 'verified'),
      '{}'::uuid[]
    ) as factor_ids;
$$;

revoke all on function public.dkai_my_mfa_state() from public;
grant execute on function public.dkai_my_mfa_state() to authenticated;

-- Helper for RLS: true when the caller either has no 2FA at all (2FA is
-- OPTIONAL per account) or has completed the challenge (aal2).
create or replace function public.dkai_mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    case
      when not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = auth.uid() and f.status = 'verified'
      ) then true
      else coalesce(
        (current_setting('request.jwt.claims', true)::jsonb ->> 'aal') = 'aal2',
        false
      )
    end;
$$;

revoke all on function public.dkai_mfa_satisfied() from public;
grant execute on function public.dkai_mfa_satisfied() to authenticated;
grant execute on function public.dkai_mfa_satisfied() to service_role;
