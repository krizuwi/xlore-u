-- Routing keeps every eligible program, not an arbitrary top 20. Preserve
-- existing recommendations and all uniqueness, foreign-key and score checks.
SET LOCAL lock_timeout = '5s';
ALTER TABLE recommended_programs
  DROP CONSTRAINT recommended_programs_rank_position_check;
ALTER TABLE recommended_programs
  ALTER COLUMN rank_position TYPE integer;
ALTER TABLE recommended_programs
  ADD CONSTRAINT recommended_programs_rank_position_check CHECK (rank_position >= 1);
