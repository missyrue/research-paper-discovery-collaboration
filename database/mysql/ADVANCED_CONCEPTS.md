# Advanced MySQL 8 evaluation examples

The scripts in this folder implement database objects and provide runnable SQL
examples against the project's MySQL 8 schema. `advanced_concepts.sql` creates
the audit table, update/delete triggers, ranked-search and bookmark procedures,
engagement view, and ensures the paper FULLTEXT index exists. The web app uses
the FULLTEXT index for keyword search. The demo SQL examples are evaluation
queries; the app does not call the bookmark procedure or engagement view.

| Required concept | Runnable example |
|---|---|
| JOIN | Papers, ordered authors, and author names |
| GROUP BY with aggregate | Paper author counts using `COUNT` |
| UPDATE | Modify a sample abstract inside a transaction |
| DELETE | Delete a sample paper inside a transaction |
| Correlated/nested subqueries | Papers with above-average author counts |
| Triggers | Update/delete triggers record old/new JSON values in the audit table |
| Additional implemented concepts | FULLTEXT index, stored procedures, view, transactions, and `SELECT ... FOR UPDATE` |

## Run from the repository root

These commands work with the MySQL command-line client on macOS, Linux, or
Windows. The demo assumes the project's sample records and user roles are
loaded. The `UPDATE`, `DELETE`, and bookmark writes each end with `ROLLBACK`.

```sh
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS atlas_research CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci"
mysql -u root -p atlas_research < database/mysql/schema.sql
mysql -u root -p atlas_research -e "INSERT IGNORE INTO roles (role_name) VALUES ('Researcher'), ('Admin')"
mysql -u root -p atlas_research < database/mysql/seed.sql
mysql -u root -p atlas_research < database/mysql/advanced_concepts.sql
mysql -u root -p atlas_research < database/mysql/advanced_concepts_demo_seed.sql
mysql -u root -p atlas_research < database/mysql/advanced_concepts_demo.sql
```

PowerShell users can run each SQL file with
`Get-Content -Raw database/mysql/schema.sql | mysql -u root -p atlas_research`
(substitute each file path). The Windows app setup script
`database/mysql/setup-local.ps1` automatically loads the schema, sample data,
advanced objects, and demo seed, then grants the app user `EXECUTE` on the two
stored procedures.

The demo's audit events are transactional and disappear when their transaction
rolls back. To observe row-lock contention, run the transaction and
`SELECT ... FOR UPDATE` from the bookmark example in one MySQL session, then
try updating that same paper in another session before rolling back.

The demo account has a placeholder password hash and cannot sign in. In
application code, derive the bookmark procedure's user ID from the verified
server session; do not accept it from an untrusted browser parameter. The
bookmark procedure checks collection ownership and locks the collection row
until the caller commits or rolls back.
