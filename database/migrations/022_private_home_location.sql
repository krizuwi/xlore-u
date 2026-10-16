-- Optional, user-confirmed location. Never infer an exact home from city text.
ALTER TABLE users ADD COLUMN home_location jsonb
  CHECK (home_location IS NULL OR (
    jsonb_typeof(home_location) = 'object'
    AND home_location ?& ARRAY['latitude', 'longitude', 'address']
    AND jsonb_typeof(home_location->'latitude') = 'number'
    AND jsonb_typeof(home_location->'longitude') = 'number'
    AND jsonb_typeof(home_location->'address') = 'string'
    AND (home_location->>'latitude')::numeric BETWEEN -90 AND 90
    AND (home_location->>'longitude')::numeric BETWEEN -180 AND 180
  ));

COMMENT ON COLUMN users.home_location IS
  'Private optional home pin confirmed by the account holder; address snapshot invalidates stale pins. No geocoding or location tracking.';
