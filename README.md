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
│   └── web/                         # Planned location for the Next.js app
├── database/
│   ├── sql/schema.sql                # PostgreSQL tables, constraints, indexes, sample queries
│   └── vector/atlas-vector-search.js # MongoDB Atlas Vector Search example
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

The MongoDB example in [`database/vector/atlas-vector-search.js`](database/vector/atlas-vector-search.js) shows a proposed vector document and `$vectorSearch` aggregation. It uses placeholders: real vectors must be generated using a selected embedding model, and the Atlas vector index must be configured with the matching dimensions. PostgreSQL remains the source of truth for paper records; vector search results should be resolved to the corresponding relational records.

## Next.js Application (Planned)

The intended application structure is described in the report. To initialize the web application when development begins:

```bash
cd apps/web
npx create-next-app@latest . --typescript --app
npm run dev
```

The `apps/web` directory is currently only a planned location. The commands above will create and run a Next.js application after dependencies are installed; they do not run the current scaffold as-is.

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
