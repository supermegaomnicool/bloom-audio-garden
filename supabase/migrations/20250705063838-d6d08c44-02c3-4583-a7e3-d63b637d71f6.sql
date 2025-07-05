-- Add user notes field to channels table
ALTER TABLE public.channels 
ADD COLUMN user_notes TEXT;