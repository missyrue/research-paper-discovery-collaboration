-- Adds a non-login user row so the bookmark procedure demo is repeatable.
-- This placeholder hash cannot authenticate and must never be used for login.
INSERT INTO users (role_id, full_name, email, password_hash)
VALUES (
  (SELECT role_id FROM roles WHERE role_name = 'Researcher' LIMIT 1),
  'Advanced DB Demo',
  'advanced-db-demo@example.invalid',
  'DEMO-ONLY-NOT-A-REAL-PASSWORD-HASH'
)
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);
