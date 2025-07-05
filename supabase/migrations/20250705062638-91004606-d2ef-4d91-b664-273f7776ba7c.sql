-- Temporarily remove foreign key constraint for development
-- This should be re-added once authentication is implemented
ALTER TABLE public.channels DROP CONSTRAINT IF EXISTS channels_user_id_fkey;

-- Also remove foreign key constraint for episodes if it exists
ALTER TABLE public.episodes DROP CONSTRAINT IF EXISTS episodes_user_id_fkey;