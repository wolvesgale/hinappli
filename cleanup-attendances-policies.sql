-- attendancesテーブルのRLSポリシー完全クリーンアップ・再構築
-- 全ての既存ポリシーを削除し、統一された新しいポリシーを作成

-- ===== 既存ポリシーの完全削除 =====
-- 初期設定のポリシー
DROP POLICY IF EXISTS "Users can view their own attendances" ON public.attendances;
DROP POLICY IF EXISTS "Users can insert their own attendances" ON public.attendances;
DROP POLICY IF EXISTS "Users can update their own attendances" ON public.attendances;
DROP POLICY IF EXISTS "Owners can view all attendances" ON public.attendances;

-- 中間修正のポリシー
DROP POLICY IF EXISTS "attendances_owner_select_all" ON public.attendances;
DROP POLICY IF EXISTS "attendances_self_select" ON public.attendances;
DROP POLICY IF EXISTS "attendances_insert_own" ON public.attendances;
DROP POLICY IF EXISTS "attendances_update_own" ON public.attendances;

-- 最新修正のポリシー
DROP POLICY IF EXISTS "att_self_select" ON public.attendances;
DROP POLICY IF EXISTS "att_self_ins" ON public.attendances;
DROP POLICY IF EXISTS "att_self_upd" ON public.attendances;
DROP POLICY IF EXISTS "att_self_del" ON public.attendances;
DROP POLICY IF EXISTS "att_owner_select_all" ON public.attendances;
DROP POLICY IF EXISTS "att_owner_update_all" ON public.attendances;
DROP POLICY IF EXISTS "att_owner_delete_all" ON public.attendances;

-- その他の可能性のあるポリシー
DROP POLICY IF EXISTS "attendances_insert_own" ON public.attendances;
DROP POLICY IF EXISTS "attendances_owner_select_all" ON public.attendances;
DROP POLICY IF EXISTS "attendances_self_select" ON public.attendances;
DROP POLICY IF EXISTS "attendances_update_own" ON public.attendances;

-- ===== 統一された新しいポリシーの作成 =====
-- 命名規則: attendances_[role]_[action]

-- 1. 自分の出勤記録の閲覧
CREATE POLICY "attendances_user_select_own"
ON public.attendances 
FOR SELECT TO authenticated
USING (user_email = auth.email());

-- 2. 自分の出勤記録の挿入
CREATE POLICY "attendances_user_insert_own"
ON public.attendances 
FOR INSERT TO authenticated
WITH CHECK (user_email = auth.email());

-- 3. 自分の出勤記録の更新
CREATE POLICY "attendances_user_update_own"
ON public.attendances 
FOR UPDATE TO authenticated
USING (user_email = auth.email())
WITH CHECK (user_email = auth.email());

-- 4. 自分の出勤記録の削除
CREATE POLICY "attendances_user_delete_own"
ON public.attendances 
FOR DELETE TO authenticated
USING (user_email = auth.email());

-- 5. オーナーの全記録閲覧
CREATE POLICY "attendances_owner_select_all"
ON public.attendances 
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.email = auth.email() 
    AND ur.role = 'owner'
  )
);

-- 6. オーナーの全記録更新
CREATE POLICY "attendances_owner_update_all"
ON public.attendances 
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.email = auth.email() 
    AND ur.role = 'owner'
  )
)
WITH CHECK (true);

-- 7. オーナーの全記録削除
CREATE POLICY "attendances_owner_delete_all"
ON public.attendances 
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.email = auth.email() 
    AND ur.role = 'owner'
  )
);

-- ===== 確認用クエリ =====
-- 作成されたポリシーの確認
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'attendances' 
ORDER BY policyname;