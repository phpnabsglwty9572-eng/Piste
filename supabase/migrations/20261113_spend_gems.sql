-- Test project: deduct gems on the server. Apply in the Yoohoo test Supabase SQL editor.
create or replace function public.spend_gems(p_amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  next integer;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid amount';
  end if;
  update public.profiles
    set gems = gems - p_amount
    where id = uid and gems >= p_amount
    returning gems into next;
  if next is null then
    raise exception 'not enough coins';
  end if;
  return next;
end;
$$;

revoke all on function public.spend_gems(integer) from public;
grant execute on function public.spend_gems(integer) to authenticated;
