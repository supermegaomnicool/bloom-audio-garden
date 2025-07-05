-- Add unique constraint for episodes to prevent duplicates and enable upsert
ALTER TABLE public.episodes 
ADD CONSTRAINT episodes_external_id_channel_id_unique 
UNIQUE (external_id, channel_id);