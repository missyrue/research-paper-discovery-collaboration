import mysql, { type Pool } from "mysql2/promise";

declare global {
  // eslint-disable-next-line no-var
  var atlasMysqlPool: Pool | undefined;
}

export function getDbPool(): Pool {
  if (globalThis.atlasMysqlPool) return globalThis.atlasMysqlPool;

  const { MYSQL_HOST, MYSQL_PORT, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD } = process.env;
  if (!MYSQL_HOST || !MYSQL_PORT || !MYSQL_DATABASE || !MYSQL_USER || !MYSQL_PASSWORD) {
    throw new Error("MySQL is not configured. Run database/mysql/setup-local.ps1 or copy apps/web/.env.example to .env.local.");
  }

  const pool = mysql.createPool({
    host: MYSQL_HOST,
    port: Number(MYSQL_PORT),
    database: MYSQL_DATABASE,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: "utf8mb4",
  });

  if (process.env.NODE_ENV !== "production") globalThis.atlasMysqlPool = pool;
  return pool;
}
