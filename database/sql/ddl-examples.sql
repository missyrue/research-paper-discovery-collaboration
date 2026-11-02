-- DDL examples for the DBMS report. These are for a disposable staging table,
-- not the application's production schema. Review before running in MySQL.

CREATE TABLE IF NOT EXISTS paper_import_staging (
  staging_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title TEXT NOT NULL
);

ALTER TABLE paper_import_staging
  ADD COLUMN source_name VARCHAR(120) NULL;

-- Demonstrates DROP. This removes only the optional demo staging table above.
DROP TABLE IF EXISTS paper_import_staging;
