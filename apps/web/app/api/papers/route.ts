import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getCurrentUser } from "@/lib/authorization";
import { getDbPool } from "@/lib/db";
import { embedText, getEmbeddingConfig } from "@/lib/embeddings";
import { consumeSemanticSearch } from "@/lib/semantic-quota";
import { getPaperVectorCollection, searchPaperVectors } from "@/lib/vector-db";

export const runtime = "nodejs";

type PaperRow = RowDataPacket & {
  paper_id: string | number;
  title: string;
  authors: string | null;
  venue: string | null;
  abstract: string;
  topics: string | null;
  publication_year: number | null;
};

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim().slice(0, 200);
  const topic = (params.get("topic") ?? "").trim().slice(0, 80);
  const sort = params.get("sort") === "newest" ? "newest" : "relevance";
  const mode = params.get("mode") === "semantic" ? "semantic" : "keyword";
  const terms = query.split(/\s+/).filter(Boolean).slice(0, 8);

  if (mode === "semantic") {
    if (!query) return NextResponse.json({ papers: [] });
    try {
      const user = await getCurrentUser();
      if (!user) return NextResponse.json({ error: "Sign in to use semantic search." }, { status: 401 });
      const { model } = getEmbeddingConfig();
      const withinQuota = await consumeSemanticSearch(user.id);
      if (!withinQuota) return NextResponse.json({ error: "Daily semantic-search limit reached. Try again tomorrow." }, { status: 429 });
      const vector = await embedText(query);
      const collection = await getPaperVectorCollection();
      const matches = await searchPaperVectors(collection, vector, {
        index: process.env.ATLAS_VECTOR_INDEX ?? "paper_embedding_index",
        model,
        limit: 30,
        topic: topic || undefined,
      });
      if (!matches.length) return NextResponse.json({ papers: [], mode: "semantic" });

      const ids = matches.map((match) => String(match.paper_id));
      const placeholders = ids.map(() => "?").join(", ");
      const sql = `
        SELECT p.paper_id, p.title, p.abstract, p.venue, p.publication_year,
               (SELECT GROUP_CONCAT(a.display_name ORDER BY pa.author_order SEPARATOR ', ')
                FROM paper_authors AS pa JOIN authors AS a ON a.author_id = pa.author_id
                WHERE pa.paper_id = p.paper_id) AS authors,
               (SELECT GROUP_CONCAT(pt.topic ORDER BY pt.topic SEPARATOR ',')
                FROM paper_topics AS pt WHERE pt.paper_id = p.paper_id) AS topics
        FROM papers AS p
        WHERE p.paper_id IN (${placeholders})
          ${topic ? "AND EXISTS (SELECT 1 FROM paper_topics f WHERE f.paper_id = p.paper_id AND f.topic = ?)" : ""}`;
      const [rows] = await getDbPool().execute<PaperRow[]>(sql, topic ? [...ids, topic] : ids);
      const rank = new Map(matches.map((match, index) => [String(match.paper_id), { index, score: match.score }]));
      const orderedRows = [...rows].sort((a, b) => {
        if (sort === "newest") return (b.publication_year ?? 0) - (a.publication_year ?? 0);
        return (rank.get(String(a.paper_id))?.index ?? 0) - (rank.get(String(b.paper_id))?.index ?? 0);
      });
      const papers = orderedRows.map((paper, index) => {
        const similarity = rank.get(String(paper.paper_id))?.score ?? 0;
        return {
          id: String(paper.paper_id), title: paper.title,
          authors: paper.authors ?? "Author information unavailable",
          venue: `${paper.venue ?? "Publication details unavailable"}${paper.publication_year ? ` · ${paper.publication_year}` : ""}`,
          abstract: paper.abstract, tags: paper.topics ? paper.topics.split(",") : [],
          year: paper.publication_year, match: `Semantic match · ${similarity.toFixed(2)}`,
          score: similarity, color: ["lavender", "peach", "mint"][index % 3],
        };
      });
      return NextResponse.json({ papers, mode: "semantic", model });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Semantic paper search failed:", message);
      return NextResponse.json({
        error: "Semantic search is not ready. Check that Ollama is running with the configured model and that the Atlas vector index is active.",
      }, { status: 503 });
    }
  }

  const where: string[] = [];
  const values: (string | number)[] = [];
  if (terms.length) {
    const termConditions = terms.map(() => "(p.title LIKE ? OR p.abstract LIKE ?)");
    where.push(`(${termConditions.join(" OR ")})`);
    for (const term of terms) values.push(`%${term}%`, `%${term}%`);
  }
  if (topic) {
    where.push("EXISTS (SELECT 1 FROM paper_topics filter_topic WHERE filter_topic.paper_id = p.paper_id AND filter_topic.topic = ?)");
    values.push(topic);
  }

  let orderBy: string;
  if (sort === "newest") {
    orderBy = "p.publication_year DESC, p.paper_id DESC";
  } else if (terms.length) {
    const rankExpression = terms.map(() => "(CASE WHEN p.title LIKE ? THEN 2 ELSE 0 END + CASE WHEN p.abstract LIKE ? THEN 1 ELSE 0 END)").join(" + ");
    orderBy = `(${rankExpression}) DESC, p.paper_id ASC`;
    for (const term of terms) values.push(`%${term}%`, `%${term}%`);
  } else {
    orderBy = "p.paper_id ASC";
  }
  const sql = `
    SELECT p.paper_id, p.title, p.abstract, p.venue, p.publication_year,
           (SELECT GROUP_CONCAT(a.display_name ORDER BY pa.author_order SEPARATOR ', ')
            FROM paper_authors AS pa
            JOIN authors AS a ON a.author_id = pa.author_id
            WHERE pa.paper_id = p.paper_id) AS authors,
           (SELECT GROUP_CONCAT(pt.topic ORDER BY pt.topic SEPARATOR ',')
            FROM paper_topics AS pt
            WHERE pt.paper_id = p.paper_id) AS topics
    FROM papers AS p
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY ${orderBy}
    LIMIT 50`;

  try {
    const [rows] = await getDbPool().execute<PaperRow[]>(sql, values);
    const papers = rows.map((paper, index) => ({
      id: String(paper.paper_id),
      title: paper.title,
      authors: paper.authors ?? "Author information unavailable",
      venue: `${paper.venue ?? "Publication details unavailable"}${paper.publication_year ? ` · ${paper.publication_year}` : ""}`,
      abstract: paper.abstract,
      tags: paper.topics ? paper.topics.split(",") : [],
      year: paper.publication_year,
      match: "MySQL keyword result",
      color: ["lavender", "peach", "mint"][index % 3],
    }));
    return NextResponse.json({ papers });
  } catch (error) {
    console.error("Paper search failed:", error);
    return NextResponse.json({ error: "Could not load papers from MySQL. Check the local database setup and connection." }, { status: 503 });
  }
}
