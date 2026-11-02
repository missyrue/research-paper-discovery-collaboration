# Advanced PostgreSQL concepts

`advanced_concepts.sql` implements five database concepts against the project
schema. `advanced_concepts_demo.sql` contains read/write examples; the write
examples roll back so the demo leaves its sample database unchanged.

| Concept | Implementation | Demonstration |
|---|---|---|
| Full-text indexing | Weighted `tsvector` maintained by a trigger and a GIN index | `search_papers(...)` and `EXPLAIN` in the demo |
| Stored functions | Ranked search and ownership-checked bookmark functions | Calls to `search_papers` and `save_paper_bookmark` |
| Trigger-based auditing | Captures paper updates/deletes as JSONB old/new rows | Update a paper inside a transaction and inspect its audit row |
| Row-level security | `bookmarks` policy scopes rows to transaction-local `app.user_id` | Set the user context, read/write bookmarks, then roll back |
| Transaction isolation and locking | `SERIALIZABLE` transaction with `SELECT ... FOR UPDATE` | Final transaction in the demo |

## Run on a different machine

Use PostgreSQL 12 or newer and `psql`. From the repository root, create a new
empty database named `research_db`, then run:

```sh
psql -d research_db -v ON_ERROR_STOP=1 \
  -f database/sql/schema.sql \
  -f database/sql/advanced_concepts.sql \
  -f database/sql/advanced_concepts_seed.sql
```

Run the demonstration using a database login that is not a superuser and does
not have `BYPASSRLS`. Table owners are also subject to the policy because the
migration enables `FORCE ROW LEVEL SECURITY`:

```sh
psql -d research_db -v ON_ERROR_STOP=1 \
  -f database/sql/advanced_concepts_demo_role.sql
psql -d research_db -U advanced_concepts_demo \
  -v ON_ERROR_STOP=1 -f database/sql/advanced_concepts_demo.sql
```

The role setup script must be run by a database owner/admin. Set a local
password for the demo role interactively at the `psql` prompt with
`\password advanced_concepts_demo`, or use the machine's existing local
authentication method. Do not use the `postgres` superuser for the RLS demo;
PostgreSQL superusers always bypass row-level security. The app must set
`app.user_id` from the authenticated server session inside each transaction
before accessing bookmarks; never trust a user id supplied directly by the
browser. With connection pools, set it transaction-locally for every request.

The seed user's password value is a non-authenticating placeholder, not a
password hash. The seed file is for a fresh local demo database only. The
demo's write transactions use `ROLLBACK`; change them to `COMMIT` only when you
intend to persist the demonstrated writes.
