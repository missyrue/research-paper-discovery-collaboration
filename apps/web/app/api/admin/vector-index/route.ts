import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getCurrentUser } from "@/lib/authorization";
import { getDbPool } from "@/lib/db";
import { embedTexts, getEmbeddingConfig } from "@/lib/embeddings";
import { getPaperVectorCollection } from "@/lib/vector-db";

export const runtime = "nodejs";
export const maxDuration = 60;
const BATCH_SIZE = 10;

type SourcePaper = RowDataPacket & {
  paper_id: string | number;
  title: string;
  abstract: string;
  publication_year: number | null;
  topics: string | null;
};

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    if (user.role !== "Admin") return NextResponse.json({ error: "Admin role is required to index papers." }, { status: 403 });

    const input = await request.json().catch(() => ({})) as { afterPaperId?: string | number };
    const afterPaperId = String(input.afterPaperId ?? "0");
    if (!/^\d{1,20}$/.test(afterPaperId)) {
      return NextResponse.json({ error: "afterPaperId must be a non-negative integer ID." }, { status: 400 });
    }
    const { model, dimensions } = getEmbeddingConfig();
    const [papers] = await getDbPool().execute<SourcePaper[]>(`
      SELECT p.paper_id, p.title, p.abstract, p.publication_year,
             (SELECT GROUP_CONCAT(pt.topic ORDER BY pt.topic SEPARATOR ',')
              FROM paper_topics AS pt WHERE pt.paper_id = p.paper_id) AS topics
      FROM papers AS p WHERE p.paper_id > ? ORDER BY p.paper_id LIMIT ${BATCH_SIZE}`,
    [afterPaperId]);
    if (papers.length === 0) return NextResponse.json({ indexed: 0, skipped: 0, model, done: true, nextAfterPaperId: null });

    const collection = await getPaperVectorCollection();
    // Rebuild this dedicated collection when changing embedding models/dimensions.
    // MySQL remains the source of truth, so the vectors can be regenerated safely.
    if (afterPaperId === "0") {
      await collection.deleteMany({ embedding_model: { $ne: model } });
    }
    const candidates = papers.map((paper) => {
      const topics = paper.topics ? paper.topics.split(",") : [];
      const contentHash = createHash("sha256").update(JSON.stringify([
        paper.title, paper.abstract, paper.publication_year, topics, model, dimensions,
      ])).digest("hex");
      return { paper, topics, contentHash };
    });
    const existing = await collection.find(
      { paper_id: { $in: candidates.map(({ paper }) => String(paper.paper_id)) } },
      { projection: { paper_id: 1, embedding_model: 1, content_hash: 1 } },
    ).toArray();
    const existingById = new Map(existing.map((document) => [document.paper_id, document]));
    const changed = candidates.filter(({ paper, contentHash }) => {
      const current = existingById.get(String(paper.paper_id));
      return !current || current.embedding_model !== model || current.content_hash !== contentHash;
    });
    const vectors = changed.length ? await embedTexts(changed.map(({ paper }) => `${paper.title}\n\n${paper.abstract}`)) : [];
    const operations = changed.map(({ paper, topics, contentHash }, index) => ({
        updateOne: {
          filter: { paper_id: String(paper.paper_id) },
          update: { $set: {
            paper_id: String(paper.paper_id), title: paper.title, abstract: paper.abstract,
            publication_year: paper.publication_year,
            topics, embedding: vectors[index], embedding_model: model,
            content_hash: contentHash, updated_at: new Date(),
          } },
          upsert: true,
        },
      }));
    if (operations.length) await collection.bulkWrite(operations, { ordered: false });
    return NextResponse.json({
      indexed: changed.length,
      skipped: papers.length - changed.length,
      model,
      done: papers.length < BATCH_SIZE,
      nextAfterPaperId: String(papers[papers.length - 1].paper_id),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Paper vector indexing failed:", message);
    const userMessage = process.env.NODE_ENV === "production"
      ? `Could not index papers. Check that Ollama is running with ${process.env.EMBEDDING_MODEL ?? "nomic-embed-text"} installed, then check MongoDB Atlas connectivity and permissions.`
      : `Paper indexing failed: ${message}`;
    return NextResponse.json({
      error: userMessage,
    }, { status: 503 });
  }
}
