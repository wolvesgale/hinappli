-- Fix RLS policies for user_roles table to avoid infinite recursion
-- The current policies cause 500 errors because they reference the same table they're protecting

-- First, disable RLS temporarily to clean up
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on user_roles
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
DROP POLICY IF EXISTS "Owners can view all user roles" ON user_roles;
DROP POLICY IF EXISTS "Owners can manage user roles" ON user_roles;
DROP POLICY IF EXISTS "Service role can read all user roles" ON user_roles;
DROP POLICY IF EXISTS "Service role can manage user roles" ON user_roles;

-- Re-enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive policies
-- Allow authenticated users to read their own role (no recursion)
CREATE POLICY "authenticated_users_own_role" ON user_roles
    FOR SELECT USING (auth.jwt() ->> 'email' = email);

-- Allow service role to do everything (for admin operations)
CREATE POLICY "service_role_full_access" ON user_roles
    FOR ALL USING (auth.role() = 'service_role');

-- For owner operations, we'll handle this in application logic
-- instead of using RLS policies that cause recursion