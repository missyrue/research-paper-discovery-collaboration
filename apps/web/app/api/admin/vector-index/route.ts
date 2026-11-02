import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getCurrentUser } from "@/lib/authorization";
import { getDbPool } from "@/lib/db";
import { embedText, getEmbeddingConfig } from "@/lib/embeddings";
import { getPaperVectorCollection } from "@/lib/vector-db";

export const runtime = "nodejs";

type SourcePaper = RowDataPacket & {
  paper_id: string | number;
  title: string;
  abstract: string;
  publication_year: number | null;
  topics: string | null;
};

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    if (user.role !== "Admin") return NextResponse.json({ error: "Admin role is required to index papers." }, { status: 403 });

    const { model } = getEmbeddingConfig();
    const [papers] = await getDbPool().execute<SourcePaper[]>(`
      SELECT p.paper_id, p.title, p.abstract, p.publication_year,
             (SELECT GROUP_CONCAT(pt.topic ORDER BY pt.topic SEPARATOR ',')
              FROM paper_topics AS pt WHERE pt.paper_id = p.paper_id) AS topics
      FROM papers AS p ORDER BY p.paper_id LIMIT 500`);
    if (papers.length === 0) return NextResponse.json({ indexed: 0, model });

    const collection = await getPaperVectorCollection();
    const operations = [];
    for (const paper of papers) {
      const embedding = await embedText(`${paper.title}\n\n${paper.abstract}`);
      operations.push({
        updateOne: {
          filter: { paper_id: String(paper.paper_id) },
          update: { $set: {
            paper_id: String(paper.paper_id), title: paper.title, abstract: paper.abstract,
            publication_year: paper.publication_year,
            topics: paper.topics ? paper.topics.split(",") : [],
            embedding, embedding_model: model, updated_at: new Date(),
          } },
          upsert: true,
        },
      });
    }
    await collection.bulkWrite(operations, { ordered: false });
    return NextResponse.json({ indexed: papers.length, model });
  } catch (error) {
    console.error("Paper vector indexing failed:", error);
    return NextResponse.json({
      error: "Could not index papers. Check OPENAI_API_KEY, MONGODB_URI, and the database permissions.",
    }, { status: 503 });
  }
}
