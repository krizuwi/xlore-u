ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL,
  ADD COLUMN google_subject varchar(255),
  ADD COLUMN password_reset_code_hash char(64),
  ADD COLUMN password_reset_expires_at timestamptz;

CREATE UNIQUE INDEX idx_users_google_subject
  ON users (google_subject)
  WHERE google_subject IS NOT NULL;
