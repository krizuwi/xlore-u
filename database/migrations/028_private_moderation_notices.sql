-- Keep existing activity and read states. Reasons are private to the affected account.
ALTER TABLE school_post_comments ADD COLUMN moderation_note varchar(1000) NOT NULL DEFAULT '';
ALTER TABLE community_notifications
  ALTER COLUMN post_id DROP NOT NULL,
  ALTER COLUMN kind TYPE varchar(32),
  ADD COLUMN reason varchar(2000),
  ADD COLUMN context_title varchar(190),
  ADD COLUMN context_school varchar(190),
  ADD COLUMN application_id uuid REFERENCES institution_applications(application_id);

-- 027 used generated names for kind/shape checks; retain every unrelated FK/check.
DO $$ DECLARE constraint_row record; BEGIN
  FOR constraint_row IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'community_notifications'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%kind%'
  LOOP EXECUTE format('ALTER TABLE community_notifications DROP CONSTRAINT %I', constraint_row.conname); END LOOP;
END $$;
ALTER TABLE community_notifications ADD CONSTRAINT community_notice_shape CHECK (
  (kind = 'like' AND post_id IS NOT NULL AND comment_id IS NULL AND reason IS NULL AND application_id IS NULL) OR
  (kind IN ('comment', 'reply') AND post_id IS NOT NULL AND comment_id IS NOT NULL AND reason IS NULL AND application_id IS NULL) OR
  (kind IN ('post_hidden', 'post_restored') AND post_id IS NOT NULL AND comment_id IS NULL AND application_id IS NULL AND reason IS NOT NULL AND length(trim(reason)) > 0) OR
  (kind IN ('comment_hidden', 'comment_restored') AND post_id IS NOT NULL AND comment_id IS NOT NULL AND application_id IS NULL AND reason IS NOT NULL AND length(trim(reason)) > 0) OR
  (kind = 'institution_suspended' AND post_id IS NULL AND comment_id IS NULL AND application_id IS NOT NULL AND reason IS NOT NULL AND length(trim(reason)) > 0)
);
DROP INDEX community_comment_notice_once;
CREATE UNIQUE INDEX community_comment_notice_once ON community_notifications(recipient_id, comment_id) WHERE kind IN ('comment', 'reply');

-- Persist email work in the suspension transaction. SMTP is attempted only after commit.
CREATE TABLE institution_notice_emails (
  notification_id bigint PRIMARY KEY REFERENCES community_notifications(notification_id) ON DELETE CASCADE,
  state varchar(12) NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  lease_token uuid,
  lease_until timestamptz,
  sent_at timestamptz,
  last_error_code varchar(64),
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE institution_notice_emails ENABLE ROW LEVEL SECURITY;
CREATE INDEX institution_suspension_notices ON community_notifications(application_id, notification_id DESC) WHERE kind = 'institution_suspended';
