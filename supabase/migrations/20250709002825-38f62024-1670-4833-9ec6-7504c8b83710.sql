-- Update channels and episodes that were created with temporary user_id during development
-- This fixes the "channel not found" error when users try to access content

-- Update channels from temp user to actual user (based on current authenticated user in session)
-- Note: This is a temporary fix for development data. In production, channels should be created with proper user_id from the start.

-- Since we can't dynamically get the current user in a migration, we'll create a function to handle this
CREATE OR REPLACE FUNCTION fix_temp_user_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    temp_user_id uuid := '00000000-0000-0000-0000-000000000000';
    actual_user_id uuid;
BEGIN
    -- Get the most recent actual user (not the temp one)
    SELECT user_id INTO actual_user_id
    FROM profiles 
    WHERE user_id != temp_user_id 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    -- If we found an actual user, update the channels and episodes
    IF actual_user_id IS NOT NULL THEN
        -- Update channels
        UPDATE channels 
        SET user_id = actual_user_id 
        WHERE user_id = temp_user_id;
        
        -- Update episodes
        UPDATE episodes 
        SET user_id = actual_user_id 
        WHERE user_id = temp_user_id;
        
        -- Update content_ideas if any exist
        UPDATE content_ideas 
        SET user_id = actual_user_id 
        WHERE user_id = temp_user_id;
        
        -- Update episode_suggestions if any exist
        UPDATE episode_suggestions 
        SET user_id = actual_user_id 
        WHERE user_id = temp_user_id;
        
        RAISE NOTICE 'Updated data from temp user % to actual user %', temp_user_id, actual_user_id;
    ELSE
        RAISE NOTICE 'No actual user found to transfer data to';
    END IF;
END;
$$;

-- Execute the function
SELECT fix_temp_user_data();

-- Drop the function since it was only needed for this one-time fix
DROP FUNCTION fix_temp_user_data();