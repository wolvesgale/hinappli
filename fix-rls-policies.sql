-- Fix RLS policies for user_roles table to avoid circular reference
-- The current policies cause 500 errors because they reference the same table they're protecting

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
DROP POLICY IF EXISTS "Owners can view all user roles" ON user_roles;
DROP POLICY IF EXISTS "Owners can manage user roles" ON user_roles;

-- Create new policies that don't cause circular reference
-- Allow authenticated users to read their own role
CREATE POLICY "Users can view their own role" ON user_roles
    FOR SELECT USING (auth.jwt() ->> 'email' = email);

-- Allow service role (backend) to read all roles
CREATE POLICY "Service role can read all user roles" ON user_roles
    FOR SELECT USING (auth.role() = 'service_role');

-- Allow service role to manage all user roles
CREATE POLICY "Service role can manage user roles" ON user_roles
    FOR ALL USING (auth.role() = 'service_role');

-- For owner operations, we'll handle permissions in the application layer
-- instead of relying on RLS policies that cause circular references