-- Supabase access_requests テーブル整合SQL
-- 既存テーブルとの衝突を避けた安全な移行スクリプト

-- 1) テーブルが無ければ作成（存在するなら何もしない）
create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  note text,
  display_name text,
  requested_role text,
  created_at timestamp with time zone not null default now()
);

-- 2) 必要なら note を追加（既にある場合は何もしない）
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'access_requests'
      and column_name = 'note'
  ) then
    alter table public.access_requests add column note text;
  end if;
end $$;

-- 3) display_name / requested_role をオプショナル化（NOT NULL を外す）
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'access_requests'
      and column_name = 'display_name'
      and is_nullable = 'NO'
  ) then
    alter table public.access_requests alter column display_name drop not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'access_requests'
      and column_name = 'requested_role'
      and is_nullable = 'NO'
  ) then
    alter table public.access_requests alter column requested_role drop not null;
  end if;
end $$;

-- 4) 参考：RLS（行レベルセキュリティ）を有効にする場合
-- alter table public.access_requests enable row level security;
-- create policy "allow_insert_anon"
--   on public.access_requests for insert
--   to anon
--   with check (true);

-- 認証済みユーザのみに申請させる方針なら、to authenticated に変更
-- create policy "allow_insert_authenticated"
--   on public.access_requests for insert
--   to authenticated
--   with check (true);