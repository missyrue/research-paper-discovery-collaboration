import { NextResponse } from "next/server";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { getCurrentUser } from "@/lib/authorization";
import { getDbPool } from "@/lib/db";

export const runtime = "nodejs";

type EvaluationRow = RowDataPacket & Record<string, string | number | null>;

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (user.role !== "Admin") return NextResponse.json({ error: "Admin role is required for this action." }, { status: 403 });
  return null;
}

export async function POST() {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;
  } catch (error) {
    console.error("Could not authorize the database evaluation demo:", error);
    return NextResponse.json({ error: "Could not verify the Admin session." }, { status: 503 });
  }

  let connection: PoolConnection | undefined;
  try {
    connection = await getDbPool().getConnection();

    const joinSql = `
      SELECT p.paper_id, p.title, a.display_name AS author, pa.author_order
      FROM papers AS p
      JOIN paper_authors AS pa ON pa.paper_id = p.paper_id
      JOIN authors AS a ON a.author_id = pa.author_id
      ORDER BY p.paper_id, pa.author_order
      LIMIT 20`;
    const [joinRows] = await connection.query<EvaluationRow[]>(joinSql);

    const groupSql = `
      SELECT p.paper_id, p.title, COUNT(pa.author_id) AS author_count
      FROM papers AS p
      LEFT JOIN paper_authors AS pa ON pa.paper_id = p.paper_id
      GROUP BY p.paper_id, p.title
      ORDER BY author_count DESC, p.paper_id
      LIMIT 20`;
    const [groupRows] = await connection.query<EvaluationRow[]>(groupSql);

    const subqueriesSql = `
      SELECT p.paper_id, p.title
      FROM papers AS p
      WHERE (SELECT COUNT(*)
             FROM paper_authors AS pa
             WHERE pa.paper_id = p.paper_id) >
            (SELECT AVG(author_totals.author_count)
             FROM (SELECT COUNT(*) AS author_count
                   FROM paper_authors
                   GROUP BY paper_id) AS author_totals)
      ORDER BY p.paper_id
      LIMIT 20`;
    const [subqueryRows] = await connection.query<EvaluationRow[]>(subqueriesSql);

    const viewSql = `
      SELECT paper_id, title, author_count, bookmark_count
      FROM v_paper_engagement
      ORDER BY bookmark_count DESC, paper_id
      LIMIT 20`;
    const [viewRows] = await connection.query<EvaluationRow[]>(viewSql);

    let updateAudit: EvaluationRow[] = [];
    let deleteAudit: EvaluationRow[] = [];

    await connection.beginTransaction();
    try {
      const [lockedPapers] = await connection.query<(RowDataPacket & { paper_id: number | string })[]>(
        "SELECT paper_id FROM papers ORDER BY paper_id LIMIT 1 FOR UPDATE",
      );
      const samplePaperId = lockedPapers[0]?.paper_id;
      if (samplePaperId !== undefined) {
        await connection.execute(
          "UPDATE papers SET abstract = CONCAT(abstract, ' [temporary evaluation update]') WHERE paper_id = ?",
          [samplePaperId],
        );
        const [auditRows] = await connection.execute<EvaluationRow[]>(`
          SELECT paper_id, operation,
                 JSON_UNQUOTE(JSON_EXTRACT(old_row, '$.title')) AS old_title,
                 JSON_UNQUOTE(JSON_EXTRACT(new_row, '$.abstract')) AS new_abstract,
                 changed_by, changed_at
          FROM paper_audit_log
          WHERE paper_id = ? AND operation = 'UPDATE'
          ORDER BY audit_id DESC
          LIMIT 1`, [samplePaperId]);
        updateAudit = auditRows;
      }
    } finally {
      await connection.rollback();
    }

    await connection.beginTransaction();
    try {
      const [lockedPapers] = await connection.query<(RowDataPacket & { paper_id: number | string })[]>(
        "SELECT paper_id FROM papers ORDER BY paper_id DESC LIMIT 1 FOR UPDATE",
      );
      const samplePaperId = lockedPapers[0]?.paper_id;
      if (samplePaperId !== undefined) {
        await connection.execute("DELETE FROM papers WHERE paper_id = ?", [samplePaperId]);
        const [auditRows] = await connection.execute<EvaluationRow[]>(`
          SELECT paper_id, operation,
                 JSON_UNQUOTE(JSON_EXTRACT(old_row, '$.title')) AS deleted_title,
                 changed_by, changed_at
          FROM paper_audit_log
          WHERE paper_id = ? AND operation = 'DELETE'
          ORDER BY audit_id DESC
          LIMIT 1`, [samplePaperId]);
        deleteAudit = auditRows;
      }
    } finally {
      await connection.rollback();
    }

    return NextResponse.json({
      results: {
        join: { title: "JOIN: paper authors", sql: joinSql, rows: joinRows },
        groupBy: { title: "GROUP BY + COUNT: authors per paper", sql: groupSql, rows: groupRows },
        subqueries: { title: "Correlated + nested subqueries: above-average author counts", sql: subqueriesSql, rows: subqueryRows },
        updateTrigger: {
          title: "UPDATE + audit trigger",
          sql: `START TRANSACTION;
SELECT paper_id FROM papers ORDER BY paper_id LIMIT 1 FOR UPDATE;
UPDATE papers
SET abstract = CONCAT(abstract, ' [temporary evaluation update]')
WHERE paper_id = ?;
SELECT paper_id, operation,
       JSON_UNQUOTE(JSON_EXTRACT(old_row, '$.title')) AS old_title,
       JSON_UNQUOTE(JSON_EXTRACT(new_row, '$.abstract')) AS new_abstract
FROM paper_audit_log
WHERE paper_id = ? AND operation = 'UPDATE'
ORDER BY audit_id DESC LIMIT 1;
ROLLBACK; -- The paper update and trigger audit row are both undone.`,
          rows: updateAudit,
        },
        deleteTrigger: {
          title: "DELETE + audit trigger",
          sql: `START TRANSACTION;
SELECT paper_id FROM papers ORDER BY paper_id DESC LIMIT 1 FOR UPDATE;
DELETE FROM papers WHERE paper_id = ?;
SELECT paper_id, operation,
       JSON_UNQUOTE(JSON_EXTRACT(old_row, '$.title')) AS deleted_title
FROM paper_audit_log
WHERE paper_id = ? AND operation = 'DELETE'
ORDER BY audit_id DESC LIMIT 1;
ROLLBACK; -- The paper deletion and trigger audit row are both undone.`,
          rows: deleteAudit,
        },
        view: { title: "Aggregate view", sql: viewSql, rows: viewRows },
      },
      writesRolledBack: true,
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch { /* No open transaction remains. */ }
    }
    console.error("Database evaluation demo failed:", error);
    return NextResponse.json({
      error: "Could not run the evaluation demo. Apply database/mysql/advanced_concepts.sql and database/mysql/advanced_concepts_demo_seed.sql to the MySQL database, then retry.",
    }, { status: 503 });
  } finally {
    connection?.release();
  }
}
