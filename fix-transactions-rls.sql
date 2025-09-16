-- Fix transactions table RLS policies to allow owner delete operations
-- Current issue: No DELETE policy exists for transactions table

-- Add DELETE policy for owners
CREATE POLICY "Owners can delete transactions" ON transactions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE email = auth.jwt() ->> 'email' 
            AND role = 'owner'
        )
    );

-- Add UPDATE policy for owners (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'transactions' 
        AND policyname = 'Owners can update transactions'
    ) THEN
        EXECUTE 'CREATE POLICY "Owners can update transactions" ON transactions
            FOR UPDATE USING (
                EXISTS (
                    SELECT 1 FROM user_roles 
                    WHERE email = auth.jwt() ->> ''email'' 
                    AND role = ''owner''
                )
            )';
    END IF;
END $$;

-- Verify current policies
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'transactions'
ORDER BY policyname;