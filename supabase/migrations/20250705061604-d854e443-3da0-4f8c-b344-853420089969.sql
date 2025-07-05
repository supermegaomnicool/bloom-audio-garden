-- Create storage bucket for episode and show artwork
INSERT INTO storage.buckets (id, name, public)
VALUES ('episode-artwork', 'episode-artwork', true);

-- Create policies for artwork access
CREATE POLICY "Anyone can view artwork" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'episode-artwork');

CREATE POLICY "Users can upload artwork" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'episode-artwork');

CREATE POLICY "Users can update artwork" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'episode-artwork');

-- Add columns to channels table for show artwork
ALTER TABLE public.channels 
ADD COLUMN artwork_url TEXT,
ADD COLUMN artwork_storage_path TEXT;

-- Add columns to episodes table for episode-specific artwork
ALTER TABLE public.episodes 
ADD COLUMN artwork_url TEXT,
ADD COLUMN artwork_storage_path TEXT,
ADD COLUMN has_custom_artwork BOOLEAN DEFAULT false,
ADD COLUMN audio_url TEXT,
ADD COLUMN file_size BIGINT,
ADD COLUMN episode_number INTEGER,
ADD COLUMN season_number INTEGER;