-- 出勤時写真機能のためのスキーマ修正
-- attendancesテーブルにphoto_urlカラムを追加し、ストレージバケットを設定

-- 1. attendancesテーブルにphoto_urlカラムを追加
ALTER TABLE attendances 
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 2. 出勤時写真用のストレージバケットを作成
INSERT INTO storage.buckets (id, name, public) 
VALUES ('attendance-photos', 'attendance-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. ストレージポリシーの設定
-- 認証済みユーザーが写真をアップロード可能
CREATE POLICY IF NOT EXISTS "Allow authenticated users to upload attendance photos" 
ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'attendance-photos' 
  AND auth.role() = 'authenticated'
);

-- 4. 認証済みユーザーが写真を閲覧可能
CREATE POLICY IF NOT EXISTS "Allow authenticated users to view attendance photos" 
ON storage.objects
FOR SELECT USING (
  bucket_id = 'attendance-photos' 
  AND auth.role() = 'authenticated'
);

-- 5. オーナーが写真を削除可能
CREATE POLICY IF NOT EXISTS "Allow owners to delete attendance photos" 
ON storage.objects
FOR DELETE USING (
  bucket_id = 'attendance-photos' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE email = auth.jwt() ->> 'email' 
    AND role = 'owner'
  )
);

-- 6. photo_url用のインデックスを追加（検索高速化のため）
CREATE INDEX IF NOT EXISTS idx_attendances_photo_url 
ON attendances(photo_url) 
WHERE photo_url IS NOT NULL;

-- 7. 確認用クエリ: テーブル構造の確認
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'attendances' 
AND column_name = 'photo_url';

-- 8. 確認用クエリ: ストレージバケットの確認
SELECT id, name, public 
FROM storage.buckets 
WHERE id = 'attendance-photos';