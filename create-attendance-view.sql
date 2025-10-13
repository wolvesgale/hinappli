-- Create unique constraint on user_roles.email if it does not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_roles_email_unique'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_email_unique UNIQUE (email);
  END IF;
END $$;

-- Create a view that always surfaces a display name for attendances
CREATE OR REPLACE VIEW public.v_attendances_with_roles AS
SELECT
  a.id,
  a.user_id,
  a.user_email,
  COALESCE(ur.display_name, a.user_email) AS display_name_raw,
  a.start_time,
  a.end_time,
  a.companion_checked,
  a.created_at
FROM public.attendances a
LEFT JOIN public.user_roles ur
  ON ur.email = a.user_email;

GRANT SELECT ON public.v_attendances_with_roles TO authenticated;

-- Helpful index for looking up attendance rows by email/date
CREATE INDEX IF NOT EXISTS idx_att_email_time ON public.attendances(user_email, start_time);
