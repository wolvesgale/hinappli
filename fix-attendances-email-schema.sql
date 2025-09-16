-- attendances テーブルの根本的修正
-- user_email カラム追加 + RLS ポリシー修正

-- 1) attendances に user_email を追加（無ければ）
ALTER TABLE public.attendances 
  ADD COLUMN IF NOT EXISTS user_email TEXT;

-- 2) 既存行の埋め（可能な範囲で）
-- 注意: user_id と email の直接的な関連付けが困難なため、
-- 新しい打刻から user_email を設定していく方針

-- 3) RLS ポリシーの再設定
-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Users can view their own attendances" ON public.attendances;
DROP POLICY IF EXISTS "Users can insert their own attendances" ON public.attendances;
DROP POLICY IF EXISTS "Users can update their own attendances" ON public.attendances;
DROP POLICY IF EXISTS "Owners can view all attendances" ON public.attendances;

-- 新しいポリシーを作成
-- オーナーは全件閲覧可能
CREATE POLICY "attendances_owner_select_all" 
ON public.attendances 
FOR SELECT TO authenticated 
USING ( 
  EXISTS ( 
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.email = auth.jwt() ->> 'email'
      AND ur.role = 'owner' 
  ) 
);

-- 一般ユーザーは自分の行のみ閲覧可能
CREATE POLICY "attendances_self_select" 
ON public.attendances 
FOR SELECT TO authenticated 
USING (user_email = auth.jwt() ->> 'email');

-- 挿入は認証済みユーザーのみ（自分のemailで）
CREATE POLICY "attendances_insert_own" 
ON public.attendances 
FOR INSERT TO authenticated 
WITH CHECK (user_email = auth.jwt() ->> 'email');

-- 更新は自分の記録のみ
CREATE POLICY "attendances_update_own" 
ON public.attendances 
FOR UPDATE TO authenticated 
USING (user_email = auth.jwt() ->> 'email');

-- インデックスを追加（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_attendances_user_email ON public.attendances(user_email);
CREATE INDEX IF NOT EXISTS idx_attendances_end_time_null ON public.attendances(user_email) WHERE end_time IS NULL;

-- 確認用クエリ（実行後に確認）
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'attendances' AND table_schema = 'public';