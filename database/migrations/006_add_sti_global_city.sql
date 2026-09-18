INSERT INTO schools
  (school_id, school_name, address, city_district, school_type, tuition_range,
   accreditation, scholarship_info, latitude, longitude, google_rating,
   official_website_url, description)
VALUES
  ('40000000-0000-4000-8000-000000000009', 'STI College Global City',
   'STI Academic Center, University Parkway Drive, Bonifacio Global City',
   'Taguig', 'Private', 'Contact the campus for current tuition and fees',
   'Recognized higher education institution; verify current program accreditation with STI and CHED.',
   'STI financial assistance and scholarship availability varies by academic year.',
   14.5523500, 121.0560769, NULL,
   'https://www.sti.edu/campuses-details.asp?campus_id=R0xP',
   'STI College Global City is an STI campus in Bonifacio Global City, Taguig, offering senior high school and tertiary programs.')
ON CONFLICT (school_name, city_district) DO UPDATE SET
  address = EXCLUDED.address,
  school_type = EXCLUDED.school_type,
  tuition_range = EXCLUDED.tuition_range,
  accreditation = EXCLUDED.accreditation,
  scholarship_info = EXCLUDED.scholarship_info,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  official_website_url = EXCLUDED.official_website_url,
  description = EXCLUDED.description;

INSERT INTO available_schools (available_id, school_id, available_since, is_active_available)
VALUES
  ('50000000-0000-4000-8000-000000000009', '40000000-0000-4000-8000-000000000009', CURRENT_DATE, true)
ON CONFLICT (school_id) DO UPDATE SET is_active_available = true;

INSERT INTO programs
  (program_id, program_name, description, category, degree_level, requirements,
   career_paths, interest_tags, source_url, last_verified_at, created_from_scrape)
VALUES
  (gen_random_uuid(), 'Bachelor of Science in Computer Engineering',
   'Combines computer hardware, electronics, software, and embedded systems.',
   'Engineering', 'Bachelor', 'See the institution''s official program page for current admission requirements.',
   '["Computer Engineer", "Embedded Systems Engineer", "Network Engineer"]',
   '["engineering", "technology", "analytical"]',
   'https://www.sti.edu/campuses-details.asp?campus_id=R0xP', CURRENT_TIMESTAMP, false),
  (gen_random_uuid(), 'Bachelor of Science in Accounting Information System',
   'Combines accounting, business processes, information systems, and data-driven decision making.',
   'Business and Management', 'Bachelor', 'See the institution''s official program page for current admission requirements.',
   '["Accounting Information Systems Specialist", "Business Analyst", "Internal Auditor"]',
   '["business", "technology", "analytical"]',
   'https://www.sti.edu/campuses-details.asp?campus_id=R0xP', CURRENT_TIMESTAMP, false),
  (gen_random_uuid(), 'Bachelor of Science in Hospitality Management',
   'Prepares students for operations, service, and management roles in hospitality organizations.',
   'Hospitality and Tourism', 'Bachelor', 'See the institution''s official program page for current admission requirements.',
   '["Hotel Manager", "Restaurant Manager", "Events Coordinator"]',
   '["service", "business", "communication"]',
   'https://www.sti.edu/campuses-details.asp?campus_id=R0xP', CURRENT_TIMESTAMP, false),
  (gen_random_uuid(), 'Bachelor of Science in Tourism Management',
   'Covers tourism operations, destination management, travel services, and hospitality fundamentals.',
   'Hospitality and Tourism', 'Bachelor', 'See the institution''s official program page for current admission requirements.',
   '["Tourism Officer", "Travel Consultant", "Tour Coordinator"]',
   '["service", "business", "communication"]',
   'https://www.sti.edu/campuses-details.asp?campus_id=R0xP', CURRENT_TIMESTAMP, false)
ON CONFLICT (program_name) DO UPDATE SET
  last_verified_at = CURRENT_TIMESTAMP,
  source_url = COALESCE(programs.source_url, EXCLUDED.source_url);

INSERT INTO program_aliases (program_id, alias, normalized_alias)
SELECT p.program_id, p.program_name, regexp_replace(lower(p.program_name), '[^a-z0-9]+', ' ', 'g')
FROM programs p
WHERE p.program_name IN (
  'Bachelor of Science in Computer Engineering',
  'Bachelor of Science in Accounting Information System',
  'Bachelor of Science in Hospitality Management',
  'Bachelor of Science in Tourism Management'
)
ON CONFLICT (normalized_alias) DO NOTHING;

INSERT INTO school_programs
  (school_program_id, school_id, program_id, tuition_per_semester, is_top_program,
   source_url, last_verified_at)
SELECT gen_random_uuid(), '40000000-0000-4000-8000-000000000009', p.program_id,
  NULL, false, 'https://www.sti.edu/campuses-details.asp?campus_id=R0xP', CURRENT_TIMESTAMP
FROM programs p
WHERE p.program_name IN (
  'BS Computer Science',
  'BS Information Technology',
  'Bachelor of Science in Computer Engineering',
  'BS Business Administration',
  'Bachelor of Science in Accounting Information System',
  'Bachelor of Science in Hospitality Management',
  'BA Communication',
  'Bachelor of Science in Tourism Management'
)
ON CONFLICT (school_id, program_id) DO UPDATE SET
  source_url = EXCLUDED.source_url,
  last_verified_at = CURRENT_TIMESTAMP;

INSERT INTO school_strands (school_strand_id, school_id, strand_id)
SELECT gen_random_uuid(), '40000000-0000-4000-8000-000000000009', strand_id
FROM strands
WHERE strand_code IN ('ABM', 'STEM')
ON CONFLICT (school_id, strand_id) DO NOTHING;

INSERT INTO catalog_sources
  (source_id, school_id, source_type, source_url, allowed_host, parser_config, interval_hours)
VALUES
  ('71000000-0000-4000-8000-000000000009', '40000000-0000-4000-8000-000000000009',
   'school_profile', 'https://www.sti.edu/campuses-details.asp?campus_id=R0xP',
   'sti.edu', '{}'::jsonb, 168),
  ('72000000-0000-4000-8000-000000000009', '40000000-0000-4000-8000-000000000009',
   'program_catalog', 'https://www.sti.edu/campuses-details.asp?campus_id=R0xP',
   'sti.edu', '{"itemSelector":"h1, h2, h3, h4, h5, h6, li, td, option, a, main span, article span"}'::jsonb, 168)
ON CONFLICT (school_id, source_type, source_url) DO UPDATE SET
  allowed_host = EXCLUDED.allowed_host,
  parser_config = EXCLUDED.parser_config,
  enabled = true,
  updated_at = CURRENT_TIMESTAMP;
