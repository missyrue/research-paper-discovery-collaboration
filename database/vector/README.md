# MongoDB Atlas Vector Search

The Next.js app has a semantic-search path backed by MongoDB Atlas Vector Search. MySQL remains the authoritative source for papers, authors, and topics. The app sends paper title/abstract and search text to the OpenAI Embeddings API using `text-embedding-3-small` (1536 dimensions), stores paper embeddings in Atlas, uses cosine vector search to rank paper IDs, and loads the matching canonical paper rows from MySQL.

## Configure local credentials

Add these values to the ignored `apps/web/.env.local` file. Do not commit this file or paste credentials into GitHub/chat.

```dotenv
OPENAI_API_KEY=your-embedding-api-key
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
MONGODB_URI=mongodb+srv://...
MONGODB_DATABASE=research_papers
MONGODB_COLLECTION=paper_vectors
ATLAS_VECTOR_INDEX=paper_embedding_index
```

The driver is part of `apps/web/package.json`. Create an Atlas Vector Search index on the `paper_vectors` collection using [`atlas-vector-index.json`](atlas-vector-index.json). Its dimensions and similarity must match the configured embedding model (`1536` and `cosine` for the default model). The index maps the `embedding` vector and the `topics` and `embedding_model` filter fields.

Search text and paper titles/abstracts are sent to OpenAI to create embeddings. Do not index private or licensed text unless your data-sharing terms allow it. Signed-in accounts have a persistent limit of 30 semantic searches per UTC day; the counter is stored in MySQL.

## Index the MySQL library

Start the Next.js app, sign in using an account with the Admin role, and open `http://localhost:3000/admin`. Select **Sync papers to Atlas Vector Search**. The protected API scans the MySQL library in keyset-paginated batches of 50, embeds each changed title plus abstract, and upserts a vector document keyed by the decimal-string MySQL `paper_id`. Re-running it skips documents whose content hash and embedding model are unchanged. The embedding provider may bill for new or changed papers.

Each Atlas document stores:

```json
{
  "paper_id": "42",
  "title": "Example paper title",
  "abstract": "Text used to create the embedding.",
  "publication_year": 2024,
  "topics": ["Machine learning"],
  "embedding": [0.012, -0.034],
  "embedding_model": "text-embedding-3-small",
  "updated_at": "2026-11-02T00:00:00.000Z"
}
```

The embedding array above is abbreviated and illustrative, not a real 1536-value vector.

## Use semantic search

Sign in as a Researcher or Admin, select **Semantic vectors** on the discovery page, and submit a query. The app embeds the query text, searches the Atlas index by cosine similarity, applies selected topic filters in Atlas, then fetches the matching papers/authors/tags from MySQL while preserving vector ranking. Keyword mode continues to use MySQL `LIKE` matching and does not require Atlas or the embedding API key.

The search route is `apps/web/app/api/papers/route.ts`; embedding requests are handled in `apps/web/lib/embeddings.ts`; MongoDB access and vector aggregation are in `apps/web/lib/vector-db.ts`; the admin-only indexing endpoint is `apps/web/app/api/admin/vector-index/route.ts`.

If semantic search is unavailable, check that the Atlas cluster is reachable from the network, the URI user has read/write access to the selected database, the vector index is active, and all environment variable names match. Never expose API keys in screenshots or logs.
