-- Creates or replaces an RPC that returns attendance records with user display names.
-- This function joins attendances to user_roles while bypassing RLS by using
-- SECURITY DEFINER. It keeps existing data intact and falls back to the raw email
-- when no display name is registered.
create or replace function public.fetch_attendances_with_names(
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  id uuid,
  user_id uuid,
  user_email text,
  start_time timestamptz,
  end_time   timestamptz,
  companion_checked boolean,
  created_at timestamptz,
  role text,
  display_name text
)
language sql
security definer
set search_path = public
as $$
  select
    a.id,
    a.user_id,
    a.user_email,
    a.start_time,
    a.end_time,
    coalesce(a.companion_checked, false) as companion_checked,
    a.created_at,
    ur.role::text,
    coalesce(ur.display_name, a.user_email) as display_name
  from public.attendances a
  left join public.user_roles ur
    on lower(ur.email) = lower(a.user_email)
  where a.start_time >= p_from
    and a.start_time <  p_to
  order by a.start_time asc;
$$;

grant execute on function public.fetch_attendances_with_names(timestamptz, timestamptz)
  to anon, authenticated, service_role;
