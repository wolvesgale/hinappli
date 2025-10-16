-- Adds a denormalized display_name column to attendances and keeps it in sync.

-- 1) Column addition (idempotent)
alter table public.attendances
  add column if not exists display_name text;

-- 2) Backfill from user_roles when possible
update public.attendances a
set display_name = coalesce(ur.display_name, a.user_email)
from public.user_roles ur
where lower(ur.email) = lower(a.user_email)
  and (a.display_name is null or a.display_name = '');

-- Ensure no empty display_name values remain
update public.attendances
set display_name = coalesce(display_name, user_email)
where display_name is null or display_name = '';

-- 3) Trigger function to apply display_name on insert/update
create or replace function public.fn_apply_display_name()
returns trigger
language plpgsql
as $$
declare
  v_name text;
begin
  select ur.display_name
    into v_name
  from public.user_roles ur
  where lower(ur.email) = lower(new.user_email)
  limit 1;

  if new.display_name is null or new.display_name = '' then
    new.display_name := coalesce(v_name, new.user_email);
  end if;

  return new;
end;
$$;

-- 4) Trigger to enforce display_name on attendances changes
drop trigger if exists trg_attendances_display_name on public.attendances;

create trigger trg_attendances_display_name
before insert or update of user_email, display_name
on public.attendances
for each row
execute function public.fn_apply_display_name();

-- 5) Propagate display_name updates from user_roles
create or replace function public.fn_propagate_display_name()
returns trigger
language plpgsql
as $$
begin
  update public.attendances a
  set display_name = coalesce(new.display_name, a.user_email)
  where lower(a.user_email) = lower(new.email);
  return new;
end;
$$;

drop trigger if exists trg_user_roles_propagate on public.user_roles;

create trigger trg_user_roles_propagate
after insert or update of display_name, email
on public.user_roles
for each row
execute function public.fn_propagate_display_name();
