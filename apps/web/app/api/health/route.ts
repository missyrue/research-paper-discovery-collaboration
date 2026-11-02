import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getDbPool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [rows] = await getDbPool().query<Array<RowDataPacket & { database_name: string; mysql_version: string }>>(
      "SELECT DATABASE() AS database_name, VERSION() AS mysql_version",
    );
    return NextResponse.json({ status: "connected", ...rows[0] });
  } catch (error) {
    console.error("MySQL health check failed:", error);
    return NextResponse.json({ status: "disconnected", message: "Check apps/web/.env.local and the local MySQL service." }, { status: 503 });
  }
}
