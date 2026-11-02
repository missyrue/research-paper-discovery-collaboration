-- Run as the database owner/admin after creating research_db and loading the
-- schema/migration/seed files. This role is only for the local SQL demo.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'advanced_concepts_demo'
  ) THEN
    CREATE ROLE advanced_concepts_demo
      LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END;
$$;

ALTER ROLE advanced_concepts_demo
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

GRANT CONNECT ON DATABASE research_db TO advanced_concepts_demo;
GRANT USAGE ON SCHEMA public TO advanced_concepts_demo;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public TO advanced_concepts_demo;
GRANT USAGE, SELECT
  ON ALL SEQUENCES IN SCHEMA public TO advanced_concepts_demo;
GRANT EXECUTE ON FUNCTION search_papers(text, smallint, smallint, integer)
  TO advanced_concepts_demo;
GRANT EXECUTE ON FUNCTION save_paper_bookmark(bigint, bigint, bigint)
  TO advanced_concepts_demo;
