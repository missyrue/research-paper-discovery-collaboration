# Report Contribution: PostgreSQL

PostgreSQL is the relational source of truth for user and paper records. The schema normalizes authors and paper-author ordering, models collections and bookmarks, and stores interests, research groups, memberships, and discussions. Primary/foreign keys, unique and check constraints, and indexes protect data integrity and support common lookups. Query examples use bound parameters; bookmark writes are idempotent using `ON CONFLICT`.

The advanced SQL deliverables implement and demonstrate five concepts:

1. Weighted PostgreSQL full-text search, maintained by a trigger and accelerated by a GIN index.
2. Stored SQL/PL/pgSQL functions for ranked search and ownership-checked, idempotent bookmarking.
3. An audit trigger that records old and new paper values in JSONB when papers change or are deleted.
4. Row-level security on bookmarks, scoped by the transaction-local authenticated user id.
5. A serializable transaction with `SELECT ... FOR UPDATE` to show isolation and row locking.

Run `advanced_concepts.sql` after `schema.sql`, load `advanced_concepts_seed.sql`, and run `advanced_concepts_demo.sql` using a non-superuser PostgreSQL login. The demo rolls back its write examples. These files are executable examples; record actual output only after running them on the target PostgreSQL instance.
