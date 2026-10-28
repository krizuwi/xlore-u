-- Rejected applications reuse the same account; each rejection remains private history.
ALTER TABLE institution_applications
  ADD COLUMN rejection_count smallint NOT NULL DEFAULT 0 CHECK (rejection_count BETWEEN 0 AND 5),
  ADD COLUMN attempt_number smallint NOT NULL DEFAULT 1 CHECK (attempt_number BETWEEN 1 AND 5);

CREATE TABLE institution_application_rejections (
  rejection_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES institution_applications(application_id),
  attempt_number smallint NOT NULL CHECK (attempt_number BETWEEN 1 AND 5),
  submitted_at timestamptz NOT NULL,
  rejected_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by uuid REFERENCES users(user_id),
  review_note varchar(2000) NOT NULL,
  registration_snapshot jsonb NOT NULL CHECK (jsonb_typeof(registration_snapshot) = 'object'),
  UNIQUE (application_id, attempt_number)
);
ALTER TABLE institution_application_rejections ENABLE ROW LEVEL SECURITY;

-- Before this migration there was no resubmission flow. Preserve each existing rejection as attempt 1.
INSERT INTO institution_application_rejections
  (application_id, attempt_number, submitted_at, rejected_at, reviewed_by, review_note, registration_snapshot)
SELECT ia.application_id, 1, ia.created_at, COALESCE(ia.reviewed_at, CURRENT_TIMESTAMP), ia.reviewed_by, ia.review_note,
  jsonb_build_object('representativeName', u.full_name, 'firstName', u.first_name, 'middleName', u.middle_name,
    'lastName', u.last_name, 'email', u.email, 'schoolId', ia.school_id, 'schoolName', s.school_name,
    'schoolCity', s.city_district, 'schoolType', s.school_type, 'schoolAddress', s.address, 'proposedSchool', ia.proposed_school,
    'title', ia.representative_title, 'phone', ia.contact_phone, 'verificationUrl', ia.verification_url,
    'evidence', ia.verification_note)
FROM institution_applications ia JOIN users u ON u.user_id = ia.user_id LEFT JOIN schools s ON s.school_id = ia.school_id WHERE ia.status = 'rejected';
UPDATE institution_applications SET rejection_count = 1 WHERE status = 'rejected';
