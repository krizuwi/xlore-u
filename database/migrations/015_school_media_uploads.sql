CREATE TABLE school_media_assets (
  asset_id uuid PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  content_type varchar(20) NOT NULL CHECK (content_type IN ('image/png', 'image/jpeg', 'image/webp')),
  image_data bytea NOT NULL CHECK (octet_length(image_data) BETWEEN 12 AND 5242880),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_school_media_assets_school ON school_media_assets(school_id);
ALTER TABLE school_media_assets ENABLE ROW LEVEL SECURITY;

-- STI's official images refuse cross-site embedding. Keep truthful empty photos
-- until an administrator supplies permitted images; do not substitute another campus.
UPDATE schools SET logo_url = 'https://thumb.wikimedia.org/wikipedia/en/thumb/1/1f/Systems_Technology_Institute.png/250px-Systems_Technology_Institute.png',
  logo_credit = '{"credit":"STI Education Services Group","sourceUrl":"https://en.wikipedia.org/wiki/File:Systems_Technology_Institute.png","license":"School identity / trademark","licenseUrl":""}'::jsonb,
  campus_photos = '[]'::jsonb
WHERE school_id = '40000000-0000-4000-8000-000000000009'
  AND logo_url = 'https://www.sti.edu/images/stilogo3.png';
