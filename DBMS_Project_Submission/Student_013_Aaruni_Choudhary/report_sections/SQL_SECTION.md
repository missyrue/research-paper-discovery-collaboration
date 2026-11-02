# Report Contribution: MySQL 8

MySQL is the relational source of truth for user and paper records. The schema normalizes authors and paper-author ordering, models collections and bookmarks, and stores interests, research groups, memberships, and discussions. Primary/foreign keys, unique and check constraints, and indexes protect data integrity and support common lookups. Query examples use bound parameters; bookmark writes are idempotent using `ON DUPLICATE KEY UPDATE`.

The schema and queries are used by the app's MySQL search route. Add database execution results after running the local setup script and confirming `/api/health` reports a connection.
