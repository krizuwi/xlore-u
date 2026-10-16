-- Match the catalog source schema used by the deployed database. Source names
-- are required when adding a source from the Automation module.
ALTER TABLE catalog_sources ADD COLUMN IF NOT EXISTS name varchar(190);

UPDATE catalog_sources SET name = CASE source_type
  WHEN 'school_profile' THEN 'School profile'
  ELSE 'Program catalog'
END WHERE name IS NULL OR btrim(name) = '';

ALTER TABLE catalog_sources ALTER COLUMN name SET NOT NULL;
