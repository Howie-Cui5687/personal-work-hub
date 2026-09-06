-- Run once in Supabase SQL Editor. Adds only the daily_reports table.
-- Existing private_items and their data are not changed.
begin;

create table public.daily_reports (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  report_date date not null,
  parts jsonb not null,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, report_date),
  constraint daily_reports_parts_shape check (
    jsonb_typeof(parts) = 'object'
    and parts ?& array['work', 'delivery', 'help', 'meeting']
    and octet_length(parts::text) <= 1048576
  )
);

alter table public.daily_reports enable row level security;
alter table public.daily_reports force row level security;
revoke all on public.daily_reports from public, anon, authenticated;
grant select, insert, update on public.daily_reports to authenticated;

create policy daily_reports_select_own on public.daily_reports
  for select to authenticated using ((select auth.uid()) = user_id);
create policy daily_reports_insert_own on public.daily_reports
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy daily_reports_update_own on public.daily_reports
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Server-owned revision prevents silent overwrites between devices.
create function public.daily_reports_stamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' then
    NEW.revision := OLD.revision + 1;
    NEW.created_at := OLD.created_at;
  else
    NEW.revision := 1;
    NEW.created_at := now();
  end if;
  NEW.updated_at := now();
  return NEW;
end;
$$;
revoke all on function public.daily_reports_stamp() from public, anon, authenticated;
create trigger daily_reports_stamp before insert or update on public.daily_reports
  for each row execute function public.daily_reports_stamp();
commit;
