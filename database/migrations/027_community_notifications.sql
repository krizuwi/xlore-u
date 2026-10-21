-- Account-scoped in-app activity only. No email, push subscriptions or copied comment text.
CREATE TABLE community_notifications (
  notification_id bigserial PRIMARY KEY,
  recipient_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES school_posts(post_id) ON DELETE CASCADE,
  comment_id uuid REFERENCES school_post_comments(comment_id) ON DELETE CASCADE,
  kind varchar(10) NOT NULL CHECK (kind IN ('like', 'comment', 'reply')),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at timestamptz,
  CHECK (recipient_id <> actor_id),
  CHECK ((kind = 'like' AND comment_id IS NULL) OR (kind <> 'like' AND comment_id IS NOT NULL))
);
CREATE UNIQUE INDEX community_like_notice_once ON community_notifications(recipient_id, actor_id, post_id) WHERE kind = 'like';
CREATE UNIQUE INDEX community_comment_notice_once ON community_notifications(recipient_id, comment_id) WHERE comment_id IS NOT NULL;
CREATE INDEX community_notification_inbox ON community_notifications(recipient_id, notification_id DESC);
ALTER TABLE community_notifications ENABLE ROW LEVEL SECURITY;
