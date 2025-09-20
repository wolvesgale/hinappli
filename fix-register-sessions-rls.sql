-- Fix register_sessions table RLS policies to allow update operations
-- Current issue: No UPDATE policy exists for register_sessions table

-- Add UPDATE policy for authenticated users
CREATE POLICY "Authenticated users can update register sessions" ON register_sessions
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Verify current policies
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'register_sessions'
ORDER BY policyname;