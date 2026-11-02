import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { clearSession, createSession, hashPassword, verifyPassword } from "@/lib/auth";
import { getCurrentUser } from "@/lib/authorization";
import { getDbPool } from "@/lib/db";

export const runtime = "nodejs";

type UserRow = RowDataPacket & { user_id: number; full_name: string; email: string; password_hash: string; role_name?: "Admin" | "Researcher" };

export async function GET() {
  try {
    const user = await getCurrentUser();
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Could not check the signed-in user." }, { status: 503 });
  }
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  let body: { email?: string; password?: string; name?: string; mode?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please submit valid form details." }, { status: 400 });
  }
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const mode = body.mode === "register" ? "register" : "login";
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254 || password.length < 8 || password.length > 200) {
    return NextResponse.json({ error: "Enter a valid email and a password between 8 and 200 characters." }, { status: 400 });
  }

  try {
    const pool = getDbPool();
    let user: UserRow | undefined;
    if (mode === "register") {
      const name = body.name?.trim().slice(0, 120);
      if (!name) return NextResponse.json({ error: "Enter your name to create an account." }, { status: 400 });
      const passwordHash = await hashPassword(password);
      await pool.execute("INSERT IGNORE INTO roles (role_name) VALUES ('Researcher')");
      const [roles] = await pool.execute<(RowDataPacket & { role_id: number })[]>("SELECT role_id FROM roles WHERE role_name = 'Researcher' LIMIT 1");
      if (!roles[0]) throw new Error("Researcher role could not be initialized.");
      try {
        const [result] = await pool.execute<ResultSetHeader>(
          "INSERT INTO users (role_id, full_name, email, password_hash) VALUES (?, ?, ?, ?)",
          [roles[0].role_id, name, email, passwordHash],
        );
        user = { user_id: result.insertId, full_name: name, email, password_hash: passwordHash, role_name: "Researcher" } as UserRow;
      } catch (error) {
        if ((error as { code?: string }).code === "ER_DUP_ENTRY") {
          return NextResponse.json({ error: "An account with this email already exists. Sign in instead." }, { status: 409 });
        }
        throw error;
      }
    } else {
      const [rows] = await pool.execute<UserRow[]>(
        `SELECT u.user_id, u.full_name, u.email, u.password_hash, r.role_name
         FROM users AS u JOIN roles AS r ON r.role_id = u.role_id
         WHERE u.email = ? LIMIT 1`,
        [email],
      );
      user = rows[0];
      if (!user || !(await verifyPassword(password, user.password_hash))) {
        return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
      }
    }
    const role = user.role_name ?? "Researcher";
    await createSession({ id: Number(user.user_id), name: user.full_name, email: user.email, role });
    return NextResponse.json({ user: { id: Number(user.user_id), name: user.full_name, email: user.email, role } });
  } catch (error) {
    console.error("Authentication request failed:", error);
    return NextResponse.json({ error: "Authentication could not reach MySQL. Check the database and local setup." }, { status: 503 });
  }
}
