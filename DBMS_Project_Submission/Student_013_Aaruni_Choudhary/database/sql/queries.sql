-- MySQL 8 examples for the relational database.
-- Bind each ? value in the application layer; never concatenate user input.

-- 1. Search titles and abstracts. The API expands a phrase into bound terms.
SELECT p.paper_id, p.title, p.publication_year, p.venue
FROM papers AS p
WHERE p.title LIKE ? OR p.abstract LIKE ?
ORDER BY p.publication_year DESC, p.paper_id DESC
LIMIT 20;

-- 2. Fetch a paper and its authors in author order.
SELECT p.paper_id, p.title, p.abstract, p.doi, p.publication_year,
       a.display_name, pa.author_order
FROM papers AS p
LEFT JOIN paper_authors AS pa ON pa.paper_id = p.paper_id
LEFT JOIN authors AS a ON a.author_id = pa.author_id
WHERE p.paper_id = ?
ORDER BY pa.author_order;

-- 3. List a researcher's saved papers and optional collection.
SELECT p.paper_id, p.title, p.publication_year,
       c.collection_id, c.name AS collection_name, b.saved_at
FROM bookmarks AS b
JOIN papers AS p ON p.paper_id = b.paper_id
LEFT JOIN collections AS c
  ON c.collection_id = b.collection_id AND c.owner_id = b.user_id
WHERE b.user_id = ?
ORDER BY b.saved_at DESC;

-- 4. Save a bookmark idempotently. Verify collection ownership in the same
-- application transaction before writing; use NULL for the default library.
START TRANSACTION;
INSERT INTO bookmarks (user_id, paper_id, collection_id)
VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE
  collection_id = VALUES(collection_id),
  saved_at = CURRENT_TIMESTAMP;
COMMIT;

-- 5. Show group members.
SELECT u.user_id, u.full_name, gm.member_role, gm.joined_at
FROM group_members AS gm
JOIN users AS u ON u.user_id = gm.user_id
WHERE gm.group_id = ?
ORDER BY gm.joined_at, u.full_name;

-- 6. Show the latest discussion entries for a paper.
SELECT d.discussion_id, d.body, d.created_at, u.user_id, u.full_name
FROM discussions AS d
JOIN users AS u ON u.user_id = d.author_id
WHERE d.paper_id = ?
ORDER BY d.created_at DESC
LIMIT 50;

-- 7. Add an author and associate the author with a paper.
START TRANSACTION;
INSERT INTO authors (display_name)
VALUES (?)
ON DUPLICATE KEY UPDATE author_id = LAST_INSERT_ID(author_id);
SET @author_id = LAST_INSERT_ID();
INSERT INTO paper_authors (paper_id, author_id, author_order)
VALUES (?, @author_id, ?)
ON DUPLICATE KEY UPDATE author_order = VALUES(author_order);
COMMIT;
