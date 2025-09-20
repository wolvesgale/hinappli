-- attendancesテーブルにphoto_urlカラムを追加
ALTER TABLE attendances 
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 出勤時写真用のストレージバケットを作成
INSERT INTO storage.buckets (id, name, public) 
VALUES ('attendance-photos', 'attendance-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "Allow authenticated users to upload attendance photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view attendance photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow owners to delete attendance photos" ON storage.objects;

-- ストレージポリシーの設定
-- 認証済みユーザーが写真をアップロード可能
CREATE POLICY "Allow authenticated users to upload attendance photos" 
ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'attendance-photos' 
  AND auth.role() = 'authenticated'
);

-- 認証済みユーザーが写真を閲覧可能
CREATE POLICY "Allow authenticated users to view attendance photos" 
ON storage.objects
FOR SELECT USING (
  bucket_id = 'attendance-photos' 
  AND auth.role() = 'authenticated'
);

-- オーナーが写真を削除可能
CREATE POLICY "Allow owners to delete attendance photos" 
ON storage.objects
FOR DELETE USING (
  bucket_id = 'attendance-photos' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE email = auth.jwt() ->> 'email' 
    AND role = 'owner'
  )
);

-- photo_url用のインデックスを追加（検索高速化のため）
CREATE INDEX IF NOT EXISTS idx_attendances_photo_url 
ON attendances(photo_url)
WHERE photo_url IS NOT NULL;