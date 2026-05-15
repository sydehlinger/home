import { Pool, PoolClient } from 'pg';
import { config } from '../lib/config';

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.dbSsl,
});

// Migration from better-sqlite3 used `?` placeholders; pg uses `$1, $2, ...`. Auto-convert
// so call sites don't need to renumber. Also auto-append `RETURNING id` to bare INSERTs
// so `.run().lastInsertRowid` keeps working — every table has an `id` PK.
function adaptSql(sql: string): string {
  let i = 0;
  let pgSql = sql.replace(/\?/g, () => `$${++i}`);
  if (/^\s*INSERT\s/i.test(pgSql) && !/\bRETURNING\b/i.test(pgSql)) {
    pgSql = pgSql.replace(/;?\s*$/, '') + ' RETURNING id';
  }
  return pgSql;
}

type Runner = Pool | PoolClient;

export interface Statement {
  get<T = any>(...params: any[]): Promise<T | undefined>;
  all<T = any>(...params: any[]): Promise<T[]>;
  run(...params: any[]): Promise<{ lastInsertRowid: any; changes: number }>;
}

function makeStmt(sql: string, runner: () => Runner): Statement {
  const pgSql = adaptSql(sql);
  return {
    async get<T = any>(...params: any[]): Promise<T | undefined> {
      const r = await runner().query(pgSql, params);
      return r.rows[0] as T | undefined;
    },
    async all<T = any>(...params: any[]): Promise<T[]> {
      const r = await runner().query(pgSql, params);
      return r.rows as T[];
    },
    async run(...params: any[]): Promise<{ lastInsertRowid: any; changes: number }> {
      const r = await runner().query(pgSql, params);
      return { lastInsertRowid: (r.rows[0] as any)?.id, changes: r.rowCount ?? 0 };
    },
  };
}

export interface Db {
  prepare(sql: string): Statement;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  pool: Pool;
}

const db: Db = {
  prepare(sql: string) {
    return makeStmt(sql, () => pool);
  },
  async exec(sql: string) {
    await pool.query(sql);
  },
  async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tx: Db = {
        prepare: (sql: string) => makeStmt(sql, () => client),
        exec: async (sql: string) => { await client.query(sql); },
        transaction: () => { throw new Error('Nested transactions are not supported'); },
        pool,
      };
      const result = await fn(tx);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
  pool,
};

export async function initSchema(): Promise<void> {
  // unixepoch() function so existing SQL strings using it keep working unchanged.
  await pool.query(`
    CREATE OR REPLACE FUNCTION unixepoch() RETURNS BIGINT AS $$
      SELECT EXTRACT(EPOCH FROM NOW())::BIGINT;
    $$ LANGUAGE SQL STABLE;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      google_id TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      token_expiry BIGINT,
      created_at BIGINT DEFAULT unixepoch()
    );

    CREATE TABLE IF NOT EXISTS workspaces (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6366f1',
      created_at BIGINT DEFAULT unixepoch()
    );

    CREATE TABLE IF NOT EXISTS projects (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id),
      workspace_id BIGINT REFERENCES workspaces(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      url TEXT,
      color TEXT DEFAULT '#6366f1',
      created_at BIGINT DEFAULT unixepoch(),
      updated_at BIGINT DEFAULT unixepoch()
    );

    CREATE TABLE IF NOT EXISTS workspace_resources (
      id BIGSERIAL PRIMARY KEY,
      workspace_id BIGINT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'link',
      title TEXT NOT NULL,
      url TEXT,
      content TEXT,
      created_at BIGINT DEFAULT unixepoch()
    );

    CREATE TABLE IF NOT EXISTS project_notes (
      id BIGSERIAL PRIMARY KEY,
      project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at BIGINT DEFAULT unixepoch()
    );

    CREATE TABLE IF NOT EXISTS meal_plans (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      meal_type TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at BIGINT DEFAULT unixepoch()
    );

    CREATE TABLE IF NOT EXISTS grocery_lists (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL DEFAULT 'Grocery List',
      share_token TEXT UNIQUE,
      created_at BIGINT DEFAULT unixepoch()
    );

    CREATE TABLE IF NOT EXISTS grocery_items (
      id BIGSERIAL PRIMARY KEY,
      list_id BIGINT NOT NULL REFERENCES grocery_lists(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      checked INTEGER NOT NULL DEFAULT 0,
      created_at BIGINT DEFAULT unixepoch()
    );

    CREATE TABLE IF NOT EXISTS notes (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL DEFAULT 'Untitled',
      content TEXT NOT NULL DEFAULT '',
      created_at BIGINT DEFAULT unixepoch(),
      updated_at BIGINT DEFAULT unixepoch()
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL DEFAULT 'Untitled Recipe',
      content TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      created_at BIGINT DEFAULT unixepoch(),
      updated_at BIGINT DEFAULT unixepoch()
    );

    CREATE TABLE IF NOT EXISTS packages (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id),
      tracking_number TEXT NOT NULL,
      carrier TEXT NOT NULL,
      label TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      expected_delivery BIGINT,
      delivered_at BIGINT,
      created_at BIGINT DEFAULT unixepoch()
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      created_at BIGINT DEFAULT unixepoch()
    );

    CREATE TABLE IF NOT EXISTS budget_categories (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'withdrawal',
      color TEXT NOT NULL DEFAULT '#6366f1',
      created_at BIGINT DEFAULT unixepoch(),
      UNIQUE(user_id, name)
    );

    CREATE TABLE IF NOT EXISTS books (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      author TEXT,
      isbn TEXT,
      formats TEXT NOT NULL DEFAULT '["physical"]',
      status TEXT NOT NULL DEFAULT 'to-read',
      cover_url TEXT,
      rating REAL,
      pages INTEGER,
      notes TEXT,
      date_finished BIGINT,
      ownership TEXT NOT NULL DEFAULT 'none',
      created_at BIGINT DEFAULT unixepoch(),
      updated_at BIGINT DEFAULT unixepoch()
    );
  `);
}

export default db;
