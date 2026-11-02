# Report Contribution: MySQL 8

MySQL is the relational source of truth for user and paper records. The schema normalizes authors and paper-author ordering, models collections and bookmarks, and stores interests, research groups, memberships, and discussions. Primary/foreign keys, unique and check constraints, and indexes protect data integrity and support common lookups. Query examples use bound parameters; bookmark writes are idempotent using `ON DUPLICATE KEY UPDATE`.

The app's keyword-search route reads the seeded MySQL paper library. The local setup was verified against MySQL 8.4.9: `/api/health` reported `connected`, and the `papers` table contained 3 records.
