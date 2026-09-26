ALTER TABLE users
  ADD COLUMN first_name varchar(120),
  ADD COLUMN middle_name varchar(120),
  ADD COLUMN last_name varchar(120);

-- Legacy names have no reliable middle-name boundary. Keep everything after
-- the first word together so users can correct their names in their profile.
UPDATE users
SET first_name = split_part(btrim(full_name), ' ', 1),
    middle_name = '',
    last_name = CASE
      WHEN btrim(full_name) LIKE '% %'
        THEN btrim(substr(btrim(full_name), length(split_part(btrim(full_name), ' ', 1)) + 1))
      ELSE ''
    END;
