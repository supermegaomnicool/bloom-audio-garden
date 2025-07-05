-- Temporary policy to allow episode creation during development
-- This should be removed once authentication is implemented
CREATE POLICY "Allow temporary episode creation during development" 
ON public.episodes 
FOR INSERT 
WITH CHECK (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

-- Also allow viewing episodes created with temp user_id
CREATE POLICY "Allow viewing temp episodes during development" 
ON public.episodes 
FOR SELECT 
USING (user_id = '00000000-0000-0000-0000-000000000000'::uuid);