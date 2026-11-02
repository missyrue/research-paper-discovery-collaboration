-- Advanced database concepts for the Research Paper Discovery system.
-- Apply schema.sql first. This migration is PostgreSQL-specific.

-- 1. Full-text search data + GIN index.
-- A trigger below keeps the weighted document current on inserts/updates.
ALTER TABLE papers
  ADD COLUMN IF NOT EXISTS search_document tsvector;

CREATE OR REPLACE FUNCTION refresh_paper_search_document()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_document :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.abstract, '')), 'B');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS papers_search_document_refresh ON papers;
CREATE TRIGGER papers_search_document_refresh
BEFORE INSERT OR UPDATE OF title, abstract ON papers
FOR EACH ROW
EXECUTE FUNCTION refresh_paper_search_document();

-- Backfill existing rows without needlessly rewriting already-current rows.
UPDATE papers
SET search_document =
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(abstract, '')), 'B')
WHERE search_document IS DISTINCT FROM
      (setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
       setweight(to_tsvector('english', coalesce(abstract, '')), 'B'));

CREATE INDEX IF NOT EXISTS idx_papers_search_document_gin
  ON papers USING GIN (search_document);

-- 2. Stored function: ranked full-text search with optional year bounds.
CREATE OR REPLACE FUNCTION search_papers(
  p_query text,
  p_year_from smallint DEFAULT NULL,
  p_year_to smallint DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  paper_id bigint,
  title text,
  publication_year smallint,
  venue text,
  relevance real
)
LANGUAGE sql
STABLE
AS $$
  SELECT p.paper_id,
         p.title,
         p.publication_year,
         p.venue,
         ts_rank(p.search_document, plainto_tsquery('english', p_query)) AS relevance
  FROM papers AS p
  WHERE nullif(trim(p_query), '') IS NOT NULL
    AND p.search_document @@ plainto_tsquery('english', p_query)
    AND (p_year_from IS NULL OR p.publication_year >= p_year_from)
    AND (p_year_to IS NULL OR p.publication_year <= p_year_to)
  ORDER BY relevance DESC, p.publication_year DESC NULLS LAST, p.paper_id
  LIMIT least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

-- 3. Audit trail with a row-level trigger. No FK is used for paper_id so the
-- audit record remains after a source paper is deleted.
CREATE TABLE IF NOT EXISTS paper_audit_log (
  audit_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  paper_id BIGINT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('UPDATE', 'DELETE')),
  old_row JSONB NOT NULL,
  new_row JSONB,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  changed_by TEXT NOT NULL DEFAULT current_user
);

CREATE INDEX IF NOT EXISTS idx_paper_audit_log_paper_time
  ON paper_audit_log (paper_id, changed_at DESC);

CREATE OR REPLACE FUNCTION audit_paper_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO paper_audit_log (paper_id, operation, old_row)
    VALUES (OLD.paper_id, TG_OP, to_jsonb(OLD));
    RETURN OLD;
  END IF;

  INSERT INTO paper_audit_log (paper_id, operation, old_row, new_row)
  VALUES (NEW.paper_id, TG_OP, to_jsonb(OLD), to_jsonb(NEW));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS papers_audit_changes ON papers;
CREATE TRIGGER papers_audit_changes
AFTER UPDATE OR DELETE ON papers
FOR EACH ROW
EXECUTE FUNCTION audit_paper_change();

-- 4. Stored function for an ownership-checked, idempotent bookmark write.
-- The application must set app.user_id inside the transaction/connection before
-- calling this function. Collection ownership is checked before the write.
CREATE OR REPLACE FUNCTION save_paper_bookmark(
  p_user_id bigint,
  p_paper_id bigint,
  p_collection_id bigint DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_user_id bigint;
BEGIN
  v_current_user_id := nullif(current_setting('app.user_id', true), '')::bigint;
  IF v_current_user_id IS NULL OR v_current_user_id <> p_user_id THEN
    RAISE EXCEPTION 'bookmark user does not match the active application user';
  END IF;

  IF p_collection_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM collections AS c
    WHERE c.collection_id = p_collection_id
      AND c.owner_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'collection is missing or is not owned by this user';
  END IF;

  INSERT INTO bookmarks (user_id, paper_id, collection_id)
  VALUES (p_user_id, p_paper_id, p_collection_id)
  ON CONFLICT (user_id, paper_id) DO UPDATE
  SET collection_id = EXCLUDED.collection_id,
      saved_at = CURRENT_TIMESTAMP;
END;
$$;

-- 5. Row-level security: each database request sees/changes only the bookmarks
-- for the user id set in its transaction-local app.user_id setting.
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bookmarks_user_isolation ON bookmarks;
CREATE POLICY bookmarks_user_isolation ON bookmarks
  USING (user_id = nullif(current_setting('app.user_id', true), '')::bigint)
  WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '')::bigint);
