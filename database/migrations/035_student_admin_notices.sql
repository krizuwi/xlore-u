ALTER TABLE community_notifications DROP CONSTRAINT community_notice_shape;
ALTER TABLE community_notifications ADD CONSTRAINT community_notice_shape CHECK (
  (kind = 'like' AND post_id IS NOT NULL AND comment_id IS NULL AND reason IS NULL AND application_id IS NULL AND contact_reply_id IS NULL) OR
  (kind IN ('comment', 'reply') AND post_id IS NOT NULL AND comment_id IS NOT NULL AND reason IS NULL AND application_id IS NULL AND contact_reply_id IS NULL) OR
  (kind IN ('post_hidden', 'post_restored') AND post_id IS NOT NULL AND comment_id IS NULL AND application_id IS NULL AND reason IS NOT NULL AND length(trim(reason)) > 0 AND contact_reply_id IS NULL) OR
  (kind IN ('comment_hidden', 'comment_restored') AND post_id IS NOT NULL AND comment_id IS NOT NULL AND application_id IS NULL AND reason IS NOT NULL AND length(trim(reason)) > 0 AND contact_reply_id IS NULL) OR
  (kind = 'institution_suspended' AND post_id IS NULL AND comment_id IS NULL AND application_id IS NOT NULL AND reason IS NOT NULL AND length(trim(reason)) > 0 AND contact_reply_id IS NULL) OR
  (kind = 'contact_reply' AND post_id IS NULL AND comment_id IS NULL AND application_id IS NULL AND reason IS NULL AND contact_reply_id IS NOT NULL) OR
  (kind IN ('assessment_reset', 'student_suspended') AND post_id IS NULL AND comment_id IS NULL AND application_id IS NULL AND contact_reply_id IS NULL AND reason IS NOT NULL AND length(trim(reason)) > 0)
);

CREATE TABLE assessment_reset_notice_emails (
  notification_id bigint PRIMARY KEY REFERENCES community_notifications(notification_id) ON DELETE CASCADE,
  state varchar(12) NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'sending', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  lease_token uuid,
  lease_until timestamptz,
  sent_at timestamptz
);
ALTER TABLE assessment_reset_notice_emails ENABLE ROW LEVEL SECURITY;
CREATE INDEX student_reset_notices ON community_notifications(recipient_id, notification_id DESC) WHERE kind = 'assessment_reset';
