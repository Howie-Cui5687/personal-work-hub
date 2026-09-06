-- Read-only checks to run in Supabase SQL Editor after schema.sql.

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'private_items';

select
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'private_items'
order by grantee, privilege_type;

select
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public' and tablename = 'private_items'
order by cmd;

-- Expected:
-- 1) rls_enabled = true and rls_forced = true
-- 2) authenticated has SELECT/INSERT/UPDATE/DELETE; anon has no rows
-- 3) exactly four policies, all scoped to authenticated and auth.uid() = user_id
