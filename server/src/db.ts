import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

export type Pool = pg.Pool;

export function createPool(databaseUrl: string): Pool {
  return new pg.Pool({ connectionString: databaseUrl });
}

export async function migrate(pool: Pool): Promise<void> {
  const sqlPath = join(dirname(fileURLToPath(import.meta.url)), "../sql/001_init.sql");
  const sql = readFileSync(sqlPath, "utf8");
  await pool.query(sql);
}
