CREATE TABLE user_feedback (
  feedback_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  release_id varchar(80) NOT NULL,
  section varchar(20) NOT NULL CHECK (section IN ('assessment', 'comparison', 'map', 'school')),
  school_id uuid REFERENCES schools(school_id),
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment varchar(1000) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, release_id, section),
  CHECK ((section = 'school' AND school_id IS NOT NULL) OR (section <> 'school' AND school_id IS NULL))
);
CREATE INDEX idx_user_feedback_created ON user_feedback (created_at DESC, feedback_id);
CREATE INDEX idx_user_feedback_release_section ON user_feedback (release_id, section);
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
