-- 同伴出勤チェック機能のためのスキーマ修正
-- attendancesテーブルにcompanion_checkedカラムを追加

-- 1. attendancesテーブルにcompanion_checkedカラムを追加
ALTER TABLE attendances 
ADD COLUMN companion_checked BOOLEAN DEFAULT FALSE;

-- 2. 既存データのcompanion_checkedをFALSEに設定（デフォルト値で自動設定されるが明示的に実行）
UPDATE attendances 
SET companion_checked = FALSE 
WHERE companion_checked IS NULL;

-- 3. companion_checkedカラムにNOT NULL制約を追加
ALTER TABLE attendances 
ALTER COLUMN companion_checked SET NOT NULL;

-- 4. 同伴出勤の集計用インデックスを追加（パフォーマンス向上のため）
CREATE INDEX IF NOT EXISTS idx_attendances_companion_checked 
ON attendances(user_email, companion_checked) 
WHERE companion_checked = TRUE;

-- 5. 日付範囲での同伴出勤集計用インデックス
CREATE INDEX IF NOT EXISTS idx_attendances_companion_date 
ON attendances(user_email, start_time, companion_checked) 
WHERE companion_checked = TRUE;

-- 6. 確認用クエリ: テーブル構造の確認
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'attendances' 
AND column_name = 'companion_checked';

-- 7. 確認用クエリ: インデックスの確認
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'attendances' 
AND indexname LIKE '%companion%';

-- 8. 確認用クエリ: サンプルデータの確認
SELECT id, user_email, start_time, end_time, companion_checked 
FROM attendances 
ORDER BY start_time DESC 
LIMIT 5;