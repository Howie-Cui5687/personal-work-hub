-- Personal Workbench: private records protected by PostgreSQL RLS.
-- Run the entire file in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.private_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('task', 'study', 'note')),
  title text not null check (char_length(title) between 1 and 120),
  content text not null default '' check (char_length(content) <= 4000),
  status text not null default 'planned' check (status in ('planned', 'active', 'done')),
  progress integer not null default 0 check (progress between 0 and 100),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists private_items_user_updated_idx
  on public.private_items (user_id, updated_at desc);

alter table public.private_items enable row level security;
alter table public.private_items force row level security;

-- Grants are the first security gate. Signed-out visitors receive no table
-- privilege at all; signed-in users still need to pass every RLS policy below.
revoke all on table public.private_items from anon, authenticated;
grant select, insert, update, delete on table public.private_items to authenticated;

drop policy if exists "private_items_select_own" on public.private_items;
drop policy if exists "private_items_insert_own" on public.private_items;
drop policy if exists "private_items_update_own" on public.private_items;
drop policy if exists "private_items_delete_own" on public.private_items;

create policy "private_items_select_own"
  on public.private_items
  for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "private_items_insert_own"
  on public.private_items
  for insert
  to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "private_items_update_own"
  on public.private_items
  for update
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "private_items_delete_own"
  on public.private_items
  for delete
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

-- A separate policy is intentionally used for each operation. There is no
-- policy for anon and no public read path.
