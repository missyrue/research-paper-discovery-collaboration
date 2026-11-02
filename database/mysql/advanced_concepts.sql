-- Advanced concepts for the MySQL 8 Research Paper Discovery database.
-- Apply schema.sql and seed.sql before this file. InnoDB is required so the
-- audit records participate in transactions and SELECT ... FOR UPDATE locks rows.

-- Ensure the FULLTEXT index exists when upgrading an existing local database.
SET @has_paper_fulltext_index = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'papers'
    AND index_name = 'ft_papers_title_abstract'
);
SET @paper_fulltext_ddl = IF(
  @has_paper_fulltext_index = 0,
  'ALTER TABLE papers ADD FULLTEXT INDEX ft_papers_title_abstract (title, abstract)',
  'SELECT 1'
);
PREPARE paper_fulltext_stmt FROM @paper_fulltext_ddl;
EXECUTE paper_fulltext_stmt;
DEALLOCATE PREPARE paper_fulltext_stmt;

CREATE TABLE IF NOT EXISTS paper_audit_log (
  audit_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  paper_id BIGINT UNSIGNED NOT NULL,
  operation ENUM('UPDATE', 'DELETE') NOT NULL,
  old_row JSON NOT NULL,
  new_row JSON,
  changed_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  changed_by VARCHAR(288) NOT NULL,
  INDEX idx_paper_audit_paper_time (paper_id, changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TRIGGER IF EXISTS trg_papers_audit_update;
DROP TRIGGER IF EXISTS trg_papers_audit_delete;

DELIMITER $$

-- 1. Audit triggers retain before/after paper values as JSON.
CREATE TRIGGER trg_papers_audit_update
AFTER UPDATE ON papers
FOR EACH ROW
BEGIN
  INSERT INTO paper_audit_log (paper_id, operation, old_row, new_row, changed_by)
  VALUES (
    OLD.paper_id,
    'UPDATE',
    JSON_OBJECT(
      'title', OLD.title, 'abstract', OLD.abstract, 'doi', OLD.doi,
      'publication_year', OLD.publication_year, 'venue', OLD.venue,
      'paper_url', OLD.paper_url
    ),
    JSON_OBJECT(
      'title', NEW.title, 'abstract', NEW.abstract, 'doi', NEW.doi,
      'publication_year', NEW.publication_year, 'venue', NEW.venue,
      'paper_url', NEW.paper_url
    ),
    USER()
  );
END$$

CREATE TRIGGER trg_papers_audit_delete
AFTER DELETE ON papers
FOR EACH ROW
BEGIN
  INSERT INTO paper_audit_log (paper_id, operation, old_row, new_row, changed_by)
  VALUES (
    OLD.paper_id,
    'DELETE',
    JSON_OBJECT(
      'title', OLD.title, 'abstract', OLD.abstract, 'doi', OLD.doi,
      'publication_year', OLD.publication_year, 'venue', OLD.venue,
      'paper_url', OLD.paper_url
    ),
    NULL,
    USER()
  );
END$$

-- 2. Stored procedure for parameterized, ranked full-text retrieval.
DROP PROCEDURE IF EXISTS sp_search_papers$$
CREATE PROCEDURE sp_search_papers(
  IN p_query VARCHAR(255),
  IN p_year_from SMALLINT UNSIGNED,
  IN p_year_to SMALLINT UNSIGNED,
  IN p_limit INT UNSIGNED
)
READS SQL DATA
BEGIN
  DECLARE v_limit INT UNSIGNED DEFAULT 20;
  SET v_limit = LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);

  SELECT p.paper_id,
         p.title,
         p.publication_year,
         p.venue,
         MATCH(p.title, p.abstract) AGAINST (p_query IN NATURAL LANGUAGE MODE) AS relevance
  FROM papers AS p
  WHERE p_query IS NOT NULL
    AND TRIM(p_query) <> ''
    AND MATCH(p.title, p.abstract) AGAINST (p_query IN NATURAL LANGUAGE MODE)
    AND (p_year_from IS NULL OR p.publication_year >= p_year_from)
    AND (p_year_to IS NULL OR p.publication_year <= p_year_to)
  ORDER BY relevance DESC, p.publication_year DESC, p.paper_id
  LIMIT v_limit;
END$$

-- 3. Stored procedure for an atomic, idempotent bookmark write. Call it inside
-- an application transaction. The collection row lock protects the ownership
-- check from concurrent collection changes until the caller commits/rolls back.
DROP PROCEDURE IF EXISTS sp_save_paper_bookmark$$
CREATE PROCEDURE sp_save_paper_bookmark(
  IN p_user_id BIGINT UNSIGNED,
  IN p_paper_id BIGINT UNSIGNED,
  IN p_collection_id BIGINT UNSIGNED
)
MODIFIES SQL DATA
BEGIN
  DECLARE v_collection_owner BIGINT UNSIGNED DEFAULT NULL;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_collection_owner = NULL;

  IF p_collection_id IS NOT NULL THEN
    SELECT owner_id INTO v_collection_owner
    FROM collections
    WHERE collection_id = p_collection_id
    FOR UPDATE;

    IF v_collection_owner IS NULL OR v_collection_owner <> p_user_id THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Collection is missing or is not owned by this user';
    END IF;
  END IF;

  INSERT INTO bookmarks (user_id, paper_id, collection_id)
  VALUES (p_user_id, p_paper_id, p_collection_id)
  ON DUPLICATE KEY UPDATE
    collection_id = VALUES(collection_id),
    saved_at = CURRENT_TIMESTAMP;
END$$

DELIMITER ;

-- 4. View: pre-aggregated catalog metadata for papers, authors, and bookmarks.
CREATE OR REPLACE VIEW v_paper_engagement AS
SELECT p.paper_id,
       p.title,
       p.publication_year,
       p.venue,
       COUNT(DISTINCT pa.author_id) AS author_count,
       COUNT(DISTINCT b.user_id) AS bookmark_count
FROM papers AS p
LEFT JOIN paper_authors AS pa ON pa.paper_id = p.paper_id
LEFT JOIN bookmarks AS b ON b.paper_id = p.paper_id
GROUP BY p.paper_id, p.title, p.publication_year, p.venue;
