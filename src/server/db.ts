/**
 * Akses database. Produksi: Neon/PostgreSQL lewat `pg` (pakai connection string pooled dari Neon).
 * Pengembangan tanpa DATABASE_URL: PGlite (PostgreSQL di dalam proses) di folder .data/.
 * Instance disimpan di globalThis agar server WebSocket dan route Next.js memakai koneksi yang sama.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA_SQL } from "./schema";
import { ConfigError, databaseUrl, onVercel, pgConnectionString } from "./env";

export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

export interface Db extends Queryable {
  /** Menjalankan beberapa kueri sebagai satu transaksi: semuanya berhasil, atau semuanya dibatalkan. */
  transaction<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
}

const g = globalThis as unknown as { __meetopiaDb?: Promise<Db> };

async function create(): Promise<Db> {
  const url = databaseUrl();
  let db: Db;
  let exec: (sql: string) => Promise<unknown>;
  if (url) {
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: pgConnectionString(url),
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
    // Neon menutup koneksi yang menganggur; tanpa penangan ini Node melempar error dan proses mati.
    pool.on("error", (e) => console.error("[db] koneksi menganggur putus", e.message));
    db = {
      query: async (sql, params) => (await pool.query(sql, params as unknown[])).rows,
      transaction: async (fn) => {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const result = await fn({
            query: async (sql, params) => (await client.query(sql, params as unknown[])).rows,
          });
          await client.query("COMMIT");
          return result;
        } catch (e) {
          await client.query("ROLLBACK").catch(() => {});
          throw e;
        } finally {
          client.release();
        }
      },
    };
    // Skema hanya dijalankan bila berubah. ALTER TABLE mengunci tabel; menjalankannya di setiap cold
    // start membuat permintaan tertahan atau deadlock. Kunci advisory menahan instance lain yang
    // menyala bersamaan sampai yang pertama selesai (semua perintah satu transaksi implisit).
    exec = async (sql) => {
      const version = createHash("sha256").update(sql).digest("hex");
      const current = await pool
        .query<{ v: string }>("SELECT v FROM schema_meta WHERE k = 'schema'")
        .then((r) => r.rows[0]?.v)
        .catch(() => undefined);
      if (current === version) return;
      await pool.query(
        `SELECT pg_advisory_xact_lock(7243150);
        ${sql}
        CREATE TABLE IF NOT EXISTS schema_meta (k text PRIMARY KEY, v text NOT NULL);
        INSERT INTO schema_meta (k, v) VALUES ('schema', '${version}')
          ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;`,
      );
    };
  } else {
    // Sistem berkas Vercel hanya-baca dan tidak permanen: wajib memakai Neon (DATABASE_URL).
    if (onVercel) throw new ConfigError("dbNotConfigured");
    const { PGlite } = await import("@electric-sql/pglite");
    const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data/pglite");
    if (dir !== "memory://") fs.mkdirSync(dir, { recursive: true });
    const lite = new PGlite(dir);
    db = {
      query: async (sql, params) => (await lite.query(sql, params as unknown[])).rows as never,
      transaction: (fn) =>
        lite.transaction((tx) =>
          fn({ query: async (sql, params) => (await tx.query(sql, params as unknown[])).rows as never }),
        ),
    };
    exec = (sql) => lite.exec(sql);
  }
  await exec(SCHEMA_SQL);
  return db;
}

export function getDb(): Promise<Db> {
  if (!g.__meetopiaDb) {
    g.__meetopiaDb = create().catch((e) => {
      g.__meetopiaDb = undefined;
      throw e;
    });
  }
  return g.__meetopiaDb;
}

export async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await getDb()).query<T>(text, params);
}

export async function one<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await sql<T>(text, params);
  return rows[0] ?? null;
}

export async function transaction<T>(fn: (q: Queryable) => Promise<T>): Promise<T> {
  return (await getDb()).transaction(fn);
}
