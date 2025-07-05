-- Delete episodes for the last remaining channel
DELETE FROM episodes WHERE channel_id = '4c320e6c-7c5f-4794-8bfb-c8a201880f6a';

-- Delete the last remaining channel
DELETE FROM channels WHERE id = '4c320e6c-7c5f-4794-8bfb-c8a201880f6a';