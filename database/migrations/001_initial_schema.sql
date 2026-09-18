CREATE TABLE users (
  user_id uuid PRIMARY KEY,
  email varchar(190) NOT NULL UNIQUE,
  password_hash varchar(255) NOT NULL,
  full_name varchar(120) NOT NULL,
  email_verified_at timestamptz,
  verification_code_hash char(64),
  verification_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active boolean NOT NULL DEFAULT true
);
CREATE INDEX idx_users_email_active ON users (email, is_active);

CREATE TABLE user_sessions (
  session_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  refresh_token_hash char(64) NOT NULL UNIQUE,
  device_type varchar(40) NOT NULL,
  browser varchar(255) NOT NULL,
  ip_address varchar(64) NOT NULL,
  login_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX idx_sessions_user_valid ON user_sessions (user_id, revoked_at, expires_at);

CREATE TABLE schools (
  school_id uuid PRIMARY KEY,
  school_name varchar(190) NOT NULL,
  address varchar(255) NOT NULL,
  city_district varchar(100) NOT NULL,
  school_type varchar(20) NOT NULL CHECK (school_type IN ('Public', 'Private')),
  tuition_range varchar(80) NOT NULL,
  accreditation varchar(255) NOT NULL,
  scholarship_info text,
  latitude numeric(10,7) NOT NULL,
  longitude numeric(10,7) NOT NULL,
  google_rating numeric(2,1),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (school_name, city_district)
);
CREATE INDEX idx_schools_city_type ON schools (city_district, school_type);

CREATE TABLE available_schools (
  available_id uuid PRIMARY KEY,
  school_id uuid NOT NULL UNIQUE REFERENCES schools(school_id) ON DELETE CASCADE,
  available_since date NOT NULL,
  is_active_available boolean NOT NULL DEFAULT true
);

CREATE TABLE strands (
  strand_id uuid PRIMARY KEY,
  strand_code varchar(20) NOT NULL UNIQUE,
  strand_name varchar(120) NOT NULL
);

CREATE TABLE school_strands (
  school_strand_id uuid PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  strand_id uuid NOT NULL REFERENCES strands(strand_id) ON DELETE CASCADE,
  UNIQUE (school_id, strand_id)
);

CREATE TABLE programs (
  program_id uuid PRIMARY KEY,
  program_name varchar(190) NOT NULL UNIQUE,
  description text NOT NULL,
  category varchar(100) NOT NULL,
  degree_level varchar(60) NOT NULL,
  requirements text NOT NULL,
  career_paths jsonb NOT NULL,
  interest_tags jsonb NOT NULL
);
CREATE INDEX idx_program_category_degree ON programs (category, degree_level);
CREATE INDEX idx_program_interest_tags ON programs USING gin (interest_tags);

CREATE TABLE school_programs (
  school_program_id uuid PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES programs(program_id) ON DELETE CASCADE,
  tuition_per_semester numeric(10,2) NOT NULL CHECK (tuition_per_semester >= 0),
  is_top_program boolean NOT NULL DEFAULT false,
  UNIQUE (school_id, program_id)
);
CREATE INDEX idx_school_program_tuition ON school_programs (tuition_per_semester);

CREATE TABLE assessments (
  assessment_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at timestamptz,
  percent_complete smallint NOT NULL DEFAULT 0 CHECK (percent_complete BETWEEN 0 AND 100)
);
CREATE INDEX idx_assessment_user_created ON assessments (user_id, created_at);

CREATE TABLE assessment_responses (
  response_id uuid PRIMARY KEY,
  assessment_id uuid NOT NULL REFERENCES assessments(assessment_id) ON DELETE CASCADE,
  question_id varchar(80) NOT NULL,
  answer_data jsonb NOT NULL,
  UNIQUE (assessment_id, question_id)
);

CREATE TABLE career_profiles (
  profile_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL UNIQUE REFERENCES assessments(assessment_id) ON DELETE CASCADE,
  primary_direction varchar(120) NOT NULL,
  ranked_tags jsonb NOT NULL,
  score_breakdown jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_profile_user_generated ON career_profiles (user_id, generated_at);

CREATE TABLE recommended_programs (
  recommendation_id uuid PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES career_profiles(profile_id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES programs(program_id) ON DELETE CASCADE,
  rank_position smallint NOT NULL CHECK (rank_position BETWEEN 1 AND 20),
  match_score smallint NOT NULL CHECK (match_score BETWEEN 0 AND 100),
  UNIQUE (profile_id, program_id),
  UNIQUE (profile_id, rank_position)
);

CREATE TABLE comparison_sets (
  comparison_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_comparison_user_created ON comparison_sets (user_id, created_at);

CREATE TABLE comparison_schools (
  comparison_school_id uuid PRIMARY KEY,
  comparison_id uuid NOT NULL REFERENCES comparison_sets(comparison_id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  position_index smallint NOT NULL CHECK (position_index BETWEEN 1 AND 3),
  UNIQUE (comparison_id, school_id),
  UNIQUE (comparison_id, position_index)
);

CREATE TABLE user_saved_schools (
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, school_id)
);

CREATE TABLE user_saved_programs (
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES programs(program_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, program_id)
);

-- The browser must use the Express API, not Supabase's public Data API.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE available_schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE strands ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_strands ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommended_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparison_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparison_schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_saved_schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_saved_programs ENABLE ROW LEVEL SECURITY;
