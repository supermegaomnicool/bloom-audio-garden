-- Add saved_suggestions field to episode_suggestions table
ALTER TABLE public.episode_suggestions 
ADD COLUMN saved_suggestions integer[] DEFAULT ARRAY[]::integer[];