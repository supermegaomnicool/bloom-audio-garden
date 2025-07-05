-- Update the is_admin function to work without roles for now
-- Since you mentioned this is for your own use, we can enable roles later
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
BEGIN
  -- For now, return false since no role system is set up
  -- You can update this later when you add user roles
  RETURN false;
END;
$$;