-- Keep existing support requests. Replies are private to their owner and admin.
CREATE TABLE contact_replies (
  reply_id bigserial PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES contact_messages(message_id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  author_type varchar(16) NOT NULL CHECK (author_type IN ('admin', 'student', 'institution')),
  request_id uuid NOT NULL,
  body varchar(3000) NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 3000),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (message_id, author_id, request_id)
);
CREATE INDEX contact_replies_thread ON contact_replies(message_id, reply_id DESC);
CREATE INDEX contact_messages_owner_activity ON contact_messages(sender_id, updated_at DESC, message_id DESC);
ALTER TABLE contact_replies ENABLE ROW LEVEL SECURITY;

ALTER TABLE community_notifications ADD COLUMN contact_reply_id bigint REFERENCES contact_replies(reply_id) ON DELETE CASCADE;
ALTER TABLE community_notifications DROP CONSTRAINT community_notice_shape;
ALTER TABLE community_notifications ADD CONSTRAINT community_notice_shape CHECK (
  (kind = 'like' AND post_id IS NOT NULL AND comment_id IS NULL AND reason IS NULL AND application_id IS NULL AND contact_reply_id IS NULL) OR
  (kind IN ('comment', 'reply') AND post_id IS NOT NULL AND comment_id IS NOT NULL AND reason IS NULL AND application_id IS NULL AND contact_reply_id IS NULL) OR
  (kind IN ('post_hidden', 'post_restored') AND post_id IS NOT NULL AND comment_id IS NULL AND application_id IS NULL AND reason IS NOT NULL AND length(trim(reason)) > 0 AND contact_reply_id IS NULL) OR
  (kind IN ('comment_hidden', 'comment_restored') AND post_id IS NOT NULL AND comment_id IS NOT NULL AND application_id IS NULL AND reason IS NOT NULL AND length(trim(reason)) > 0 AND contact_reply_id IS NULL) OR
  (kind = 'institution_suspended' AND post_id IS NULL AND comment_id IS NULL AND application_id IS NOT NULL AND reason IS NOT NULL AND length(trim(reason)) > 0 AND contact_reply_id IS NULL) OR
  (kind = 'contact_reply' AND post_id IS NULL AND comment_id IS NULL AND application_id IS NULL AND reason IS NULL AND contact_reply_id IS NOT NULL)
);
CREATE UNIQUE INDEX contact_reply_notice_once ON community_notifications(recipient_id, contact_reply_id) WHERE kind = 'contact_reply';
