ALTER TABLE schools
  ADD COLUMN official_website_url text,
  ADD COLUMN description text,
  ADD COLUMN catalog_last_checked_at timestamptz,
  ADD COLUMN catalog_last_updated_at timestamptz;

ALTER TABLE programs
  ADD COLUMN source_url text,
  ADD COLUMN last_verified_at timestamptz,
  ADD COLUMN created_from_scrape boolean NOT NULL DEFAULT false;

ALTER TABLE school_programs
  ALTER COLUMN tuition_per_semester DROP NOT NULL,
  ADD COLUMN source_url text,
  ADD COLUMN last_verified_at timestamptz;

CREATE TABLE program_aliases (
  program_alias_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(program_id) ON DELETE CASCADE,
  alias varchar(190) NOT NULL,
  normalized_alias varchar(190) NOT NULL UNIQUE
);
CREATE INDEX idx_program_aliases_program ON program_aliases (program_id);

CREATE TABLE catalog_sources (
  source_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  source_type varchar(30) NOT NULL CHECK (source_type IN ('school_profile', 'program_catalog')),
  source_url text NOT NULL,
  allowed_host varchar(255) NOT NULL,
  parser_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  interval_hours integer NOT NULL DEFAULT 168 CHECK (interval_hours BETWEEN 1 AND 8760),
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_content_hash varchar(64),
  last_status varchar(30),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (school_id, source_type, source_url)
);
CREATE INDEX idx_catalog_sources_due ON catalog_sources (enabled, last_checked_at);

CREATE TABLE catalog_update_runs (
  run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type varchar(20) NOT NULL CHECK (trigger_type IN ('manual', 'scheduled')),
  status varchar(20) NOT NULL CHECK (status IN ('running', 'completed', 'partial', 'failed')),
  sources_checked integer NOT NULL DEFAULT 0,
  sources_succeeded integer NOT NULL DEFAULT 0,
  records_discovered integer NOT NULL DEFAULT 0,
  records_changed integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at timestamptz,
  error_summary text
);

CREATE TABLE catalog_change_log (
  change_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES catalog_update_runs(run_id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES catalog_sources(source_id) ON DELETE CASCADE,
  entity_type varchar(30) NOT NULL,
  entity_id uuid,
  action varchar(30) NOT NULL,
  field_name varchar(80),
  old_value jsonb,
  new_value jsonb,
  source_url text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_catalog_change_log_run ON catalog_change_log (run_id, changed_at);

ALTER TABLE program_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_update_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_change_log ENABLE ROW LEVEL SECURITY;

INSERT INTO program_aliases (program_id, alias, normalized_alias)
SELECT program_id, alias, regexp_replace(lower(alias), '[^a-z0-9]+', ' ', 'g')
FROM programs
CROSS JOIN LATERAL unnest(CASE program_name
  WHEN 'BS Information Technology' THEN ARRAY['BS Information Technology', 'Bachelor of Science in Information Technology', 'Information Technology']
  WHEN 'BS Computer Science' THEN ARRAY['BS Computer Science', 'Bachelor of Science in Computer Science', 'Computer Science']
  WHEN 'BS Business Administration' THEN ARRAY['BS Business Administration', 'Bachelor of Science in Business Administration', 'Business Administration']
  WHEN 'BS Accountancy' THEN ARRAY['BS Accountancy', 'Bachelor of Science in Accountancy', 'Accountancy']
  WHEN 'BS Nursing' THEN ARRAY['BS Nursing', 'Bachelor of Science in Nursing', 'Nursing']
  WHEN 'BS Psychology' THEN ARRAY['BS Psychology', 'Bachelor of Science in Psychology', 'Psychology']
  WHEN 'BA Communication' THEN ARRAY['BA Communication', 'Bachelor of Arts in Communication', 'Communication']
  WHEN 'BS Architecture' THEN ARRAY['BS Architecture', 'Bachelor of Science in Architecture', 'Architecture']
  ELSE ARRAY[program_name]
END) AS aliases(alias)
ON CONFLICT (normalized_alias) DO NOTHING;

INSERT INTO catalog_sources
  (source_id, school_id, source_type, source_url, allowed_host, parser_config, interval_hours)
VALUES
('71000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','school_profile','https://upd.edu.ph/','upd.edu.ph','{}',168),
('71000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','school_profile','https://www.pup.edu.ph/','pup.edu.ph','{}',168),
('71000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000003','school_profile','https://plm.edu.ph/','plm.edu.ph','{}',168),
('71000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000004','school_profile','https://www.tup.edu.ph/','tup.edu.ph','{}',168),
('71000000-0000-4000-8000-000000000005','40000000-0000-4000-8000-000000000005','school_profile','https://www.ust.edu.ph/','ust.edu.ph','{}',168),
('71000000-0000-4000-8000-000000000006','40000000-0000-4000-8000-000000000006','school_profile','https://www.dlsu.edu.ph/','dlsu.edu.ph','{}',168),
('71000000-0000-4000-8000-000000000007','40000000-0000-4000-8000-000000000007','school_profile','https://www.ateneo.edu/','ateneo.edu','{}',168),
('71000000-0000-4000-8000-000000000008','40000000-0000-4000-8000-000000000008','school_profile','https://www.mapua.edu.ph/','mapua.edu.ph','{}',168),
('72000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','program_catalog','https://upd.edu.ph/academics/undergraduate/','upd.edu.ph','{"itemSelector":"main h1, main h2, main h3, main h4, main h5, main h6, main li, main td"}',168),
('72000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','program_catalog','https://www.pup.edu.ph/academic/programs','pup.edu.ph','{"itemSelector":"main h1, main h2, main h3, main h4, main h5, main h6, main li, main td"}',168),
('72000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000004','program_catalog','https://tup.edu.ph/undergraduate/admission/undergraduate-programs','tup.edu.ph','{"itemSelector":"main h1, main h2, main h3, main h4, main h5, main h6, main li, main td"}',168),
('72000000-0000-4000-8000-000000000005','40000000-0000-4000-8000-000000000005','program_catalog','https://www.ust.edu.ph/academics/programs/','ust.edu.ph','{"itemSelector":"main h1, main h2, main h3, main h4, main h5, main h6, main li, main td"}',168),
('72000000-0000-4000-8000-000000000006','40000000-0000-4000-8000-000000000006','program_catalog','https://old.dlsu.edu.ph/admissions/undergraduate/degree-programs/','dlsu.edu.ph','{"itemSelector":"main h1, main h2, main h3, main h4, main h5, main h6, main li, main td"}',168),
('72000000-0000-4000-8000-000000000008','40000000-0000-4000-8000-000000000008','program_catalog','https://support.mapua.edu.ph/kb/section/12','mapua.edu.ph','{"itemSelector":"main h1, main h2, main h3, main h4, main h5, main h6, main li, main td, article a"}',168)
ON CONFLICT (school_id, source_type, source_url) DO UPDATE SET
  allowed_host = EXCLUDED.allowed_host,
  parser_config = EXCLUDED.parser_config,
  interval_hours = EXCLUDED.interval_hours,
  enabled = true,
  updated_at = CURRENT_TIMESTAMP;
