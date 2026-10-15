ALTER TABLE catalog_update_runs
  ADD COLUMN scraping_mode varchar(10) NOT NULL DEFAULT 'standard'
  CHECK (scraping_mode IN ('standard', 'ai', 'hybrid'));

CREATE TABLE catalog_run_source_results (
  run_id uuid NOT NULL REFERENCES catalog_update_runs(run_id) ON DELETE CASCADE,
  source_id uuid NOT NULL,
  school_name text NOT NULL,
  source_type varchar(30) NOT NULL,
  source_url text NOT NULL,
  status varchar(20) NOT NULL CHECK (status IN ('success', 'unchanged', 'failed')),
  records_discovered integer NOT NULL DEFAULT 0,
  records_changed integer NOT NULL DEFAULT 0,
  returned_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  started_at timestamptz NOT NULL,
  finished_at timestamptz NOT NULL,
  PRIMARY KEY (run_id, source_id)
);

CREATE INDEX idx_catalog_run_source_results_run
  ON catalog_run_source_results (run_id, started_at);

ALTER TABLE catalog_run_source_results ENABLE ROW LEVEL SECURITY;
