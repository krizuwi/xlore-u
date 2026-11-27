-- Speed up normalized catalog searches without changing search results.
-- The concatenated fields use immutable text operations so PostgreSQL can index them.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS programs_active_search_trgm
  ON programs USING gin ((
    ' ' || trim(regexp_replace(translate(lower(
      COALESCE((program_name)::text, '') || ' ' ||
      COALESCE((category)::text, '') || ' ' ||
      COALESCE((degree_level)::text, '') || ' ' ||
      COALESCE((description)::text, '') || ' ' ||
      COALESCE((career_paths::text)::text, '') || ' ' ||
      COALESCE((interest_tags::text)::text, '')
    ), 'áàâäãåéèêëíìîïóòôöõúùûüñç', 'aaaaaaeeeeiiiiooooouuuunc'),
    '[^a-z0-9]+', ' ', 'g')) || ' '
  ) gin_trgm_ops)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS schools_active_search_trgm
  ON schools USING gin ((
    ' ' || trim(regexp_replace(translate(lower(
      COALESCE((school_name)::text, '') || ' ' ||
      COALESCE((city_district)::text, '') || ' ' ||
      COALESCE((address)::text, '') || ' ' ||
      COALESCE((school_type)::text, '')
    ), 'áàâäãåéèêëíìîïóòôöõúùûüñç', 'aaaaaaeeeeiiiiooooouuuunc'),
    '[^a-z0-9]+', ' ', 'g')) || ' '
  ) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS schools_name_search_trgm
  ON schools USING gin ((
    ' ' || trim(regexp_replace(translate(lower(COALESCE((school_name)::text, '')),
      'áàâäãåéèêëíìîïóòôöõúùûüñç', 'aaaaaaeeeeiiiiooooouuuunc'),
    '[^a-z0-9]+', ' ', 'g')) || ' '
  ) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS school_programs_program_school
  ON school_programs (program_id, school_id);
