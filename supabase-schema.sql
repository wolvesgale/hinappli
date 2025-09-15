-- Supabase Database Schema for hinappli
-- ガールズバー向け管理システム

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for app roles
CREATE TYPE app_role AS ENUM ('owner', 'cast', 'driver');

-- Access requests table
CREATE TABLE access_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    requested_role app_role DEFAULT 'cast',
    status VARCHAR(50) DEFAULT 'pending',
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_by VARCHAR(255),
    approved_at TIMESTAMP WITH TIME ZONE
);

-- User roles table
CREATE TABLE user_roles (
    email VARCHAR(255) PRIMARY KEY,
    display_name VARCHAR(255) NOT NULL,
    role app_role DEFAULT 'cast',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Register sessions table
CREATE TABLE register_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    biz_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL,
    open_photo_url TEXT,
    close_photo_url TEXT,
    close_amount DECIMAL(10,2),
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    biz_date DATE NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    memo TEXT,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attendances table
CREATE TABLE attendances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_access_requests_status ON access_requests(status);
CREATE INDEX idx_access_requests_email ON access_requests(email);
CREATE INDEX idx_user_roles_role ON user_roles(role);
CREATE INDEX idx_transactions_biz_date ON transactions(biz_date);
CREATE INDEX idx_transactions_created_by ON transactions(created_by);
CREATE INDEX idx_attendances_user_id ON attendances(user_id);
CREATE INDEX idx_attendances_start_time ON attendances(start_time);

-- Row Level Security (RLS) policies
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE register_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;

-- Policies for access_requests
CREATE POLICY "Anyone can insert access requests" ON access_requests
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their own access requests" ON access_requests
    FOR SELECT USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "Owners can view all access requests" ON access_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE email = auth.jwt() ->> 'email' 
            AND role = 'owner'
        )
    );

CREATE POLICY "Owners can update access requests" ON access_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE email = auth.jwt() ->> 'email' 
            AND role = 'owner'
        )
    );

-- Policies for user_roles
CREATE POLICY "Users can view their own role" ON user_roles
    FOR SELECT USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "Owners can view all user roles" ON user_roles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.email = auth.jwt() ->> 'email' 
            AND ur.role = 'owner'
        )
    );

CREATE POLICY "Owners can manage user roles" ON user_roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.email = auth.jwt() ->> 'email' 
            AND ur.role = 'owner'
        )
    );

-- Policies for transactions
CREATE POLICY "Authenticated users can view transactions" ON transactions
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert transactions" ON transactions
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policies for attendances
CREATE POLICY "Users can view their own attendances" ON attendances
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own attendances" ON attendances
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own attendances" ON attendances
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Owners can view all attendances" ON attendances
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE email = auth.jwt() ->> 'email' 
            AND role = 'owner'
        )
    );

-- Policies for register_sessions
CREATE POLICY "Authenticated users can view register sessions" ON register_sessions
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert register sessions" ON register_sessions
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Owners can manage register sessions" ON register_sessions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE email = auth.jwt() ->> 'email' 
            AND role = 'owner'
        )
    );