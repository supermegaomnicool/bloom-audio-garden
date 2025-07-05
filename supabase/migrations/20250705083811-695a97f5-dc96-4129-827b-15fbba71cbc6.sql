-- Add policy to allow updating temporary episodes during development
CREATE POLICY "Allow updating temp episodes during development" 
ON public.episodes 
FOR UPDATE 
USING (user_id = '00000000-0000-0000-0000-000000000000'::uuid);