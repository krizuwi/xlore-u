ALTER TABLE programs ADD COLUMN is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN duration varchar(80);

CREATE TABLE assessment_questions (
  question_id varchar(80) PRIMARY KEY,
  prompt varchar(350) NOT NULL,
  options jsonb NOT NULL CHECK (jsonb_typeof(options) = 'array'),
  status varchar(10) NOT NULL CHECK (status IN ('Active', 'Draft', 'Archived')),
  position_index integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO assessment_questions (question_id, prompt, status, position_index, options) VALUES
('interests','Which kind of activity do you enjoy most?','Active',1,'[{"id":"technology","label":"Building or exploring technology","scores":{"technology":3,"analytical":1}},{"id":"business","label":"Planning, selling, or leading a team","scores":{"business":3,"social":1}},{"id":"health","label":"Helping people improve their health","scores":{"health":3,"social":1}},{"id":"creative","label":"Designing, writing, or making media","scores":{"creative":3,"communication":1}}]'),
('strength','Which strength best describes you?','Active',2,'[{"id":"logic","label":"Logical problem solving","scores":{"analytical":3,"technology":1}},{"id":"communication","label":"Speaking and writing clearly","scores":{"communication":3,"social":1}},{"id":"empathy","label":"Listening and caring for others","scores":{"social":3,"health":1}},{"id":"creativity","label":"Generating original ideas","scores":{"creative":3,"communication":1}}]'),
('environment','What work environment sounds most appealing?','Active',3,'[{"id":"lab","label":"A lab or technical workspace","scores":{"science":3,"analytical":1}},{"id":"office","label":"A collaborative business office","scores":{"business":3,"communication":1}},{"id":"community","label":"A school, clinic, or community","scores":{"social":3,"health":1}},{"id":"studio","label":"A creative studio or production space","scores":{"creative":3,"technology":1}}]'),
('subject','Which subject area do you prefer?','Active',4,'[{"id":"math","label":"Mathematics or computing","scores":{"technology":2,"analytical":2}},{"id":"science","label":"Natural or health sciences","scores":{"science":3,"health":1}},{"id":"humanities","label":"Language or social sciences","scores":{"communication":2,"social":2}},{"id":"arts","label":"Arts or design","scores":{"creative":3,"communication":1}}]'),
('goal','What outcome matters most in a future career?','Active',5,'[{"id":"innovation","label":"Creating useful innovations","scores":{"technology":2,"science":2}},{"id":"enterprise","label":"Growing an organization","scores":{"business":3,"analytical":1}},{"id":"service","label":"Serving people and communities","scores":{"social":2,"health":2}},{"id":"expression","label":"Expressing ideas that influence others","scores":{"creative":2,"communication":2}}]');

CREATE TABLE admin_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO admin_settings (id) VALUES (true);
CREATE TABLE admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES users(user_id),
  action varchar(30) NOT NULL,
  entity_type varchar(30) NOT NULL,
  entity_id text,
  detail text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
