# Report Contribution: MySQL 8

MySQL is the relational source of truth for user and paper records. The schema normalizes authors and paper-author ordering, models collections and bookmarks, and stores interests, research groups, memberships, and discussions. Primary/foreign keys, unique and check constraints, and indexes protect data integrity and support common lookups. Query examples use bound parameters; bookmark writes are idempotent using `ON DUPLICATE KEY UPDATE`.

The app's MySQL keyword route uses an InnoDB FULLTEXT index on paper titles and abstracts. The advanced SQL scripts implement ranked search and ownership-checked bookmark stored procedures, JSON audit triggers for paper updates/deletes, a paper-engagement view, and InnoDB transactions with `SELECT ... FOR UPDATE` row locks.

Run `advanced_concepts.sql` after the schema and sample paper data, load `advanced_concepts_demo_seed.sql`, and execute `advanced_concepts_demo.sql` as described in `database/mysql/ADVANCED_CONCEPTS.md`. The sample update and bookmark roll back; add actual output only after running the demo on the target MySQL instance.
