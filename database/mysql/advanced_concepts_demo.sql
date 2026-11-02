-- Run after schema.sql, seed.sql, advanced_concepts.sql, and
-- advanced_concepts_demo_seed.sql. All UPDATE and DELETE effects are rolled back.

-- 1. JOIN: list papers with each ordered author.
SELECT p.paper_id, p.title, a.display_name, pa.author_order
FROM papers AS p
JOIN paper_authors AS pa ON pa.paper_id = p.paper_id
JOIN authors AS a ON a.author_id = pa.author_id
ORDER BY p.paper_id, pa.author_order;

-- 2. GROUP BY + aggregate: count authors for each paper, including papers
-- without an author row (LEFT JOIN keeps them in the result).
SELECT p.paper_id, p.title, COUNT(pa.author_id) AS author_count
FROM papers AS p
LEFT JOIN paper_authors AS pa ON pa.paper_id = p.paper_id
GROUP BY p.paper_id, p.title
ORDER BY author_count DESC, p.paper_id;

-- 3. Correlated and nested subqueries: papers whose author count exceeds the
-- average author count across papers that have at least one author.
SELECT p.paper_id, p.title
FROM papers AS p
WHERE (SELECT COUNT(*)
       FROM paper_authors AS pa
       WHERE pa.paper_id = p.paper_id) >
      (SELECT AVG(author_totals.author_count)
       FROM (SELECT COUNT(*) AS author_count
             FROM paper_authors
             GROUP BY paper_id) AS author_totals)
ORDER BY p.paper_id;

-- Concept 1: the same FULLTEXT index used by the app route.
EXPLAIN
SELECT p.paper_id, p.title,
       MATCH(p.title, p.abstract) AGAINST ('graph neural networks' IN NATURAL LANGUAGE MODE) AS relevance
FROM papers AS p
WHERE MATCH(p.title, p.abstract) AGAINST ('graph neural networks' IN NATURAL LANGUAGE MODE)
ORDER BY relevance DESC
LIMIT 5;

-- Concept 2: ranked stored-procedure search with a publication-year filter.
CALL sp_search_papers('graph neural networks', NULL, NULL, 5);

-- Concept 3: a view that reports paper author/bookmark totals.
SELECT * FROM v_paper_engagement ORDER BY bookmark_count DESC, paper_id;

-- 4. UPDATE + trigger: both the paper change and its audit event disappear
-- at ROLLBACK because both tables use InnoDB.
SET @audit_demo_paper_id = (SELECT MIN(paper_id) FROM papers);
START TRANSACTION;
UPDATE papers
SET abstract = CONCAT(abstract, ' [audit demonstration]')
WHERE paper_id = @audit_demo_paper_id;

SELECT paper_id, operation, changed_by, changed_at,
       JSON_UNQUOTE(JSON_EXTRACT(old_row, '$.title')) AS old_title,
       JSON_UNQUOTE(JSON_EXTRACT(new_row, '$.abstract')) AS revised_abstract
FROM paper_audit_log
WHERE paper_id = @audit_demo_paper_id
ORDER BY audit_id DESC
LIMIT 1;
ROLLBACK;

-- 5. DELETE + trigger: inspect the DELETE audit event before rollback. The
-- parent row and its cascaded child rows are restored by the rollback too.
SET @delete_demo_paper_id = (SELECT MAX(paper_id) FROM papers);
START TRANSACTION;
DELETE FROM papers WHERE paper_id = @delete_demo_paper_id;
SELECT paper_id, operation, changed_by, changed_at,
       JSON_UNQUOTE(JSON_EXTRACT(old_row, '$.title')) AS deleted_title
FROM paper_audit_log
WHERE paper_id = @delete_demo_paper_id AND operation = 'DELETE'
ORDER BY audit_id DESC
LIMIT 1;
ROLLBACK;

-- 6. Transaction scope, row locking, and ownership-checked procedure.
-- The procedure call is intentionally inside the transaction so its row lock
-- remains active until this rollback. In a second client, try updating the same
-- paper between START TRANSACTION and ROLLBACK to observe it wait.
SET @demo_user_id = (
  SELECT user_id FROM users
  WHERE email = 'advanced-db-demo@example.invalid'
);
SET @demo_paper_id = (
  SELECT paper_id FROM papers
  WHERE doi = '10.5555/atlas.2017.001'
);
START TRANSACTION;
SELECT paper_id FROM papers WHERE paper_id = @demo_paper_id FOR UPDATE;
CALL sp_save_paper_bookmark(@demo_user_id, @demo_paper_id, NULL);
SELECT user_id, paper_id, collection_id
FROM bookmarks
WHERE user_id = @demo_user_id AND paper_id = @demo_paper_id;
ROLLBACK;

-- 7. Inspect the deployed indexes, including the FULLTEXT index.
SELECT index_name, index_type, column_name, seq_in_index
FROM information_schema.statistics
WHERE table_schema = DATABASE() AND table_name = 'papers'
ORDER BY index_name, seq_in_index;

-- Existing, committed audit events (the rolled-back demo event is absent).
SELECT paper_id, operation, changed_by, changed_at
FROM paper_audit_log
ORDER BY audit_id DESC
LIMIT 10;
