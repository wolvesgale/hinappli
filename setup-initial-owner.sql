-- 初期オーナーユーザーの設定
-- このファイルを実行して、最初のオーナーユーザーを設定してください

-- 例: 初期オーナーユーザーを追加
-- 以下のメールアドレスを実際のオーナーのメールアドレスに変更してください
INSERT INTO user_roles (email, display_name, role) 
VALUES ('owner@example.com', 'システム管理者', 'owner')
ON CONFLICT (email) DO UPDATE SET 
    role = 'owner',
    display_name = EXCLUDED.display_name;

-- 使用方法:
-- 1. 'owner@example.com' を実際のオーナーのメールアドレスに変更
-- 2. 'システム管理者' を実際の表示名に変更
-- 3. Supabaseのダッシュボードでこのクエリを実行