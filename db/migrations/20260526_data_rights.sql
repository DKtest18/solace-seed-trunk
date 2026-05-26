-- Self-Service Data Rights (GDPR/revDSG)
-- Deletion requests table + private storage bucket for data exports

create table if not exists public.dkai_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  requested_at timestamptz not null default now(),
  scheduled_deletion_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_dkai_deletion_requests_scheduled
  on public.dkai_deletion_requests (scheduled_deletion_at)
  where status = 'pending';

alter table public.dkai_deletion_requests enable row level security;

-- User can view own request
drop policy if exists "User views own deletion request" on public.dkai_deletion_requests;
create policy "User views own deletion request"
  on public.dkai_deletion_requests
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Admin can view all (uses existing dkai_has_role helper)
drop policy if exists "Admin views all deletion requests" on public.dkai_deletion_requests;
create policy "Admin views all deletion requests"
  on public.dkai_deletion_requests
  for select
  to authenticated
  using (public.dkai_has_role(auth.uid(), 'admin'));

-- INSERT/UPDATE/DELETE only via edge functions (service role bypasses RLS)
-- No insert/update/delete policies defined for authenticated users.

-- Private storage bucket for data exports
insert into storage.buckets (id, name, public)
values ('user-data-exports', 'user-data-exports', false)
on conflict (id) do nothing;

-- Only owner can read their own export (folder = user_id)
drop policy if exists "Users read own data exports" on storage.objects;
create policy "Users read own data exports"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'user-data-exports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
