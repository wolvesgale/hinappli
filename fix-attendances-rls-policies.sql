-- attendancesテーブルのRLSポリシー修正
-- user_emailベースの認証を確実にし、同伴出勤機能に対応

-- 既存のポリシーを削除（冪等性確保）
drop policy if exists "att_self_select" on public.attendances;
drop policy if exists "att_self_ins" on public.attendances;
drop policy if exists "att_self_upd" on public.attendances;
drop policy if exists "att_self_del" on public.attendances;
drop policy if exists "att_owner_select_all" on public.attendances;

-- 本人は自分の行のみ参照
create policy "att_self_select"
on public.attendances for select to authenticated
using (user_email = auth.email());

-- 本人は自分の行のみ挿入
create policy "att_self_ins"
on public.attendances for insert to authenticated
with check (user_email = auth.email());

-- 本人は自分の行のみ更新
create policy "att_self_upd"
on public.attendances for update to authenticated
using (user_email = auth.email())
with check (user_email = auth.email());

-- 本人は自分の行のみ削除
create policy "att_self_del"
on public.attendances for delete to authenticated
using (user_email = auth.email());

-- オーナーは全件参照可能
create policy "att_owner_select_all"
on public.attendances for select to authenticated
using (
  exists (select 1 from public.user_roles ur
          where ur.email = auth.email() and ur.role = 'owner')
);

-- オーナーは全件更新可能（必要に応じて）
create policy "att_owner_update_all"
on public.attendances for update to authenticated
using (
  exists (select 1 from public.user_roles ur
          where ur.email = auth.email() and ur.role = 'owner')
)
with check (true);

-- オーナーは全件削除可能（必要に応じて）
create policy "att_owner_delete_all"
on public.attendances for delete to authenticated
using (
  exists (select 1 from public.user_roles ur
          where ur.email = auth.email() and ur.role = 'owner')
);

-- RLSが有効になっていることを確認
alter table public.attendances enable row level security;

-- 確認用クエリ
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where tablename = 'attendances'
order by policyname;