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
  due         date,
  repeat      text default '',
  done_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- Only people listed here can see or change cards.
create table if not exists public.members (
  email text primary key
);

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
