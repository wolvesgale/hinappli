-- Supabase access_requests テーブル整合SQL（最終版）
-- 既存スキーマ: email, display_name, requested_role が NOT NULL
-- 目標: email必須 + note任意 + display_name/requested_role任意

-- 1) noteカラムを追加（存在しない場合のみ）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'access_requests'
      AND column_name = 'note'
  ) THEN
    ALTER TABLE public.access_requests ADD COLUMN note TEXT;
    RAISE NOTICE 'Added note column to access_requests table';
  ELSE
    RAISE NOTICE 'note column already exists in access_requests table';
  END IF;
END $$;

-- 2) display_nameのNOT NULL制約を解除
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'access_requests'
      AND column_name = 'display_name'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.access_requests ALTER COLUMN display_name DROP NOT NULL;
    RAISE NOTICE 'Removed NOT NULL constraint from display_name column';
  ELSE
    RAISE NOTICE 'display_name column is already nullable';
  END IF;
END $$;

-- 3) requested_roleのNOT NULL制約を解除（enum型の場合はDEFAULTも調整）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'access_requests'
      AND column_name = 'requested_role'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.access_requests ALTER COLUMN requested_role DROP NOT NULL;
    RAISE NOTICE 'Removed NOT NULL constraint from requested_role column';
  ELSE
    RAISE NOTICE 'requested_role column is already nullable';
  END IF;
END $$;

-- 4) RLS設定確認と匿名ユーザー用ポリシー追加
-- 既存のRLSは有効、既存ポリシーは保持しつつ、anon用を追加

-- 匿名ユーザーからのinsertを許可（既存ポリシーと重複しないよう確認）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'access_requests'
      AND policyname = 'access_requests_insert_by_anon'
  ) THEN
    EXECUTE 'CREATE POLICY "access_requests_insert_by_anon"
      ON public.access_requests
      FOR INSERT
      TO anon
      WITH CHECK (true)';
    RAISE NOTICE 'Created anon insert policy for access_requests';
  ELSE
    RAISE NOTICE 'anon insert policy already exists for access_requests';
  END IF;
END $$;

-- 認証済みユーザーからのselectを許可（管理画面用）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'access_requests'
      AND policyname = 'access_requests_select_by_authenticated'
  ) THEN
    EXECUTE 'CREATE POLICY "access_requests_select_by_authenticated"
      ON public.access_requests
      FOR SELECT
      TO authenticated
      USING (true)';
    RAISE NOTICE 'Created authenticated select policy for access_requests';
  ELSE
    RAISE NOTICE 'authenticated select policy already exists for access_requests';
  END IF;
END $$;