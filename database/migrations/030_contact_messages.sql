-- Private support requests, accessible only through the authenticated server API.
CREATE TABLE contact_messages (
  message_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  sender_type varchar(16) NOT NULL CHECK (sender_type IN ('student', 'institution')),
  contact_name varchar(100) NOT NULL CHECK (length(trim(contact_name)) BETWEEN 2 AND 100),
  contact_email varchar(190) NOT NULL CHECK (length(trim(contact_email)) BETWEEN 3 AND 190),
  message varchar(3000) NOT NULL CHECK (length(trim(message)) BETWEEN 10 AND 3000),
  status varchar(12) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'closed')),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by uuid REFERENCES users(user_id) ON DELETE SET NULL,
  UNIQUE (sender_id, request_id)
);
CREATE INDEX contact_messages_inbox ON contact_messages(status, created_at DESC, message_id);
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
