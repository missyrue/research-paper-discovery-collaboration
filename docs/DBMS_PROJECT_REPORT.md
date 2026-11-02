# DBMS Mini Project Report

## 1. Title

**Research Paper Discovery & Collaboration System**
A web application prototype for academic paper discovery, organization, and researcher collaboration.

## 2. Students

| SRN | Name |
|---|---|
| PES2UG24CS013 | Aaruni Choudhary |
| PES2UG24CS060 | Anchita Chhibba |

## 3. Abstract

Academic literature is growing rapidly, while keyword-only discovery can miss useful work described with different terminology. Atlas is a web application for searching and organizing research papers, with a relational design that also supports interests, collections, research groups, and discussions. The Next.js application searches sample papers from local MySQL using parameterized keyword queries and includes a semantic retrieval path that embeds queries, ranks paper IDs with MongoDB Atlas Vector Search, and loads canonical paper details from MySQL. Paper embedding ingestion is available to administrators. The vector feature requires local Atlas and embedding API credentials and an active vector index before it can be demonstrated. Accounts use database-backed `Researcher` and `Admin` roles; admin-only APIs manage paper records. Passwords use scrypt hashes and sessions use signed HTTP-only cookies. Group collaboration workflows are future work.

## 4. Tech Stack

| Component | Proposed technology | Responsibility |
|---|---|---|
| Web client | Next.js App Router, React, TypeScript | Search UI, paper details, collections, groups, discussions |
| Relational database | MySQL 8 | Users/roles, papers/authors, interests, bookmarks, collections, groups, discussions |
| Vector store | MongoDB Atlas Vector Search | Stores paper embeddings and returns nearest-neighbor paper IDs |
| Application layer | Next.js server routes/actions | Parameterized MySQL search, registration/sign-in, and Admin-only paper management |
| Password and session handling | Node.js crypto (scrypt and HMAC) | Salted password hashes and signed, HTTP-only session cookies |
| Embeddings | OpenAI `text-embedding-3-small` | Embeds paper title/abstract and query text at 1536 dimensions |

The supplied brief does not prescribe specific vendors or framework versions. The stack above is a proposed implementation choice.

## 5. SQL Database Commands

The MySQL DDL and representative search/bookmark commands are in [`../database/mysql/schema.sql`](../database/mysql/schema.sql) and [`../database/sql/queries.sql`](../database/sql/queries.sql). A local setup script creates a restricted app account and loads sample papers. Example:

```sql
CREATE TABLE papers (
  paper_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title TEXT NOT NULL,
  abstract TEXT NOT NULL DEFAULT '',
  doi VARCHAR(255) UNIQUE,
  publication_year SMALLINT CHECK (publication_year BETWEEN 1000 AND 2200)
);

SELECT paper_id, title, publication_year
FROM papers
WHERE title LIKE CONCAT('%', ?, '%')
   OR abstract LIKE CONCAT('%', ?, '%')
ORDER BY publication_year DESC
LIMIT 20;
```

The schema also defines roles, users, authors, paper-author relationships, interests, paper topics, collections, bookmarks, research groups, group memberships, and discussions, with foreign keys, uniqueness rules, checks, and indexes. The Next.js API uses parameterized MySQL queries. Do not store plaintext passwords.

## 6. NoSQL / Vector Database Commands

The application uses MongoDB Atlas Vector Search for semantic retrieval. Admins can generate and upsert embeddings for the MySQL paper library through a keyset-paginated API that skips unchanged paper text. The index uses cosine similarity and 1536 dimensions from OpenAI `text-embedding-3-small`; Atlas stores each embedding with its MySQL `paper_id`, title, abstract, topics, and model metadata. Search embeds the user query, retrieves ranked IDs from Atlas, and loads authoritative paper details from MySQL. Signed-in accounts are limited to 30 semantic searches per UTC day using a MySQL usage table. Before the feature can run on another machine, configure `OPENAI_API_KEY`, `MONGODB_URI`, and the other values in `.env.example`, then create the Atlas index from [`../database/vector/atlas-vector-index.json`](../database/vector/atlas-vector-index.json). The implementation and setup steps are documented in [`../database/vector/README.md`](../database/vector/README.md).

## 7. Next.js Project Tree

Implemented Next.js app tree:

```text
apps/web/
├── app/
│   ├── api/papers/route.ts
│   ├── api/health/route.ts
│   ├── api/auth/route.ts
│   ├── api/admin/papers/route.ts
│   ├── api/admin/vector-index/route.ts
│   ├── admin/page.tsx
│   ├── login/page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── lib/db.ts
├── lib/auth.ts
├── lib/authorization.ts
├── lib/embeddings.ts
├── lib/vector-db.ts
├── package.json
└── .env.example

database/
├── mysql/schema.sql
├── mysql/seed.sql
├── mysql/promote-admin.sql
├── mysql/AUTHORIZATION.md
└── vector/atlas-vector-search.js
```

## 8. Sample Screenshots: Code and Demo

The following captures show the Atlas discovery interface and paper results. The two discovery captures show three sample papers loaded from the local MySQL database and labeled as MySQL keyword results.

![Atlas discovery page showing the MySQL paper search interface](../screenshots/atlas-discovery-mysql.png)

![Atlas paper search results returned from the MySQL sample library](../screenshots/atlas-paper-results.png)

The login image records the earlier sign-in screen, which still displayed a prototype notice at the time it was captured. The current code includes account registration and sign-in through `apps/web/app/api/auth/route.ts`; verify these flows against the configured local database before treating the image as authentication evidence. The search implementation is in `apps/web/app/api/papers/route.ts`, with connection settings loaded by `apps/web/lib/db.ts`. Screenshots do not show credentials or private user data. Add a semantic-search capture after Atlas and the embedding API are configured and the index has been populated.

![Earlier Atlas sign-in screen prototype, before database authentication was connected](../screenshots/atlas-login-prototype.png)

## Repository

Recommended repository name: **`research-paper-discovery-collaboration`**. This name describes the project clearly and is suitable for a resume link. The local Git repository can be published under the same name on GitHub when ready.
