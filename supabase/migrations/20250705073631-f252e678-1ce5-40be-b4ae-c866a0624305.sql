-- Delete duplicate channels, keeping only the oldest one
DELETE FROM episodes WHERE channel_id IN (
  '8ef9e202-1029-47a1-a30f-1212c86ed28f',
  '521c6204-f9b4-41d9-b38e-99fa64df6aaf', 
  'f0ee53ca-0d14-4c1f-a631-01cfa39d2568',
  '52d174e7-1b59-4da3-9c58-2bed324b5d97'
);

DELETE FROM channels WHERE id IN (
  '8ef9e202-1029-47a1-a30f-1212c86ed28f',
  '521c6204-f9b4-41d9-b38e-99fa64df6aaf', 
  'f0ee53ca-0d14-4c1f-a631-01cfa39d2568',
  '52d174e7-1b59-4da3-9c58-2bed324b5d97'
);

-- Now add the unique constraint to prevent future duplicates
ALTER TABLE channels ADD CONSTRAINT channels_user_url_unique UNIQUE (user_id, url);