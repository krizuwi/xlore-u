-- A school may be approved before its representative adds a precise campus pin.
-- NULL means unknown; never manufacture a location such as (0, 0).
ALTER TABLE schools ALTER COLUMN latitude DROP NOT NULL;
ALTER TABLE schools ALTER COLUMN longitude DROP NOT NULL;
ALTER TABLE schools ADD CONSTRAINT school_coordinate_pair
  CHECK ((latitude IS NULL) = (longitude IS NULL));
