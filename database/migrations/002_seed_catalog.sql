INSERT INTO strands (strand_id, strand_code, strand_name) VALUES
('20000000-0000-4000-8000-000000000001', 'STEM', 'Science, Technology, Engineering, and Mathematics'),
('20000000-0000-4000-8000-000000000002', 'ABM', 'Accountancy, Business, and Management'),
('20000000-0000-4000-8000-000000000003', 'HUMSS', 'Humanities and Social Sciences'),
('20000000-0000-4000-8000-000000000004', 'GAS', 'General Academic Strand'),
('20000000-0000-4000-8000-000000000005', 'ARTS', 'Arts and Design Track')
ON CONFLICT (strand_code) DO UPDATE SET strand_name = EXCLUDED.strand_name;

INSERT INTO programs
  (program_id, program_name, description, category, degree_level, requirements, career_paths, interest_tags)
VALUES
('30000000-0000-4000-8000-000000000001', 'BS Information Technology',
 'Focuses on software development, web technologies, databases, networks, and the practical use of computing in organizations.',
 'Computing', 'Bachelor', 'Senior high school completion; STEM or ICT background is helpful but not always required.',
 '["Software Developer", "Systems Analyst", "Web Developer", "IT Support Specialist"]',
 '["technology", "analytical", "creative"]'),
('30000000-0000-4000-8000-000000000002', 'BS Computer Science',
 'Builds strong foundations in algorithms, software engineering, data structures, artificial intelligence, and computing theory.',
 'Computing', 'Bachelor', 'Senior high school completion; mathematics readiness is recommended.',
 '["Software Engineer", "Data Scientist", "AI Engineer", "Researcher"]',
 '["technology", "analytical", "science"]'),
('30000000-0000-4000-8000-000000000003', 'BS Business Administration',
 'Develops skills in management, marketing, operations, entrepreneurship, and organizational strategy.',
 'Business', 'Bachelor', 'Senior high school completion; ABM background is helpful but not required.',
 '["Business Analyst", "Marketing Specialist", "Entrepreneur", "Operations Manager"]',
 '["business", "communication", "analytical"]'),
('30000000-0000-4000-8000-000000000004', 'BS Accountancy',
 'Prepares students for accounting, auditing, taxation, financial reporting, and professional licensure.',
 'Business', 'Bachelor', 'Senior high school completion; strong mathematics and analytical skills are recommended.',
 '["Certified Public Accountant", "Auditor", "Tax Associate", "Financial Analyst"]',
 '["business", "analytical"]'),
('30000000-0000-4000-8000-000000000005', 'BS Nursing',
 'Combines health science, clinical practice, patient care, and community health preparation.',
 'Health Sciences', 'Bachelor', 'Senior high school completion; health screening and institution-specific admission requirements apply.',
 '["Registered Nurse", "Community Health Nurse", "Clinical Research Associate"]',
 '["health", "science", "social"]'),
('30000000-0000-4000-8000-000000000006', 'BS Psychology',
 'Studies human behavior, cognition, research methods, mental health, and applications in organizations and communities.',
 'Social Sciences', 'Bachelor', 'Senior high school completion and institution-specific admission requirements.',
 '["Psychometrician", "Human Resources Specialist", "Research Assistant", "Guidance Associate"]',
 '["social", "science", "communication"]'),
('30000000-0000-4000-8000-000000000007', 'BA Communication',
 'Covers media, journalism, public relations, communication research, writing, and digital production.',
 'Communication', 'Bachelor', 'Senior high school completion; portfolio or interview may be required by some institutions.',
 '["Content Producer", "Public Relations Specialist", "Journalist", "Communication Officer"]',
 '["communication", "creative", "social"]'),
('30000000-0000-4000-8000-000000000008', 'BS Architecture',
 'Integrates design, visual communication, building technology, planning, and professional architectural practice.',
 'Architecture and Design', 'Bachelor', 'Senior high school completion; drawing or aptitude requirements vary by institution.',
 '["Architect", "Urban Design Assistant", "Building Information Modeler", "Design Consultant"]',
 '["creative", "technology", "analytical"]')
ON CONFLICT (program_name) DO UPDATE SET
 description = EXCLUDED.description, category = EXCLUDED.category, requirements = EXCLUDED.requirements,
 career_paths = EXCLUDED.career_paths, interest_tags = EXCLUDED.interest_tags;

INSERT INTO schools
  (school_id, school_name, address, city_district, school_type, tuition_range, accreditation,
   scholarship_info, latitude, longitude, google_rating)
VALUES
('40000000-0000-4000-8000-000000000001', 'University of the Philippines Diliman',
 'Roxas Avenue, Diliman', 'Quezon City', 'Public', 'Subsidized; fees vary by assessment',
 'National university; programs hold discipline-specific accreditations.',
 'Socialized Tuition System and university scholarships are available.', 14.6549000, 121.0647000, 4.6),
('40000000-0000-4000-8000-000000000002', 'Polytechnic University of the Philippines',
 'Anonas Street, Santa Mesa', 'Manila', 'Public', 'Tuition-free for eligible students',
 'State university recognized by CHED.',
 'Government tuition subsidy and merit-based assistance may be available.', 14.5988000, 121.0108000, 4.4),
('40000000-0000-4000-8000-000000000003', 'Pamantasan ng Lungsod ng Maynila',
 'General Luna corner Muralla Streets, Intramuros', 'Manila', 'Public', 'City-funded; fees vary',
 'Locally funded university recognized by CHED.',
 'Manila resident grants and university assistance programs are available.', 14.5867000, 120.9761000, 4.5),
('40000000-0000-4000-8000-000000000004', 'Technological University of the Philippines',
 'Ayala Boulevard, Ermita', 'Manila', 'Public', 'Tuition-free for eligible students',
 'State technological university recognized by CHED.',
 'Government tuition subsidy and selected academic scholarships are available.', 14.5873000, 120.9841000, 4.4),
('40000000-0000-4000-8000-000000000005', 'University of Santo Tomas',
 'Espana Boulevard, Sampaloc', 'Manila', 'Private', 'PHP 55,000-PHP 95,000 per semester',
 'Autonomous status; multiple programs have Centers of Excellence or Development.',
 'Academic, athletic, cultural, and needs-based scholarships are available.', 14.6096000, 120.9896000, 4.6),
('40000000-0000-4000-8000-000000000006', 'De La Salle University',
 '2401 Taft Avenue', 'Manila', 'Private', 'PHP 75,000-PHP 120,000 per term',
 'Autonomous status; institutional and program accreditations apply.',
 'Merit scholarships, financial assistance, and externally funded grants are available.', 14.5648000, 120.9932000, 4.6),
('40000000-0000-4000-8000-000000000007', 'Ateneo de Manila University',
 'Katipunan Avenue, Loyola Heights', 'Quezon City', 'Private', 'PHP 95,000-PHP 135,000 per semester',
 'Autonomous status; institutional and program accreditations apply.',
 'Merit, athletic, and financial-aid scholarships are available.', 14.6408000, 121.0771000, 4.7),
('40000000-0000-4000-8000-000000000008', 'Mapua University',
 '658 Muralla Street, Intramuros', 'Manila', 'Private', 'PHP 45,000-PHP 70,000 per quarter',
 'Autonomous status; engineering and computing programs include international accreditations.',
 'Entrance, academic, alumni, and partner-sponsored scholarships are available.', 14.5907000, 120.9776000, 4.5)
ON CONFLICT (school_name, city_district) DO UPDATE SET
 address = EXCLUDED.address, tuition_range = EXCLUDED.tuition_range, accreditation = EXCLUDED.accreditation,
 scholarship_info = EXCLUDED.scholarship_info, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
 google_rating = EXCLUDED.google_rating;

INSERT INTO available_schools (available_id, school_id, available_since, is_active_available) VALUES
('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '2026-01-01', TRUE),
('50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', '2026-01-01', TRUE),
('50000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000003', '2026-01-01', TRUE),
('50000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000004', '2026-01-01', TRUE),
('50000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000005', '2026-01-01', TRUE),
('50000000-0000-4000-8000-000000000006', '40000000-0000-4000-8000-000000000006', '2026-01-01', TRUE),
('50000000-0000-4000-8000-000000000007', '40000000-0000-4000-8000-000000000007', '2026-01-01', TRUE),
('50000000-0000-4000-8000-000000000008', '40000000-0000-4000-8000-000000000008', '2026-01-01', TRUE)
ON CONFLICT (school_id) DO UPDATE SET is_active_available = EXCLUDED.is_active_available;

INSERT INTO school_programs
  (school_program_id, school_id, program_id, tuition_per_semester, is_top_program)
VALUES
('61000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002',30000,TRUE),
('61000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003',30000,FALSE),
('61000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000006',30000,TRUE),
('61000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000007',30000,FALSE),
('61000000-0000-4000-8000-000000000005','40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001',0,TRUE),
('61000000-0000-4000-8000-000000000006','40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003',0,FALSE),
('61000000-0000-4000-8000-000000000007','40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000004',0,TRUE),
('61000000-0000-4000-8000-000000000008','40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000007',0,FALSE),
('61000000-0000-4000-8000-000000000009','40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000001',0,FALSE),
('61000000-0000-4000-8000-000000000010','40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003',0,FALSE),
('61000000-0000-4000-8000-000000000011','40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000005',0,TRUE),
('61000000-0000-4000-8000-000000000012','40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000006',0,FALSE),
('61000000-0000-4000-8000-000000000013','40000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000001',0,TRUE),
('61000000-0000-4000-8000-000000000014','40000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000002',0,FALSE),
('61000000-0000-4000-8000-000000000015','40000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000008',0,TRUE),
('61000000-0000-4000-8000-000000000016','40000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000001',68000,FALSE),
('61000000-0000-4000-8000-000000000017','40000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000003',72000,FALSE),
('61000000-0000-4000-8000-000000000018','40000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000005',92000,TRUE),
('61000000-0000-4000-8000-000000000019','40000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000008',85000,TRUE),
('61000000-0000-4000-8000-000000000020','40000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000001',88000,TRUE),
('61000000-0000-4000-8000-000000000021','40000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000002',92000,TRUE),
('61000000-0000-4000-8000-000000000022','40000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000003',90000,FALSE),
('61000000-0000-4000-8000-000000000023','40000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000007',85000,FALSE),
('61000000-0000-4000-8000-000000000024','40000000-0000-4000-8000-000000000007','30000000-0000-4000-8000-000000000002',110000,TRUE),
('61000000-0000-4000-8000-000000000025','40000000-0000-4000-8000-000000000007','30000000-0000-4000-8000-000000000003',105000,FALSE),
('61000000-0000-4000-8000-000000000026','40000000-0000-4000-8000-000000000007','30000000-0000-4000-8000-000000000006',105000,TRUE),
('61000000-0000-4000-8000-000000000027','40000000-0000-4000-8000-000000000007','30000000-0000-4000-8000-000000000007',98000,FALSE),
('61000000-0000-4000-8000-000000000028','40000000-0000-4000-8000-000000000008','30000000-0000-4000-8000-000000000001',62000,TRUE),
('61000000-0000-4000-8000-000000000029','40000000-0000-4000-8000-000000000008','30000000-0000-4000-8000-000000000002',65000,TRUE),
('61000000-0000-4000-8000-000000000030','40000000-0000-4000-8000-000000000008','30000000-0000-4000-8000-000000000008',68000,TRUE)
ON CONFLICT (school_id, program_id) DO NOTHING;

INSERT INTO school_strands (school_strand_id, school_id, strand_id)
SELECT gen_random_uuid(), s.school_id, st.strand_id
FROM schools s CROSS JOIN strands st
WHERE s.school_id IN (
 '40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002',
 '40000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000004',
 '40000000-0000-4000-8000-000000000005','40000000-0000-4000-8000-000000000006',
 '40000000-0000-4000-8000-000000000007','40000000-0000-4000-8000-000000000008'
)
ON CONFLICT (school_id, strand_id) DO NOTHING;
