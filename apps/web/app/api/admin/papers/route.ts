import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getCurrentUser } from "@/lib/authorization";
import { getDbPool } from "@/lib/db";
import { getPaperVectorCollection } from "@/lib/vector-db";

export const runtime = "nodejs";

type PaperRow = RowDataPacket & { paper_id: number; title: string; venue: string | null; publication_year: number | null };
type PaperInput = { title?: string; abstract?: string; venue?: string; publicationYear?: number | null; doi?: string };

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { user: null, response: NextResponse.json({ error: "Sign in is required." }, { status: 401 }) };
  if (user.role !== "Admin") return { user: null, response: NextResponse.json({ error: "Admin role is required for this action." }, { status: 403 }) };
  return { user, response: null };
}

export async function GET() {
  try {
    const access = await requireAdmin();
    if (access.response) return access.response;
    const [rows] = await getDbPool().execute<PaperRow[]>(
      "SELECT paper_id, title, venue, publication_year FROM papers ORDER BY paper_id DESC LIMIT 200",
    );
    return NextResponse.json({ papers: rows });
  } catch (error) {
    console.error("Admin paper list failed:", error);
    return NextResponse.json({ error: "Could not load papers from MySQL." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireAdmin();
    if (access.response) return access.response;
    const input = await request.json() as PaperInput;
    const title = input.title?.trim();
    const abstract = input.abstract?.trim();
    const venue = input.venue?.trim() || null;
    const doi = input.doi?.trim() || null;
    const year = input.publicationYear ?? null;
    if (!title || title.length > 1000 || !abstract || abstract.length > 20000 || (venue && venue.length > 255) || (doi && doi.length > 255)) {
      return NextResponse.json({ error: "Provide a title and abstract within the allowed lengths." }, { status: 400 });
    }
    if (year !== null && (!Number.isInteger(year) || year < 1000 || year > 2200)) {
      return NextResponse.json({ error: "Publication year must be between 1000 and 2200." }, { status: 400 });
    }
    const [result] = await getDbPool().execute<ResultSetHeader>(
      "INSERT INTO papers (title, abstract, venue, publication_year, doi) VALUES (?, ?, ?, ?, ?)",
      [title, abstract, venue, year, doi],
    );
    return NextResponse.json({ paperId: result.insertId }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "A paper with that DOI already exists." }, { status: 409 });
    }
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    console.error("Admin paper creation failed:", error);
    return NextResponse.json({ error: "Could not create the paper in MySQL." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await requireAdmin();
    if (access.response) return access.response;
    const input = await request.json() as PaperInput & { paperId?: number };
    if (!Number.isSafeInteger(input.paperId) || Number(input.paperId) < 1) {
      return NextResponse.json({ error: "A valid paper ID is required." }, { status: 400 });
    }
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    if (input.title !== undefined) {
      const title = input.title.trim();
      if (!title || title.length > 1000) return NextResponse.json({ error: "Title must be 1 to 1000 characters." }, { status: 400 });
      fields.push("title = ?"); values.push(title);
    }
    if (input.abstract !== undefined) {
      const abstract = input.abstract.trim();
      if (!abstract || abstract.length > 20000) return NextResponse.json({ error: "Abstract must be 1 to 20000 characters." }, { status: 400 });
      fields.push("abstract = ?"); values.push(abstract);
    }
    if (input.venue !== undefined) {
      const venue = input.venue.trim();
      if (venue.length > 255) return NextResponse.json({ error: "Venue must be at most 255 characters." }, { status: 400 });
      fields.push("venue = ?"); values.push(venue || null);
    }
    if (input.publicationYear !== undefined) {
      const year = input.publicationYear;
      if (year !== null && (!Number.isInteger(year) || year < 1000 || year > 2200)) return NextResponse.json({ error: "Publication year must be between 1000 and 2200." }, { status: 400 });
      fields.push("publication_year = ?"); values.push(year);
    }
    if (input.doi !== undefined) {
      const doi = input.doi.trim();
      if (doi.length > 255) return NextResponse.json({ error: "DOI must be at most 255 characters." }, { status: 400 });
      fields.push("doi = ?"); values.push(doi || null);
    }
    if (!fields.length) return NextResponse.json({ error: "Provide at least one paper field to update." }, { status: 400 });
    values.push(Number(input.paperId));
    const [result] = await getDbPool().execute<ResultSetHeader>(`UPDATE papers SET ${fields.join(", ")} WHERE paper_id = ?`, values);
    if (result.affectedRows === 0) {
      const [rows] = await getDbPool().execute<RowDataPacket[]>("SELECT 1 FROM papers WHERE paper_id = ? LIMIT 1", [Number(input.paperId)]);
      if (!rows.length) return NextResponse.json({ error: "Paper was not found." }, { status: 404 });
    }
    let vectorInvalidated = true;
    try { await (await getPaperVectorCollection()).deleteOne({ paper_id: String(input.paperId) }); }
    catch (error) { vectorInvalidated = false; console.warn("Could not invalidate the changed paper vector; run Atlas sync:", error); }
    return NextResponse.json({ ok: true, vectorInvalidated });
  } catch (error) {
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") return NextResponse.json({ error: "A paper with that DOI already exists." }, { status: 409 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    console.error("Admin paper update failed:", error);
    return NextResponse.json({ error: "Could not update the paper in MySQL." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  try {
    const access = await requireAdmin();
    if (access.response) return access.response;
    const input = await request.json() as { paperId?: number };
    if (!Number.isSafeInteger(input.paperId) || Number(input.paperId) < 1) {
      return NextResponse.json({ error: "A valid paper ID is required." }, { status: 400 });
    }
    const [result] = await getDbPool().execute<ResultSetHeader>("DELETE FROM papers WHERE paper_id = ?", [Number(input.paperId)]);
    if (result.affectedRows === 0) return NextResponse.json({ error: "Paper was not found." }, { status: 404 });
    let vectorRemoved = true;
    try { await (await getPaperVectorCollection()).deleteOne({ paper_id: String(input.paperId) }); }
    catch (error) { vectorRemoved = false; console.warn("Could not remove the deleted paper vector; run Atlas sync:", error); }
    return NextResponse.json({ ok: true, vectorRemoved });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    console.error("Admin paper deletion failed:", error);
    return NextResponse.json({ error: "Could not delete the paper from MySQL." }, { status: 503 });
  }
}
