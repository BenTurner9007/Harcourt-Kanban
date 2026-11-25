-- Harcourt Kanban database setup.
-- Paste this whole file into Supabase > SQL Editor and click Run.
-- Then change the two email addresses at the bottom to yours.

create table if not exists public.cards (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  notes       text default '',
  status      text not null default 'todo',
  assignee    text default '',
  category    text default '',
  room        text default '',
  due         date,
  repeat      text default '',
  done_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- (For databases made before rooms were added.)
alter table public.cards add column if not exists room text default '';
alter table public.cards add column if not exists size text default '';
alter table public.cards add column if not exists checklist jsonb default '[]'::jsonb;
alter table public.cards add column if not exists photos jsonb default '[]'::jsonb;

-- Only people listed here can see or change cards.
create table if not exists public.members (
  email text primary key
);

-- Newer Supabase projects don't expose new tables automatically,
-- so give signed-in users access (the policy below still limits it to members).
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.cards to authenticated;
grant select on public.members to authenticated;

alter table public.cards   enable row level security;
alter table public.members enable row level security;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

drop policy if exists "members can do everything" on public.cards;
create policy "members can do everything" on public.cards
  for all to authenticated
  using (public.is_member())
  with check (public.is_member());

-- Live updates between your phones.
do $$ begin
  alter publication supabase_realtime add table public.cards;
exception when duplicate_object then null; end $$;

-- >>> Change these to the two email addresses you will sign in with <<<
insert into public.members (email) values
  ('you@example.com'),
  ('partner@example.com')
on conflict do nothing;

-- ---------- Photos ----------
-- A private storage bucket. Only members can see, add or remove photos.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "members read photos"   on storage.objects;
drop policy if exists "members add photos"    on storage.objects;
drop policy if exists "members change photos" on storage.objects;
drop policy if exists "members remove photos" on storage.objects;

create policy "members read photos" on storage.objects
  for select to authenticated using (bucket_id = 'photos' and public.is_member());
create policy "members add photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos' and public.is_member());
create policy "members change photos" on storage.objects
  for update to authenticated using (bucket_id = 'photos' and public.is_member());
create policy "members remove photos" on storage.objects
  for delete to authenticated using (bucket_id = 'photos' and public.is_member());
