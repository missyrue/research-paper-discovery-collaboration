# Advanced MySQL concepts

The advanced SQL scripts implement and demonstrate five concepts against the
project's MySQL 8 schema:

| Concept | Implementation | Demonstration |
|---|---|---|
| Full-text indexing | InnoDB `FULLTEXT` index on paper title and abstract; the app uses `MATCH ... AGAINST` | `EXPLAIN` and the keyword-search route |
| Stored procedures | Ranked search and ownership-checked bookmark writes | `CALL sp_search_papers(...)` and `CALL sp_save_paper_bookmark(...)` |
| Audit triggers | Update/delete triggers write old/new paper values to JSON | Update a paper in a transaction, inspect the audit row, then roll back |
| Views | `v_paper_engagement` joins papers to authors and bookmark totals | Select from the view |
| Transactions and row locks | InnoDB transaction with `SELECT ... FOR UPDATE` | Run the bookmark demo; a competing update waits until rollback |

## Run on another system

Use MySQL 8 with InnoDB. From a terminal at the repository root, the following
commands create a fresh local demo database and load the project schema, sample
papers, routines, triggers, and demo user:

```sh
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS atlas_research CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci"
mysql -u root -p atlas_research < database/mysql/schema.sql
mysql -u root -p atlas_research -e "INSERT IGNORE INTO roles (role_name) VALUES ('Researcher'), ('Admin')"
mysql -u root -p atlas_research < database/mysql/seed.sql
mysql -u root -p atlas_research < database/mysql/advanced_concepts.sql
mysql -u root -p atlas_research < database/mysql/advanced_concepts_demo_seed.sql
mysql -u root -p atlas_research < database/mysql/advanced_concepts_demo.sql
```

On PowerShell, use a pipeline such as
`Get-Content -Raw database/mysql/schema.sql | mysql -u root -p atlas_research`
for each SQL file instead of the `< file` redirection syntax. The project's
Windows setup script also installs these advanced objects automatically.

The demo script can also be run as the app user after granting it `EXECUTE` on
both procedures and the needed table permissions:

```sh
mysql -u atlas_app -p atlas_research < database/mysql/advanced_concepts_demo.sql
```

The demo update and bookmark are rolled back. To see row-lock contention,
start the transaction and `SELECT ... FOR UPDATE` from the demo in one MySQL
session, then attempt an `UPDATE papers ...` for that same `paper_id` in another
session before rolling the first transaction back.

The sample user has a placeholder `password_hash` value that cannot be used to
sign in. For app requests, derive `p_user_id` from the verified server session;
never accept the user id from an untrusted browser parameter. The bookmark
procedure checks collection ownership and locks the collection row until the
caller commits or rolls back.
