import { getDbPool } from "@/lib/db";

export const DAILY_SEMANTIC_SEARCH_LIMIT = 30;

/** Enforce a persistent UTC-day quota even across app restarts or server instances. */
export async function consumeSemanticSearch(userId: number) {
  const connection = await getDbPool().getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      "INSERT IGNORE INTO semantic_search_usage (user_id, usage_date, request_count) VALUES (?, UTC_DATE(), 0)",
      [userId],
    );
    const [result] = await connection.execute(
      `UPDATE semantic_search_usage
       SET request_count = request_count + 1
       WHERE user_id = ? AND usage_date = UTC_DATE() AND request_count < ?`,
      [userId, DAILY_SEMANTIC_SEARCH_LIMIT],
    );
    await connection.commit();
    return (result as { affectedRows: number }).affectedRows === 1;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
