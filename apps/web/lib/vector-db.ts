import { MongoClient, type Collection, type Document } from "mongodb";

export type PaperVector = {
  paper_id: string;
  title: string;
  abstract: string;
  publication_year: number | null;
  topics: string[];
  embedding: number[];
  embedding_model: string;
  updated_at: Date;
};

declare global {
  // eslint-disable-next-line no-var
  var atlasVectorMongoClient: MongoClient | undefined;
}

export async function getPaperVectorCollection(): Promise<Collection<PaperVector>> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Set MONGODB_URI in apps/web/.env.local to enable semantic search.");
  const client = globalThis.atlasVectorMongoClient ?? new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  if (!globalThis.atlasVectorMongoClient) {
    await client.connect();
    globalThis.atlasVectorMongoClient = client;
  }
  const database = process.env.MONGODB_DATABASE ?? "research_papers";
  const collection = process.env.MONGODB_COLLECTION ?? "paper_vectors";
  return client.db(database).collection<PaperVector>(collection);
}

export async function searchPaperVectors(
  collection: Collection<PaperVector>,
  queryVector: number[],
  options: { index: string; model: string; limit?: number; topic?: string },
) {
  const limit = options.limit ?? 20;
  const filter: Document = { embedding_model: { $eq: options.model } };
  if (options.topic) filter.topics = { $in: [options.topic] };
  return collection.aggregate<PaperVector & { score: number }>([
    {
      $vectorSearch: {
        index: options.index,
        path: "embedding",
        queryVector,
        numCandidates: Math.min(Math.max(limit * 20, 100), 1000),
        limit,
        ...(Object.keys(filter).length ? { filter } : {}),
      },
    },
    { $project: { _id: 0, paper_id: 1, score: { $meta: "vectorSearchScore" } } },
  ]).toArray();
}
