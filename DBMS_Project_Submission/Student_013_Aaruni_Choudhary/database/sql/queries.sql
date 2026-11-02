-- Example PostgreSQL queries for the relational database.
-- Bind parameters in the application layer; never build SQL by concatenating user input.

-- 1. Search titles and abstracts, with optional year bounds.
-- $1 = search phrase, $2 = earliest year (nullable), $3 = latest year (nullable)
SELECT p.paper_id, p.title, p.publication_year, p.venue
FROM papers AS p
WHERE (p.title ILIKE '%' || $1 || '%' OR p.abstract ILIKE '%' || $1 || '%')
  AND ($2::smallint IS NULL OR p.publication_year >= $2)
  AND ($3::smallint IS NULL OR p.publication_year <= $3)
ORDER BY p.publication_year DESC NULLS LAST, p.paper_id DESC
LIMIT 20;

-- 2. Fetch a paper and its authors in author order.
SELECT p.paper_id, p.title, p.abstract, p.doi, p.publication_year,
       a.display_name, pa.author_order
FROM papers AS p
LEFT JOIN paper_authors AS pa ON pa.paper_id = p.paper_id
LEFT JOIN authors AS a ON a.author_id = pa.author_id
WHERE p.paper_id = $1
ORDER BY pa.author_order;

-- 3. List a researcher's saved papers and optional collection.
SELECT p.paper_id, p.title, p.publication_year,
       c.collection_id, c.name AS collection_name, b.saved_at
FROM bookmarks AS b
JOIN papers AS p ON p.paper_id = b.paper_id
LEFT JOIN collections AS c
  ON c.collection_id = b.collection_id AND c.owner_id = b.user_id
WHERE b.user_id = $1
ORDER BY b.saved_at DESC;

-- 4. Save a bookmark idempotently. In a transaction, first verify that the
-- collection belongs to the current user (or pass NULL for no collection).
BEGIN;
INSERT INTO bookmarks (user_id, paper_id, collection_id)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, paper_id) DO UPDATE
SET collection_id = EXCLUDED.collection_id,
    saved_at = CURRENT_TIMESTAMP;
COMMIT;

-- 5. Show group members.
SELECT u.user_id, u.full_name, gm.member_role, gm.joined_at
FROM group_members AS gm
JOIN users AS u ON u.user_id = gm.user_id
WHERE gm.group_id = $1
ORDER BY gm.joined_at, u.full_name;

-- 6. Show the latest discussion entries for a paper.
SELECT d.discussion_id, d.body, d.created_at, u.user_id, u.full_name
FROM discussions AS d
JOIN users AS u ON u.user_id = d.author_id
WHERE d.paper_id = $1
ORDER BY d.created_at DESC
LIMIT 50;

-- 7. Add an author and associate the author with a paper.
-- The unique constraints make repeated imports safe.
BEGIN;
INSERT INTO authors (display_name)
VALUES ($1)
ON CONFLICT (display_name) DO UPDATE
SET display_name = EXCLUDED.display_name
RETURNING author_id;
-- Use the returned author_id and the chosen author_order in the next statement.
INSERT INTO paper_authors (paper_id, author_id, author_order)
VALUES ($2, $3, $4)
ON CONFLICT (paper_id, author_id) DO UPDATE
SET author_order = EXCLUDED.author_order;
COMMIT;
