-- Run after schema.sql and advanced_concepts.sql, with sample users and papers
-- loaded. These statements are demonstrations, not part of the migration.

-- Concept 1 + 2: GIN-backed full-text search through the ranked SQL function.
-- Expected: matching papers first, title terms ranked more heavily than abstract terms.
SELECT *
FROM search_papers('graph neural networks', NULL, NULL, 5);

-- Show the index-backed plan directly. Disabling sequential scans only for
-- EXPLAIN makes the GIN access path visible on a small classroom dataset; do
-- not use this planner setting in normal application sessions.
SET enable_seqscan = off;
EXPLAIN
SELECT paper_id, title
FROM papers
WHERE search_document @@ plainto_tsquery('english', 'graph neural networks');
RESET enable_seqscan;

-- Concept 3: trigger-based audit logging. The update and its audit row commit
-- or roll back together. Pick an existing paper; this example rolls back.
BEGIN;
UPDATE papers
SET abstract = abstract || ' [audit demonstration]'
WHERE paper_id = (SELECT min(paper_id) FROM papers);

SELECT paper_id, operation, changed_by, changed_at,
       old_row ->> 'title' AS old_title,
       new_row ->> 'abstract' AS revised_abstract
FROM paper_audit_log
WHERE paper_id = (SELECT min(paper_id) FROM papers)
ORDER BY audit_id DESC
LIMIT 1;
ROLLBACK;

-- Concept 4: transaction-local identity plus RLS and the ownership-checked
-- bookmark function. Replace the sample user's id with an existing user id.
-- SET LOCAL (used by set_config(..., true)) resets automatically at transaction end.
BEGIN;
SELECT set_config(
  'app.user_id',
  (SELECT min(user_id)::text FROM users),
  true
);
SELECT save_paper_bookmark(
  (SELECT min(user_id) FROM users),
  (SELECT min(paper_id) FROM papers),
  NULL
);
SELECT user_id, paper_id, collection_id
FROM bookmarks
ORDER BY saved_at DESC
LIMIT 10;
ROLLBACK;

-- Concept 5: explicit isolation and row locking for a multi-step write. Run
-- this transaction from one psql session; a concurrent writer targeting the
-- selected paper waits for the row lock until COMMIT/ROLLBACK. This demo rolls
-- back so it leaves the database unchanged; use COMMIT for a real write.
BEGIN ISOLATION LEVEL SERIALIZABLE;
SELECT paper_id
FROM papers
WHERE paper_id = (SELECT min(paper_id) FROM papers)
FOR UPDATE;

SELECT set_config(
  'app.user_id',
  (SELECT min(user_id)::text FROM users),
  true
);
SELECT save_paper_bookmark(
  (SELECT min(user_id) FROM users),
  (SELECT min(paper_id) FROM papers),
  NULL
);
ROLLBACK;

-- Query the indexes the database created for the paper table.
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = current_schema()
  AND tablename = 'papers'
ORDER BY indexname;

-- Query the resulting audit trail.
SELECT paper_id, operation, changed_by, changed_at
FROM paper_audit_log
ORDER BY audit_id DESC
LIMIT 10;
