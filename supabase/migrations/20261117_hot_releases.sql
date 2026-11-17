-- Published RN/H5 bundles. Apply in the Yoohoo test Supabase SQL editor.
create table if not exists public.hot_releases (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'ios',
  channel text not null default 'test',
  version integer not null,
  min_native text not null default '1.0',
  rn_url text,
  h5_url text not null,
  notes text,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.hot_releases enable row level security;

drop policy if exists "read published hot releases" on public.hot_releases;
create policy "read published hot releases"
  on public.hot_releases
  for select
  using (published = true);

insert into storage.buckets (id, name, public)
values ('hot-update', 'hot-update', true)
on conflict (id) do nothing;
