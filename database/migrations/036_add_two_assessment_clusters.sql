-- Bring default and previously seeded assessment settings in line with the
-- 13-cluster directory. Preserve any admin-configured values that already exist.

UPDATE assessment_settings
SET settings = jsonb_set(
  settings,
  '{clusters}',
  (settings->'clusters') || jsonb_build_array(jsonb_build_object(
    'id', 'law-criminology-legal-studies',
    'name', 'Law, Criminology & Legal Studies',
    'description', 'Criminology, law enforcement, legal management, forensic science, and legal administration programs.',
    'programExamples', jsonb_build_array('BS Criminology', 'BS Legal Management', 'Juris Doctor'),
    'includeKeywords', jsonb_build_array('Criminology', 'Law Enforcement', 'Legal Management', 'Juris Doctor', 'Forensic Science', 'Legal Administration'),
    'excludeKeywords', jsonb_build_array(),
    'includeProgramIds', jsonb_build_array(),
    'excludeProgramIds', jsonb_build_array()
  )),
  true
)
WHERE id = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(settings->'clusters') AS cluster
    WHERE cluster->>'id' = 'law-criminology-legal-studies'
       OR lower(cluster->>'name') = lower('Law, Criminology & Legal Studies')
  );

UPDATE assessment_settings
SET settings = jsonb_set(
  settings,
  '{clusters}',
  (settings->'clusters') || jsonb_build_array(jsonb_build_object(
    'id', 'social-sciences-humanities-fine-arts',
    'name', 'Social Sciences, Humanities & Fine Arts',
    'description', 'Political science, international relations, philosophy, literature, sociology, fine arts, music, and performing arts.',
    'programExamples', jsonb_build_array('BA Political Science', 'AB International Studies', 'Bachelor of Fine Arts'),
    'includeKeywords', jsonb_build_array('Political Science', 'International Relations', 'International Studies', 'Philosophy', 'Literature', 'Sociology', 'Fine Arts', 'Performing Arts', 'Music'),
    'excludeKeywords', jsonb_build_array('Criminology', 'Law Enforcement', 'Legal Management'),
    'includeProgramIds', jsonb_build_array(),
    'excludeProgramIds', jsonb_build_array()
  )),
  true
)
WHERE id = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(settings->'clusters') AS cluster
    WHERE cluster->>'id' = 'social-sciences-humanities-fine-arts'
       OR lower(cluster->>'name') = lower('Social Sciences, Humanities & Fine Arts')
  );

-- Add a reachable routing answer for each cluster, using an existing matching
-- cluster ID if an administrator has already created that cluster under another ID.
UPDATE assessment_settings
SET settings = jsonb_set(
  settings,
  '{routingQuestions,C,options}',
  (settings #> '{routingQuestions,C,options}') || jsonb_build_array(jsonb_build_object(
    'id', 'c-law-criminology-legal-studies',
    'label', 'Studying law, criminology, law enforcement, or legal administration',
    'clusterId', (
      SELECT cluster->>'id' FROM jsonb_array_elements(settings->'clusters') AS cluster
      WHERE lower(cluster->>'name') = lower('Law, Criminology & Legal Studies') LIMIT 1
    )
  )),
  true
)
WHERE id = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(settings #> '{routingQuestions,C,options}') AS option
    WHERE option->>'clusterId' = (
      SELECT cluster->>'id' FROM jsonb_array_elements(settings->'clusters') AS cluster
      WHERE lower(cluster->>'name') = lower('Law, Criminology & Legal Studies') LIMIT 1
    )
  );

UPDATE assessment_settings
SET settings = jsonb_set(
  settings,
  '{routingQuestions,B,options}',
  (settings #> '{routingQuestions,B,options}') || jsonb_build_array(jsonb_build_object(
    'id', 'b-social-humanities-fine-arts',
    'label', 'Through social sciences, humanities, fine arts, music, or performing arts',
    'clusterId', (
      SELECT cluster->>'id' FROM jsonb_array_elements(settings->'clusters') AS cluster
      WHERE lower(cluster->>'name') = lower('Social Sciences, Humanities & Fine Arts') LIMIT 1
    )
  )),
  true
)
WHERE id = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(settings #> '{routingQuestions,B,options}') AS option
    WHERE option->>'clusterId' = (
      SELECT cluster->>'id' FROM jsonb_array_elements(settings->'clusters') AS cluster
      WHERE lower(cluster->>'name') = lower('Social Sciences, Humanities & Fine Arts') LIMIT 1
    )
  );
