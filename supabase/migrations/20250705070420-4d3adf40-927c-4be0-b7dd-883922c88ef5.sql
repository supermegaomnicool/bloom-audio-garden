-- Add unique constraint on channel URLs to prevent duplicates
ALTER TABLE public.channels 
ADD CONSTRAINT channels_url_user_id_unique 
UNIQUE (url, user_id);