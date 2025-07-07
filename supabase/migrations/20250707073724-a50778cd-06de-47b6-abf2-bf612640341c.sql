-- Update existing channels to belong to the current authenticated user instead of the temporary development user
UPDATE channels 
SET user_id = 'a3c994f3-d13c-4f12-9d3b-3d44a70f45d6'
WHERE user_id = '00000000-0000-0000-0000-000000000000';

-- Update existing episodes to belong to the current authenticated user instead of the temporary development user  
UPDATE episodes 
SET user_id = 'a3c994f3-d13c-4f12-9d3b-3d44a70f45d6'
WHERE user_id = '00000000-0000-0000-0000-000000000000';