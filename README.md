# Research Paper Discovery & Collaboration System

A DBMS mini project proposal for an integrated platform that helps researchers discover academic papers, organize reading lists, and collaborate around research topics. The system combines relational data management with semantic similarity search so that related papers can be found even when they use different terminology.


## Team

| SRN | Student |
|---|---|
| PES2UG24CS013 | Aaruni Choudhary |
| PES2UG24CS060 | Anchita Chhibba |

## Problem

Researchers often search across large collections of papers using exact keywords. A paper that discusses the same idea with different terminology can be difficult to find. Paper discovery, bookmarking, reading-list organization, and research discussion are also commonly spread across separate tools.

This project proposes one place to search and filter papers, retrieve semantically related work, save papers into collections, record research interests, form groups, and discuss papers with collaborators.

## Proposed Features

- Search and filter papers by keywords and metadata.
- Discover papers with related meaning using vector similarity search.
- View paper details, abstracts, publication information, and authors.
- Bookmark papers and organize them into personal collections.
- Record user interests for relevant discovery.
- Create research groups and manage group membership.
- Discuss papers with other researchers.
- Apply role-based access for researchers and administrators.

## Proposed Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Web application | Next.js App Router, React, TypeScript | User interface and application routes |
| Relational database | PostgreSQL | Users, roles, papers, authors, bookmarks, collections, groups, and discussions |
| Vector database | MongoDB Atlas Vector Search | Store paper embeddings and retrieve semantically similar papers |
| Embeddings | To be selected | Convert paper text and search queries to vectors |

These are proposed implementation choices for the project. They are not all configured in this initial repository scaffold.

## Repository Contents

```text
.
├── apps/
│   └── web/                         # Next.js discovery interface prototype
├── database/
│   ├── sql/schema.sql                # PostgreSQL tables, constraints, indexes, sample queries
│   ├── sql/queries.sql               # Parameterized application query examples
│   └── vector/                        # Atlas Vector Search setup and demo
├── docs/
│   └── DBMS_PROJECT_REPORT.md        # DBMS mini project report
└── screenshots/
    ├── paper-discovery-mockup.svg    # Illustrative UI concept
    └── code-integration-mockup.svg   # Illustrative architecture/code concept
```

The SVG images are mockups for the report, not screenshots of a running application. Replace them with real application and code captures after implementation.

## Database Design

The PostgreSQL schema in [`database/sql/schema.sql`](database/sql/schema.sql) defines relational structures for:

- Users and roles
- Papers, authors, and paper-author ordering
- User research interests
- Collections and bookmarks
- Research groups and group members
- Paper discussions

Primary keys, foreign keys, uniqueness constraints, check constraints, and indexes help maintain data integrity and support common lookups. Example SQL is included for keyword search and idempotent bookmarking.

The advanced PostgreSQL layer in [`database/sql/advanced_concepts.sql`](database/sql/advanced_concepts.sql) implements full-text search with a GIN index, stored functions, paper-change audit triggers, row-level security for bookmarks, and serializable transaction/row-lock examples. Run the seed and demo scripts using the instructions in [`database/sql/ADVANCED_CONCEPTS.md`](database/sql/ADVANCED_CONCEPTS.md) to see each concept against sample data.

The MongoDB example in [`database/vector/atlas-vector-search.js`](database/vector/atlas-vector-search.js) shows a proposed vector document and `$vectorSearch` aggregation. It uses placeholders: real vectors must be generated using a selected embedding model, and the Atlas vector index must be configured with the matching dimensions. PostgreSQL remains the source of truth for paper records; vector search results should be resolved to the corresponding relational records.

See [`database/vector/README.md`](database/vector/README.md) for the vector index definition, ingestion/search example, and a small semantic retrieval demo plan. The example deliberately accepts embeddings from an external model adapter rather than choosing a provider or embedding dimensions for the project.

## Next.js Application

The initial Next.js App Router prototype is in [`apps/web`](apps/web/README.md). It includes a responsive paper discovery screen with sample records, topic filters, save interactions, and a sign-in screen. Search results and account actions are currently local demo UI; connect PostgreSQL and an authentication service before using real accounts or papers.

```bash
cd apps/web
npm install
npm run dev
```

The app uses the Next.js App Router with TypeScript. Follow the official [Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication) when wiring the sign-in screen to the database and a secure session implementation.

## Project Report

See [`docs/DBMS_PROJECT_REPORT.md`](docs/DBMS_PROJECT_REPORT.md) for the required report sections: title, student details, abstract, tech stack, SQL commands, vector database commands, proposed Next.js tree, and screenshot/mockup section.

## Future Work

1. Implement the Next.js interface and authentication.
2. Configure PostgreSQL and apply the schema.
3. Select an embedding model and create a paper/query embedding pipeline.
4. Configure MongoDB Atlas Vector Search and connect semantic results to PostgreSQL paper records.
5. Build collection, group, collaboration, and discussion workflows.
6. Capture genuine screenshots from the working application and update the report.

## Resume Project Name

**Research Paper Discovery & Collaboration System**

Suggested repository name: `research-paper-discovery-collaboration`.

## Team Work Split

The work is divided into two comparable database-focused tracks so each student can own and commit a distinct set of files:

| Student | Owned work | Files / deliverables |
|---|---|---|
| Aaruni Choudhary (PES2UG24CS013) | Relational data model: PostgreSQL tables, keys, constraints, indexes, and application query examples | `database/sql/schema.sql`, `database/sql/queries.sql` |
| Anchita Chhibba (PES2UG24CS060) | Semantic retrieval: vector document model, Atlas index configuration, embedding ingestion/search examples, and semantic-search evaluation/demo | `database/vector/`, semantic retrieval documentation and demo evidence |

Each student should commit their own work under their GitHub identity after reviewing it. The relational and vector tracks can be developed independently and integrated through the shared `paper_id` identifier.
