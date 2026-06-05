import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

type DB = NodePgDatabase<typeof schema>;

let _db: DB | null = null;

/**
 * Lazily initialize the database connection on first use.
 * This lets the server boot WITHOUT DATABASE_URL — scanning / AI analysis
 * still work; only portfolio sync (which touches the DB) requires it and
 * will surface a clear error at query time instead of crashing on startup.
 */
function init() {
  if (_db) return;
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Portfolio sync needs a PostgreSQL database; " +
        "scanning and AI analysis work without it.",
    );
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  _db = drizzle(pool, { schema });
}

/** Lazy proxy: behaves like the drizzle `db` but initializes on first access. */
export const db = new Proxy({} as DB, {
  get(_target, prop) {
    init();
    const value = (_db as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(_db) : value;
  },
});
