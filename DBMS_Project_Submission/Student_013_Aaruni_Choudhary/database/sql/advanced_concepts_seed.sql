-- Minimal local demo data. Use only in a fresh classroom/demo database.
-- The password_hash value is intentionally not a real hash and cannot be used
-- to sign in; this row exists only to demonstrate relational/RLS behavior.

INSERT INTO roles (role_name)
VALUES ('researcher')
ON CONFLICT (role_name) DO NOTHING;

INSERT INTO users (role_id, full_name, email, password_hash)
VALUES (
  (SELECT role_id FROM roles WHERE role_name = 'researcher'),
  'Demo Researcher',
  'demo.researcher@example.invalid',
  'DEMO-ONLY-NOT-A-REAL-PASSWORD-HASH'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO papers (title, abstract, doi, publication_year, venue)
VALUES
  (
    'Graph Neural Networks for Molecular Property Prediction',
    'This paper studies graph neural networks that predict molecular properties from atom and bond structure.',
    '10.5555/advanced-db-demo-1', 2023, 'Demo Journal of Computing'
  ),
  (
    'Attention Models for Long Document Summarization',
    'We evaluate transformer attention for summarizing long scientific documents and clinical records.',
    '10.5555/advanced-db-demo-2', 2024, 'Demo Journal of Computing'
  ),
  (
    'Remote Sensing for Crop Health Monitoring',
    'Satellite imagery and machine learning are used to identify crop stress and estimate agricultural yield.',
    '10.5555/advanced-db-demo-3', 2022, 'Demo Journal of Computing'
  )
ON CONFLICT (doi) DO NOTHING;

INSERT INTO collections (owner_id, name)
VALUES (
  (SELECT user_id FROM users WHERE email = 'demo.researcher@example.invalid'),
  'Advanced database demo'
)
ON CONFLICT (owner_id, name) DO NOTHING;
