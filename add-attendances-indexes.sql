-- attendancesテーブルの検索高速化インデックス追加

-- user_emailとstart_timeの複合インデックス（勤怠履歴取得用）
create index if not exists idx_att_user_email_start 
on public.attendances(user_email, start_time);

-- 同伴出勤の集計用インデックス
create index if not exists idx_att_companion 
on public.attendances(user_email, companion_checked, start_time);

-- 現在出勤中の検索用インデックス（end_timeがnullの場合）
create index if not exists idx_att_current 
on public.attendances(user_email, end_time) 
where end_time is null;

-- 日付範囲検索用インデックス
create index if not exists idx_att_start_time 
on public.attendances(start_time);

-- 確認用クエリ
select schemaname, tablename, indexname, indexdef
from pg_indexes
where tablename = 'attendances'
order by indexname;