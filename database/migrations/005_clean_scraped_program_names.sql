DO $$
DECLARE
  item record;
  clean_name text;
  target_id uuid;
BEGIN
  FOR item IN
    SELECT program_id, program_name, source_url, last_verified_at
    FROM programs
    WHERE created_from_scrape = true
    ORDER BY program_name
  LOOP
    clean_name := trim(regexp_replace(
      replace(item.program_name, '>', ''),
      '\s*\([^)]*(years?|campus|Manila|Laguna)[^)]*\)\s*$',
      '',
      'i'
    ));

    IF clean_name <> item.program_name AND length(clean_name) >= 4 THEN
      SELECT program_id INTO target_id
      FROM programs
      WHERE program_name = clean_name AND program_id <> item.program_id
      LIMIT 1;

      IF target_id IS NOT NULL THEN
        INSERT INTO school_programs
          (school_program_id, school_id, program_id, tuition_per_semester, is_top_program,
           source_url, last_verified_at)
        SELECT gen_random_uuid(), school_id, target_id, tuition_per_semester, is_top_program,
          source_url, last_verified_at
        FROM school_programs
        WHERE program_id = item.program_id
        ON CONFLICT (school_id, program_id) DO UPDATE SET
          source_url = COALESCE(EXCLUDED.source_url, school_programs.source_url),
          last_verified_at = GREATEST(EXCLUDED.last_verified_at, school_programs.last_verified_at);

        UPDATE programs SET
          source_url = COALESCE(programs.source_url, item.source_url),
          last_verified_at = GREATEST(programs.last_verified_at, item.last_verified_at)
        WHERE program_id = target_id;

        DELETE FROM program_aliases WHERE program_id = item.program_id;
        DELETE FROM school_programs WHERE program_id = item.program_id;
        DELETE FROM programs WHERE program_id = item.program_id;
      ELSE
        UPDATE programs SET program_name = clean_name WHERE program_id = item.program_id;
        DELETE FROM program_aliases WHERE program_id = item.program_id;
        INSERT INTO program_aliases (program_id, alias, normalized_alias)
        VALUES (
          item.program_id,
          clean_name,
          regexp_replace(lower(clean_name), '[^a-z0-9]+', ' ', 'g')
        )
        ON CONFLICT (normalized_alias) DO NOTHING;
      END IF;
    END IF;
    target_id := NULL;
  END LOOP;
END $$;
