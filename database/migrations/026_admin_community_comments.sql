-- Preserve all existing comments/replies; only new authenticated admin writes set this flag.
ALTER TABLE school_post_comments
  ADD COLUMN author_is_admin boolean NOT NULL DEFAULT FALSE,
  DROP CONSTRAINT school_reply_identity,
  ADD CONSTRAINT school_reply_identity CHECK (
    (author_is_admin = TRUE AND author_school_id IS NULL AND
      (parent_comment_id IS NULL OR parent_comment_id <> comment_id)) OR
    (author_is_admin = FALSE AND (
      (parent_comment_id IS NULL AND author_school_id IS NULL) OR
      (parent_comment_id IS NOT NULL AND author_school_id IS NOT NULL AND parent_comment_id <> comment_id)
    ))
  );
-- The existing same-post parent foreign key and RLS remain unchanged.
