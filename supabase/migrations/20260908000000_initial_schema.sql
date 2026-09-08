create table public.songs (
  id uuid primary key default gen_random_uuid(),
  genius_id bigint not null unique,
  title text not null,
  artist text not null,
  artwork_url text,
  genius_url text not null,
  lyrics text not null,
  created_at timestamptz not null default now()
);

create table public.vocabulary (
  id uuid primary key default gen_random_uuid(),
  word text not null unique,
  last_seen timestamptz,
  created_at timestamptz not null default now()
);

alter table public.songs enable row level security;
alter table public.vocabulary enable row level security;
grant select, insert on public.songs to authenticated;
grant select, insert, update on public.vocabulary to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create policy "authenticated can read songs" on public.songs for select to authenticated using (true);
create policy "authenticated can add songs" on public.songs for insert to authenticated with check (true);
create policy "authenticated can read vocabulary" on public.vocabulary for select to authenticated using (true);
create policy "authenticated can add vocabulary" on public.vocabulary for insert to authenticated with check (true);
create policy "authenticated can update vocabulary" on public.vocabulary for update to authenticated using (true) with check (true);
