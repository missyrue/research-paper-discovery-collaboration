# MongoDB Atlas Vector Search with local Ollama embeddings

MySQL is the source of truth for users, papers, authors, and topics. The Next.js server uses the local Ollama service to embed paper titles/abstracts and semantic queries with `nomic-embed-text` (768 dimensions). MongoDB Atlas stores those vectors and metadata, then cosine vector search returns ranked MySQL paper IDs. Paper details are loaded from MySQL after retrieval.

## 1. Install and start Ollama

Install Ollama for Windows from [ollama.com/download](https://ollama.com/download), then open PowerShell and download the embedding model:

```powershell
ollama pull nomic-embed-text
ollama list
```

Ollama should be running at `http://127.0.0.1:11434`. Check the service and vector length:

```powershell
$body = @{ model = 'nomic-embed-text'; input = 'search_query: graph models for molecular discovery' } | ConvertTo-Json
$result = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/embed' -Method Post -ContentType 'application/json' -Body $body
$result.embeddings[0].Count
```

The expected length is `768`. Nomic embedding usage prefixes documents with `search_document:` and search text with `search_query:`. The app applies these prefixes automatically. The local model runs without an OpenAI API key or per-request API billing.

## 2. Configure the application

Keep the MySQL credentials and Atlas `MONGODB_URI` in the ignored `apps/web/.env.local`. Use these embedding settings:

```dotenv
OLLAMA_BASE_URL=http://127.0.0.1:11434
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_DIMENSIONS=768
MONGODB_DATABASE=research_papers
MONGODB_COLLECTION=paper_vectors
ATLAS_VECTOR_INDEX=paper_embedding_index
```

Do not add `OPENAI_API_KEY`; this implementation does not call OpenAI. Paper text is sent to the Ollama service on the same laptop to generate vectors. The vectors and paper metadata are then stored in MongoDB Atlas.

## 3. Create or replace the Atlas Vector Search index

In Atlas Data Explorer, open `research_papers.paper_vectors` → **Search Indexes**. Create an index named `paper_embedding_index` from [`atlas-vector-index.json`](atlas-vector-index.json). It must use cosine similarity and 768 dimensions.

If an old index uses 1536 dimensions, replace it with this 768-dimension definition before syncing. Keep the same index name so the application configuration does not change. Wait until the index status is **Active**.

## 4. Sync MySQL papers into Atlas

Start the local app, sign in with the Admin role, and open `http://localhost:3000/admin`. Select **Sync papers to Atlas Vector Search**. The protected route reads MySQL in batches of 10 papers, creates local embeddings, and upserts documents keyed by the decimal-string MySQL `paper_id`. On the first batch, vectors made by a different embedding model are removed from this dedicated collection; all MySQL papers are then re-embedded with Ollama. Re-running sync skips unchanged records.

Each document contains:

```json
{
  "paper_id": "42",
  "title": "Example paper title",
  "abstract": "Text used to create the embedding.",
  "publication_year": 2024,
  "topics": ["Machine learning"],
  "embedding": [0.012, -0.034],
  "embedding_model": "nomic-embed-text",
  "content_hash": "sha256-of-source-fields-and-model",
  "updated_at": "2026-11-02T00:00:00.000Z"
}
```

The embedding array above is abbreviated; real vectors contain 768 values.

## 5. Run semantic search

Sign in as a Researcher or Admin, select **Semantic vectors**, and submit a query. The app creates a local query embedding, runs Atlas `$vectorSearch` with cosine similarity and optional topic filters, then fetches the ranked paper details from MySQL. The MySQL keyword mode remains available and does not require Ollama or MongoDB.

Example Atlas aggregation shape:

```javascript
db.paper_vectors.aggregate([
  {
    $vectorSearch: {
      index: "paper_embedding_index",
      path: "embedding",
      queryVector: [/* 768 floats from Ollama */],
      numCandidates: 200,
      limit: 10,
      filter: { embedding_model: "nomic-embed-text" }
    }
  },
  { $project: { _id: 0, paper_id: 1, score: { $meta: "vectorSearchScore" } } }
]);
```

Signed-in users are limited to 30 semantic queries per UTC day; MySQL stores the counter. The relevant code is `apps/web/lib/embeddings.ts`, `apps/web/lib/vector-db.ts`, `apps/web/app/api/admin/vector-index/route.ts`, and `apps/web/app/api/papers/route.ts`.

## Troubleshooting

- **Ollama connection refused:** start Ollama and verify `http://127.0.0.1:11434/api/tags` responds.
- **Model not found:** run `ollama pull nomic-embed-text`.
- **Vector dimension mismatch:** confirm the model returns 768 values and the Atlas index uses `numDimensions: 768`.
- **No semantic results:** confirm the index is Active and rerun the Admin sync after changing the embedding model.
- **MongoDB connection failure:** check the Atlas IP access list, cluster status, `MONGODB_URI`, and database-user permissions.
