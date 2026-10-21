-- Existing accounts remain students. Only the dedicated registration flow creates institution accounts.
ALTER TABLE users ADD COLUMN account_type varchar(20) NOT NULL DEFAULT 'student'
  CHECK (account_type IN ('student', 'institution'));

CREATE TABLE institution_applications (
  application_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(user_id),
  school_id uuid REFERENCES schools(school_id),
  proposed_school jsonb,
  representative_title varchar(120) NOT NULL,
  contact_phone varchar(50) NOT NULL,
  verification_url varchar(2000) NOT NULL,
  verification_note varchar(2000) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  review_note varchar(2000) NOT NULL DEFAULT '',
  reviewed_by uuid REFERENCES users(user_id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (school_id IS NOT NULL OR proposed_school IS NOT NULL),
  CHECK (status NOT IN ('approved', 'suspended') OR school_id IS NOT NULL)
);
-- One institution identity per school; suspension must not free its ownership claim.
CREATE UNIQUE INDEX institution_school_owner ON institution_applications(school_id)
  WHERE status IN ('approved', 'suspended');
CREATE INDEX institution_application_queue ON institution_applications(status, created_at);

ALTER TABLE programs ADD COLUMN managed_by_school_id uuid REFERENCES schools(school_id);
ALTER TABLE school_programs ADD COLUMN institution_details jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE school_posts (
  post_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(school_id),
  author_id uuid NOT NULL REFERENCES users(user_id),
  title varchar(180) NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
  link_url varchar(2000),
  images jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(images) = 'array' AND jsonb_array_length(images) <= 6),
  status varchar(20) NOT NULL CHECK (status IN ('draft', 'published', 'deleted')),
  hidden_by_admin boolean NOT NULL DEFAULT false,
  moderation_note varchar(1000) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX school_posts_feed ON school_posts(school_id, created_at DESC, post_id);
CREATE TABLE school_post_likes (
  post_id uuid NOT NULL REFERENCES school_posts(post_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE school_post_comments (
  comment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES school_posts(post_id),
  user_id uuid NOT NULL REFERENCES users(user_id),
  body varchar(2000) NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  deleted boolean NOT NULL DEFAULT false,
  hidden_by_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX school_post_comments_feed ON school_post_comments(post_id, created_at, comment_id);
ALTER TABLE institution_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_post_comments ENABLE ROW LEVEL SECURITY;
