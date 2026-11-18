-- Drop the Yoohoo mascot account and let settings feedback insert without a select grant.
-- Apply in the Yoohoo test Supabase SQL editor.

create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;
grant select, insert on public.feedback to authenticated;

drop policy if exists feedback_select on public.feedback;
create policy feedback_select on public.feedback
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback
  for insert to authenticated
  with check (user_id = (select auth.uid()));

do $$
declare
  gone uuid := 'd584bdef-394d-441e-86b0-ab252deb058d';
  rec record;
  pass int;
begin
  if to_regclass('storage.objects') is not null then
    delete from storage.objects
    where bucket_id = 'media' and name like gone::text || '/%';
  end if;

  for pass in 1..8 loop
    for rec in
      select c.table_schema, c.table_name, c.column_name
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
      where c.table_schema = 'public'
        and t.table_type = 'BASE TABLE'
        and c.udt_name = 'uuid'
        and c.table_name <> 'profiles'
    loop
      begin
        execute format(
          'delete from %I.%I where %I = $1',
          rec.table_schema, rec.table_name, rec.column_name
        ) using gone;
      exception when others then
        null;
      end;
    end loop;
  end loop;

  delete from public.profiles where id = gone;
  delete from auth.users where id = gone;
end $$;
