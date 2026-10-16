-- Existing users remain unmodified: do not invent acceptance for old accounts.
ALTER TABLE users
  ADD COLUMN policy_version varchar(40),
  ADD COLUMN policy_accepted_at timestamptz,
  ADD CONSTRAINT users_policy_acceptance_pair CHECK (
    (policy_version IS NULL AND policy_accepted_at IS NULL)
    OR (policy_version IS NOT NULL AND length(trim(policy_version)) > 0 AND policy_accepted_at IS NOT NULL)
  );

COMMENT ON COLUMN users.policy_accepted_at IS
  'Server-recorded time of affirmative Terms acceptance and Privacy Policy acknowledgment at account creation; not marketing or optional location consent.';
