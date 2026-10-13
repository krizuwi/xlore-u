-- A University of Makati programs page was incorrectly linked to UST.
-- Preserve source history, errors, school records and existing offerings.
SET LOCAL lock_timeout = '5s';
UPDATE catalog_sources cs SET school_id = umak.school_id, updated_at = CURRENT_TIMESTAMP
FROM schools umak
WHERE cs.source_id = 'ea69c56f-c48c-42e2-a479-9e7d667d40a4'
  AND cs.school_id = '40000000-0000-4000-8000-000000000005'
  AND cs.source_url = 'https://www.umak.edu.ph/admissions/programofferings/'
  AND cs.allowed_host IN ('umak.edu.ph', 'www.umak.edu.ph')
  AND umak.school_name = 'University of Makati'
  AND umak.official_website_url IN ('https://www.umak.edu.ph/', 'https://umak.edu.ph/');
