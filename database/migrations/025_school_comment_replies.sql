-- Additive: existing student comments remain root comments with NULL reply fields.
ALTER TABLE school_post_comments
  ADD COLUMN parent_comment_id uuid,
  ADD COLUMN author_school_id uuid REFERENCES schools(school_id),
  ADD CONSTRAINT school_comment_post_identity UNIQUE (comment_id, post_id),
  ADD CONSTRAINT school_reply_same_post FOREIGN KEY (parent_comment_id, post_id)
    REFERENCES school_post_comments(comment_id, post_id),
  ADD CONSTRAINT school_reply_identity CHECK (
    (parent_comment_id IS NULL AND author_school_id IS NULL) OR
    (parent_comment_id IS NOT NULL AND author_school_id IS NOT NULL AND parent_comment_id <> comment_id)
  );
CREATE INDEX school_comment_replies ON school_post_comments(parent_comment_id, created_at DESC, comment_id)
  WHERE parent_comment_id IS NOT NULL;
