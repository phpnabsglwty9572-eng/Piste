-- Official catalog is readable without a user JWT. Email-registered
-- sessions that still hit PostgREST as anon were getting 0 rooms/posts.
drop policy if exists rooms_read_anon on public.rooms;
create policy rooms_read_anon on public.rooms
  for select to anon using (true);

drop policy if exists posts_read_anon on public.posts;
create policy posts_read_anon on public.posts
  for select to anon using (true);

drop policy if exists comments_read_anon on public.comments;
create policy comments_read_anon on public.comments
  for select to anon using (true);

drop policy if exists profiles_read_anon on public.profiles;
create policy profiles_read_anon on public.profiles
  for select to anon using (coalesce(is_seed, false) = true);

update public.rooms
set
  cover_url = 'https://unxvkrjhqswcqucustkg.supabase.co/storage/v1/object/public/media/yoohoo/rooms/live-1.png',
  video_url = 'https://unxvkrjhqswcqucustkg.supabase.co/storage/v1/object/public/media/yoohoo/extra/--3.mp4'
where title = 'Just chilling and skiing'
  and cover_url is null;

update public.rooms
set
  cover_url = 'https://unxvkrjhqswcqucustkg.supabase.co/storage/v1/object/public/media/yoohoo/rooms/live-2.png',
  video_url = 'https://unxvkrjhqswcqucustkg.supabase.co/storage/v1/object/public/media/yoohoo/extra/--4.mp4'
where title = 'Quick live run before I leave'
  and cover_url is null;
