-- Private, current student self-reports. No existing account or enrollment is backfilled.
-- Invalidate old access tokens after a suspend/restore cycle, not just refresh sessions.
ALTER TABLE users ADD COLUMN auth_version integer NOT NULL DEFAULT 0 CHECK (auth_version >= 0);

CREATE TABLE student_enrollments (
  user_id uuid PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(school_id),
  city varchar(100) NOT NULL CHECK (length(trim(city)) BETWEEN 1 AND 100),
  used_xlore_u boolean NOT NULL CHECK (used_xlore_u = TRUE),
  helpful boolean NOT NULL CHECK (helpful = TRUE),
  declaration_version varchar(50) NOT NULL,
  reported_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX student_enrollment_school ON student_enrollments(school_id);
CREATE INDEX student_enrollment_city ON student_enrollments(lower(city));
ALTER TABLE student_enrollments ENABLE ROW LEVEL SECURITY;

-- Access decisions and retryable email work are committed together.
CREATE TABLE student_account_actions (
  action_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users(user_id) ON DELETE SET NULL,
  active boolean NOT NULL,
  reason varchar(2000) NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  email_state varchar(16) NOT NULL CHECK (email_state IN ('not_required', 'pending', 'sending', 'sent', 'failed', 'cancelled')),
  email_attempts integer NOT NULL DEFAULT 0 CHECK (email_attempts >= 0),
  lease_token uuid,
  lease_until timestamptz,
  email_sent_at timestamptz,
  email_error_code varchar(64)
);
CREATE INDEX student_account_actions_latest ON student_account_actions(user_id, action_id DESC);
CREATE INDEX completed_student_assessments ON assessments(user_id) WHERE completed_at IS NOT NULL;
ALTER TABLE student_account_actions ENABLE ROW LEVEL SECURITY;
