CREATE TABLE user_school_visits (
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  visit_count integer NOT NULL DEFAULT 1 CHECK (visit_count > 0),
  first_visited_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_visited_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, school_id)
);

CREATE INDEX idx_user_school_visits_popular
  ON user_school_visits (user_id, visit_count DESC, last_visited_at DESC);

ALTER TABLE user_school_visits ENABLE ROW LEVEL SECURITY;
