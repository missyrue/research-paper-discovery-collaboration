import type { RowDataPacket } from "mysql2/promise";
import { getSession } from "@/lib/auth";
import { getDbPool } from "@/lib/db";

export type AppRole = "Admin" | "Researcher";
type CurrentUserRow = RowDataPacket & { user_id: number; full_name: string; email: string; role_name: AppRole };

/** Read the current role from MySQL on every request so role changes take effect immediately. */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const [rows] = await getDbPool().execute<CurrentUserRow[]>(
    `SELECT u.user_id, u.full_name, u.email, r.role_name
     FROM users AS u JOIN roles AS r ON r.role_id = u.role_id
     WHERE u.user_id = ? LIMIT 1`,
    [session.id],
  );
  const row = rows[0];
  if (!row || (row.role_name !== "Admin" && row.role_name !== "Researcher")) return null;
  return { id: Number(row.user_id), name: row.full_name, email: row.email, role: row.role_name };
}
