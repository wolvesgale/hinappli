-- Add attributed_to_email field to transactions table for sales attribution
ALTER TABLE transactions 
ADD COLUMN attributed_to_email TEXT;

-- Add comment to explain the field
COMMENT ON COLUMN transactions.attributed_to_email IS 'Email of the cast member this sale is attributed to';

-- Create index for better query performance
CREATE INDEX idx_transactions_attributed_to_email ON transactions(attributed_to_email);

-- Update RLS policies to allow viewing attributed sales
CREATE POLICY "Users can view sales attributed to them" ON transactions
    FOR SELECT USING (
        attributed_to_email = auth.jwt() ->> 'email'
        OR auth.role() = 'authenticated'
    );