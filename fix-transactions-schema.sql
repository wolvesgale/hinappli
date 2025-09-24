-- Fix transactions table schema by adding attributed_to_email column
-- This resolves the "Could not find the 'attributed_to_email' column" error

-- Add attributed_to_email field to transactions table
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS attributed_to_email TEXT;

-- Add comment to explain the field
COMMENT ON COLUMN public.transactions.attributed_to_email IS 'Email of the cast member this sale is attributed to';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_attributed_to_email 
ON public.transactions(attributed_to_email);

-- Update existing RLS policies if needed
-- Note: This assumes the table already has proper RLS policies for authenticated users