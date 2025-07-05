-- Add exclusion fields to episodes table
ALTER TABLE public.episodes 
ADD COLUMN excluded boolean DEFAULT false,
ADD COLUMN exclusion_notes text;