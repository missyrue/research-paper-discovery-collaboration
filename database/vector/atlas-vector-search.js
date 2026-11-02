// Standalone MongoDB Atlas Vector Search reference fragment. The integrated
// Next.js path is implemented in apps/web/lib/vector-db.ts and the API routes.

import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DATABASE ?? "research_papers";
const collectionName = process.env.MONGODB_COLLECTION ?? "paper_vectors";
const indexName = process.env.ATLAS_VECTOR_INDEX ?? "paper_embedding_index";
const embeddingDimensions = Number(process.env.EMBEDDING_DIMENSIONS);

if (!uri) throw new Error("Set MONGODB_URI to your Atlas connection string.");
if (!Number.isInteger(embeddingDimensions) || embeddingDimensions <= 0) {
  throw new Error("Set EMBEDDING_DIMENSIONS to the selected model's vector size.");
}

function validateVector(vector, label = "embedding") {
  if (!Array.isArray(vector) || vector.length !== embeddingDimensions ||
      !vector.every((value) => Number.isFinite(value))) {
    throw new Error(`${label} must contain ${embeddingDimensions} finite numbers.`);
  }
}

// The caller supplies embeddings from the selected model. Keep paper_id aligned
// with MySQL's BIGINT key; this example stores it as a decimal string to
// avoid JavaScript's unsafe integer range.
export async function upsertPaperEmbedding(collection, paper, embedding) {
  if (!paper?.paperId || !paper?.title || typeof paper.abstract !== "string") {
    throw new Error("paper must include paperId, title, and abstract.");
  }
  validateVector(embedding);

  await collection.updateOne(
    { paper_id: String(paper.paperId) },
    {
      $set: {
        paper_id: String(paper.paperId),
        title: paper.title,
        abstract: paper.abstract,
        publication_year: paper.publicationYear ?? null,
        embedding,
        embedding_model: paper.embeddingModel,
        updated_at: new Date(),
      },
    },
    { upsert: true },
  );
}

export async function findSimilarPapers(collection, queryEmbedding, { limit = 10 } = {}) {
  validateVector(queryEmbedding, "query embedding");
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("limit must be an integer from 1 to 100.");
  }

  return collection.aggregate([
    {
      $vectorSearch: {
        index: indexName,
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: Math.max(limit * 20, 100),
        limit,
      },
    },
    {
      $project: {
        _id: 0,
        paper_id: 1,
        title: 1,
        publication_year: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ]).toArray();
}
