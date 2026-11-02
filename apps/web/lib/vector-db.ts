import { MongoClient, type Collection, type Document } from "mongodb";

export type PaperVector = {
  paper_id: string;
  title: string;
  abstract: string;
  publication_year: number | null;
  topics: string[];
  embedding: number[];
  embedding_model: string;
  content_hash: string;
  updated_at: Date;
};

declare global {
  // eslint-disable-next-line no-var
  var atlasVectorMongoClient: MongoClient | undefined;
  // eslint-disable-next-line no-var
  var atlasVectorMongoClientPromise: Promise<MongoClient> | undefined;
}

export async function getPaperVectorCollection(): Promise<Collection<PaperVector>> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Set MONGODB_URI in apps/web/.env.local to enable semantic search.");
  let client = globalThis.atlasVectorMongoClient;
  if (!client) {
    if (!globalThis.atlasVectorMongoClientPromise) {
      const newClient = new MongoClient(uri, {
        serverSelectionTimeoutMS: 8000,
        maxPoolSize: 20,
        retryReads: true,
        retryWrites: true,
      });
      globalThis.atlasVectorMongoClientPromise = newClient.connect().then(() => {
        globalThis.atlasVectorMongoClient = newClient;
        return newClient;
      }).catch((error) => {
        globalThis.atlasVectorMongoClientPromise = undefined;
        throw error;
      });
    }
    client = await globalThis.atlasVectorMongoClientPromise;
  }
  const database = process.env.MONGODB_DATABASE ?? "research_papers";
  const collection = process.env.MONGODB_COLLECTION ?? "paper_vectors";
  const vectorCollection = client.db(database).collection<PaperVector>(collection);
  await vectorCollection.createIndex({ paper_id: 1 }, { unique: true, name: "uq_paper_vector_id" });
  return vectorCollection;
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
