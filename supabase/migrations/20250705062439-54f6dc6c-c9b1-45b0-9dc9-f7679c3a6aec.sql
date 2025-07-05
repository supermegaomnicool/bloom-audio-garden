-- Temporary policy to allow channel creation during development
-- This should be removed once authentication is implemented
CREATE POLICY "Allow temporary channel creation during development" 
ON public.channels 
FOR INSERT 
WITH CHECK (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

-- Also allow viewing channels created with temp user_id
CREATE POLICY "Allow viewing temp channels during development" 
ON public.channels 
FOR SELECT 
USING (user_id = '00000000-0000-0000-0000-000000000000'::uuid);