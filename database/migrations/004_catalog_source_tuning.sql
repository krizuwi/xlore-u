UPDATE catalog_sources
SET parser_config = '{"itemSelector":"h1, h2, h3, h4, h5, h6, li, td, option, a, main span, article span"}'::jsonb,
    last_content_hash = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE source_type = 'program_catalog';
