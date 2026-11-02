# Semantic retrieval with MongoDB Atlas Vector Search

This example stores vectors for paper abstracts in MongoDB Atlas and uses
`$vectorSearch` to return papers whose content is semantically close to a
research query. PostgreSQL remains the source of truth for paper records.

## Vector document

Each `paper_vectors` document has this shape:

```json
{
  "paper_id": "42",
  "title": "Example paper title",
  "abstract": "Abstract text used to create the embedding.",
  "publication_year": 2024,
  "embedding": [0.012, -0.034],
  "embedding_model": "provider/model-version",
  "updated_at": "2026-11-02T00:00:00.000Z"
}
```

The two values in the snippet are illustrative only. A real vector must have
the selected embedding model's full dimensionality. `paper_id` is stored as a
decimal string so PostgreSQL `BIGINT` identifiers are not rounded by
JavaScript. The application uses this identifier to fetch canonical paper
details and authors from PostgreSQL.

## Create the Atlas Search index

Create a Vector Search index on the `paper_vectors` collection using
[`atlas-vector-index.json`](atlas-vector-index.json). Its `numDimensions` value
must match the embedding model. The checked-in value of 1536 is a configuration
example; change it together with `EMBEDDING_DIMENSIONS` for the chosen model.
The index includes optional filters for publication year and model version.

## Run the example

From this directory, install the MongoDB Node.js driver in the project
environment and provide:

```sh
export MONGODB_URI='mongodb+srv://...'
export MONGODB_DATABASE='research_papers'
export MONGODB_COLLECTION='paper_vectors'
export ATLAS_VECTOR_INDEX='paper_embedding_index'
export EMBEDDING_DIMENSIONS='1536'
```

Implement `embedding-adapter.js` with the selected embedding service. It must
export `embedText(text)`, returning an array of finite numbers of the configured
dimension. The adapter is intentionally not checked in because the project has
not selected an embedding model or provider.

In application code, call `upsertPaperEmbedding(collection, paper, embedding)`
after importing or updating a paper in PostgreSQL, then call
`findSimilarPapers(collection, queryEmbedding, { limit: 10 })` for a search.
The runnable query entry point is:

```sh
node atlas-vector-search.js "graph neural networks for molecular property prediction"
```

The code validates vector dimensions, upserts by `paper_id` to avoid duplicate
documents, bounds result count, and returns Atlas similarity scores. Production
ingestion should also remove or refresh vector documents when the source paper
is deleted or its abstract changes.

## Small semantic-search evaluation/demo

Use a fixed toy corpus with these topics:

| Paper summary | Query expected to retrieve it |
|---|---|
| Graph neural networks estimate molecular properties from molecular structure. | Predicting chemical properties with graph models |
| Transformer models summarize long clinical notes for hospital discharge. | Automatic summarization of patient records |
| Satellite images are analyzed to identify crop stress and estimate yield. | Remote sensing for agricultural monitoring |

For each query, record the top five `paper_id` values and scores, then check
whether the matching paper appears in the top five. Report `hits / queries` as
Recall@5. Compare with the PostgreSQL keyword query on the same query set to
show where semantic retrieval can find related wording. This is a demonstration
plan, not measured performance: scores depend on the selected model, corpus,
and Atlas index configuration.
