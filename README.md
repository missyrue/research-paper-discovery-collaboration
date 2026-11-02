# Research Paper Discovery & Collaboration System

Paperloom is a DBMS project for discovering academic papers with MySQL keyword search and optional MongoDB Atlas vector similarity search. MySQL stores canonical paper and user records; Atlas stores embeddings and returns semantically ranked paper IDs.


## Team

| SRN | Student |
|---|---|
| PES2UG24CS013 | Aaruni Choudhary |
| PES2UG24CS060 | Anchita Chhibba |

## Problem

Researchers often search across large collections of papers using exact keywords. A paper that discusses the same idea with different terminology can be difficult to find. Paper discovery, bookmarking, reading-list organization, and research discussion are also commonly spread across separate tools.

The current app searches and filters a seeded MySQL paper library, supports researcher accounts and admin-controlled paper management, and includes a semantic retrieval path backed by Atlas and local Ollama embeddings. Saved papers and collections work in browser-local storage; authenticated database persistence and research collaboration remain future work.

## Implemented and Planned Features

| Feature | Status |
|---|---|
| Keyword search and topic filters | Implemented with MySQL |
| Semantic paper search | Implemented with Ollama embeddings and MongoDB Atlas Vector Search |
| Registration/sign-in and Researcher/Admin roles | Implemented in the application; see authorization setup |
| Admin paper management and vector indexing | Implemented in protected routes and `/admin` |
| Saved papers and collections | Browser-local UI works; authenticated MySQL persistence is future work |
| Interests, groups, and discussions | Schema included; user workflows are future work |
| SQL evaluation demo | Admin page runs JOIN, GROUP BY, subquery, view, UPDATE/DELETE, and trigger examples |

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Web application | Next.js App Router, React, TypeScript | User interface and application routes |
| Relational database | MySQL 8 | Users, roles, papers, authors, bookmarks, collections, groups, and discussions |
| Vector database | MongoDB Atlas Vector Search | Store paper embeddings and retrieve semantically similar papers |
| Embeddings | Local Ollama `nomic-embed-text` | Convert paper title/abstract and queries to 768-dimensional vectors without a paid API key |

The Atlas connection string and MySQL credentials are per-developer secrets in ignored `apps/web/.env.local`; they are not checked into this repository. Ollama runs locally at `http://127.0.0.1:11434`.

## Repository Contents

```text
.
├── apps/
│   └── web/                         # Next.js discovery app and MySQL API
├── database/
│   ├── mysql/                        # MySQL schema, seed data, and local setup
│   ├── sql/schema.sql                # SQL relational schema
│   ├── sql/queries.sql               # Parameterized SQL query statements
│   └── vector/                        # Atlas Vector Search setup and demo
├── docs/
│   └── DBMS_PROJECT_REPORT.md        # DBMS mini project report
└── screenshots/
    ├── 01-login.png
    ├── 02-admin-paper-library.png
    ├── 03-sql-evaluation-join-groupby.png
    ├── 04-sql-evaluation-subqueries.png
    ├── 05-sql-evaluation-update-delete-triggers.png
    ├── 06-sql-evaluation-view.png
    ├── 07-paperloom-discover.png
    ├── 08-mysql-keyword-search.png
    ├── 09-atlas-semantic-search.png
    └── 10-saved-papers-collections.png
```

The checked-in screenshots document sign-in, MySQL Admin and keyword-search screens, the SQL evaluation demo, Atlas semantic search, and saved-paper/collection views.

## Database Design

The local app uses MySQL 8. Apply [`database/mysql/schema.sql`](database/mysql/schema.sql) and [`database/mysql/seed.sql`](database/mysql/seed.sql) using [`database/mysql/setup-local.ps1`](database/mysql/setup-local.ps1). This creates the relational structures for:

- Users and roles
- Papers, authors, and paper-author ordering
- User research interests
- Collections and bookmarks
- Research groups and group members
- Paper discussions

Primary keys, foreign keys, uniqueness constraints, check constraints, and indexes help maintain data integrity and support common lookups. MySQL commands are also included in `database/sql/` for the report.

The database layer also includes MySQL 8 evaluation examples for JOIN, GROUP BY with aggregates, UPDATE, DELETE, correlated and nested subqueries, audit triggers, and other advanced concepts. The Admin page's **Run database evaluation** action displays live query results; its write examples run in transactions and roll back. See [`database/mysql/ADVANCED_CONCEPTS.md`](database/mysql/ADVANCED_CONCEPTS.md).

The app's semantic mode embeds a query locally with Ollama, retrieves ranked paper IDs through Atlas `$vectorSearch`, and resolves paper details from MySQL. Admins can sync embeddings from the MySQL library using `/admin`. Atlas must have the configured 768-dimension vector index, Ollama must be running with `nomic-embed-text`, and `MONGODB_URI` must be configured before this mode will run. No OpenAI API key is required. MySQL remains the source of truth for paper records.

See [`database/vector/README.md`](database/vector/README.md) for configuration, Atlas index creation, embedding ingestion, and semantic search steps.

## Next.js Application

The Next.js App Router interface is in [`apps/web`](apps/web/README.md). Paper search and topic filtering use a parameterized MySQL API route and seeded sample records. Registration assigns the Researcher role; Admin-only APIs and the `/admin` page manage paper records. Passwords use scrypt hashes and sessions use signed HTTP-only cookies. Saving papers remains local to the browser.

```bash
cd apps/web
npm install
npm run dev
```

Before the first run, from the repository root create the local database and
ignored app credentials with
`powershell -ExecutionPolicy Bypass -File database/mysql/setup-local.ps1 -Port 3306`.
The script prompts for the MySQL admin password and writes app credentials to
`apps/web/.env.local`.

To set up the two roles, follow [`database/mysql/AUTHORIZATION.md`](database/mysql/AUTHORIZATION.md). After registering an account, a MySQL administrator promotes the trusted account using the edited `database/mysql/promote-admin.sql` file. Admin-only paper operations are available at `/admin`.

The app uses the Next.js App Router with TypeScript, the `mysql2` driver, and the MongoDB Node driver. Persisted bookmarks and collaboration features remain future work.

## Project Report

See [`docs/DBMS_PROJECT_REPORT.md`](docs/DBMS_PROJECT_REPORT.md) for the required report sections: title, student details, abstract, tech stack, SQL commands, vector database commands, Next.js tree, and screenshots.

## Future Work

1. Verify registration and sign-in against the local MySQL instance.
2. Persist bookmarks and collections for signed-in users.
3. Build research-group, collaboration, and discussion workflows.
4. Capture source-code evidence if required by the instructor.

## Resume Project Name

**Research Paper Discovery & Collaboration System**

Suggested repository name: `research-paper-discovery-collaboration`.

## Team Work Split

The work is divided into two comparable database-focused tracks so each student can own and commit a distinct set of files:

| Student | Owned work | Files / deliverables |
|---|---|---|
| Aaruni Choudhary (PES2UG24CS013) | Relational data model: MySQL tables, keys, constraints, indexes, and application query statements | `database/mysql/`, `database/sql/schema.sql`, `database/sql/queries.sql` |
| Anchita Chhibba (PES2UG24CS060) | Semantic retrieval implementation: vector document model, Atlas index, embedding ingestion, search, and verified retrieval | `database/vector/`, semantic retrieval code and demo evidence |

Each student should commit their own work under their GitHub identity after reviewing it. The relational and vector tracks can be developed independently and integrated through the shared `paper_id` identifier.
