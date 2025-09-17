-- 同伴出勤チェック機能のためのスキーマ更新
-- attendancesテーブルにcompanion_checkedカラムを追加

-- 1. companion_checkedカラムを追加（デフォルト値はfalse）
ALTER TABLE attendances 
ADD COLUMN companion_checked BOOLEAN DEFAULT false NOT NULL;

-- 2. 既存のデータにデフォルト値を設定
UPDATE attendances 
SET companion_checked = false 
WHERE companion_checked IS NULL;

-- 3. インデックスを追加（同伴出勤の検索を高速化）
CREATE INDEX IF NOT EXISTS idx_attendances_companion_checked 
ON attendances(companion_checked, start_time);

-- 4. 同伴出勤の統計用インデックス
CREATE INDEX IF NOT EXISTS idx_attendances_companion_date 
ON attendances(DATE(start_time), companion_checked);

-- 5. 確認用クエリ
-- 今日の同伴出勤者を確認
SELECT 
    user_email,
    start_time,
    end_time,
    companion_checked
FROM attendances 
WHERE DATE(start_time) = CURRENT_DATE 
    AND companion_checked = true
ORDER BY start_time DESC;

-- 6. 同伴出勤の統計確認
SELECT 
    DATE(start_time) as date,
    COUNT(*) as total_attendances,
    COUNT(CASE WHEN companion_checked = true THEN 1 END) as companion_attendances
FROM attendances 
WHERE start_time >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(start_time)
ORDER BY date DESC;