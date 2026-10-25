-- Suspension releases the school for a newly verified representative.
-- Keep historical applications and content; only approved accounts reserve a school.
DROP INDEX institution_school_owner;
CREATE UNIQUE INDEX institution_school_owner ON institution_applications(school_id)
  WHERE status = 'approved';
