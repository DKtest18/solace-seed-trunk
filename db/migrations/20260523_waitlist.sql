-- ============================================================
-- WAITLIST MODE — pre-launch gate for DK AI Marketplace
-- Apply via the project's existing standalone-Supabase migration
-- workflow (this repo does not use Lovable Cloud migrations).
-- ============================================================

-- 1) dkai_waitlist table -------------------------------------
create table if not exists public.dkai_waitlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  reason_for_joining text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  declined_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_dkai_waitlist_status_created
  on public.dkai_waitlist (status, created_at desc);

alter table public.dkai_waitlist enable row level security;

-- 2) is_active flag on dkai_profiles -------------------------
alter table public.dkai_profiles
  add column if not exists is_active boolean not null default false;

create index if not exists idx_dkai_profiles_is_active
  on public.dkai_profiles (is_active);

-- Existing users keep access (only NEW signups hit the waitlist)
update public.dkai_profiles
   set is_active = true
 where id in (select id from auth.users);

-- 3) RLS policies on dkai_waitlist ---------------------------
drop policy if exists "waitlist_select_admin_or_owner" on public.dkai_waitlist;
create policy "waitlist_select_admin_or_owner"
on public.dkai_waitlist
for select
to authenticated
using (
  user_id = auth.uid()
  or public.dkai_has_role(auth.uid(), 'admin')
);

drop policy if exists "waitlist_update_admin" on public.dkai_waitlist;
create policy "waitlist_update_admin"
on public.dkai_waitlist
for update
to authenticated
using (public.dkai_has_role(auth.uid(), 'admin'))
with check (public.dkai_has_role(auth.uid(), 'admin'));

drop policy if exists "waitlist_delete_admin" on public.dkai_waitlist;
create policy "waitlist_delete_admin"
on public.dkai_waitlist
for delete
to authenticated
using (public.dkai_has_role(auth.uid(), 'admin'));

-- No INSERT policy → only service-role / SECURITY DEFINER triggers can insert.

-- 4) Trigger on auth.users -----------------------------------
-- Auto-create waitlist row + ensure profile. Admin email bypass.
create or replace function public.handle_new_user_waitlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_reason    text;
  v_is_admin  boolean := (lower(new.email) = 'dari@dkaisystem.com');
begin
  v_full_name := coalesce(new.raw_user_meta_data ->> 'full_name', '');
  v_reason    := nullif(new.raw_user_meta_data ->> 'reason_for_joining', '');

  -- Ensure a profile exists; flag admin as active.
  insert into public.dkai_profiles (id, is_active)
  values (new.id, v_is_admin)
  on conflict (id) do update
    set is_active = excluded.is_active or public.dkai_profiles.is_active;

  if v_is_admin then
    insert into public.dkai_user_roles (user_id, role)
    values (new.id, 'admin')
    on conflict do nothing;
  else
    insert into public.dkai_waitlist (user_id, email, full_name, reason_for_joining, status)
    values (new.id, new.email, nullif(v_full_name, ''), v_reason, 'pending')
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_waitlist on auth.users;
create trigger on_auth_user_created_waitlist
after insert on auth.users
for each row execute function public.handle_new_user_waitlist();
