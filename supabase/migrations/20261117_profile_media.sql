-- Let a signed-in user save their own avatar and cover.
-- Apply in the Yoohoo test Supabase SQL editor.
grant update on public.profiles to authenticated;

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
