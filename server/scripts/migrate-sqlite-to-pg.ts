// One-time migration: copies all rows from a local SQLite home.db into Postgres.
//
// Usage:
//   1. Set DATABASE_URL in env (or .env) to the target Postgres connection string.
//      For Render, copy the External Database URL from the Render dashboard.
//   2. Make sure SQLITE_PATH points at your local home.db (default: ../home.db relative to this script).
//   3. Run from the server directory:
//        npx ts-node scripts/migrate-sqlite-to-pg.ts
//
// The script preserves primary key IDs from SQLite and resets each table's sequence
// to MAX(id)+1 afterward, so subsequent inserts don't collide.
//
// Re-running is safe: if the target Postgres already has rows for a table, that
// table is skipped (we don't want to merge or duplicate). To force a full re-run,
// truncate the target tables first.

import 'dotenv/config';
import path from 'path';
import { Pool } from 'pg';
import Database from 'better-sqlite3';

const SQLITE_PATH = process.env.SQLITE_PATH ?? path.resolve(__dirname, '..', 'home.db');
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Aborting.');
  process.exit(1);
}

const SSL = process.env.DATABASE_SSL === 'disable' ? false : { rejectUnauthorized: false };

// Order matters because of foreign keys.
const TABLES: { name: string; columns: string[] }[] = [
  { name: 'users', columns: ['id', 'google_id', 'email', 'name', 'access_token', 'refresh_token', 'token_expiry', 'created_at'] },
  { name: 'workspaces', columns: ['id', 'user_id', 'name', 'color', 'created_at'] },
  { name: 'projects', columns: ['id', 'user_id', 'workspace_id', 'name', 'description', 'status', 'url', 'color', 'created_at', 'updated_at'] },
  { name: 'workspace_resources', columns: ['id', 'workspace_id', 'type', 'title', 'url', 'content', 'created_at'] },
  { name: 'project_notes', columns: ['id', 'project_id', 'content', 'created_at'] },
  { name: 'meal_plans', columns: ['id', 'user_id', 'date', 'meal_type', 'name', 'created_at'] },
  { name: 'grocery_lists', columns: ['id', 'user_id', 'name', 'share_token', 'created_at'] },
  { name: 'grocery_items', columns: ['id', 'list_id', 'name', 'checked', 'created_at'] },
  { name: 'notes', columns: ['id', 'user_id', 'title', 'content', 'created_at', 'updated_at'] },
  { name: 'recipes', columns: ['id', 'user_id', 'title', 'content', 'tags', 'created_at', 'updated_at'] },
  { name: 'packages', columns: ['id', 'user_id', 'tracking_number', 'carrier', 'label', 'status', 'expected_delivery', 'delivered_at', 'created_at'] },
  { name: 'transactions', columns: ['id', 'user_id', 'date', 'description', 'amount', 'category', 'created_at'] },
  { name: 'budget_categories', columns: ['id', 'user_id', 'name', 'type', 'color', 'created_at'] },
  { name: 'books', columns: ['id', 'user_id', 'title', 'author', 'isbn', 'formats', 'status', 'cover_url', 'rating', 'pages', 'notes', 'date_finished', 'ownership', 'created_at', 'updated_at'] },
];

async function main() {
  console.log(`SQLite source: ${SQLITE_PATH}`);
  console.log(`Postgres target: ${DATABASE_URL!.replace(/:\/\/[^@]+@/, '://***@')}`);

  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  const pg = new Pool({ connectionString: DATABASE_URL, ssl: SSL });

  try {
    // Sanity check the target schema is there.
    const tableCheck = await pg.query(`SELECT to_regclass('users') AS exists`);
    if (!tableCheck.rows[0].exists) {
      console.error('Target Postgres has no `users` table. Boot the server once first to run initSchema(), then re-run this script.');
      process.exit(1);
    }

    for (const { name, columns } of TABLES) {
      const existingCount = await pg.query(`SELECT COUNT(*)::int AS n FROM ${name}`);
      if (existingCount.rows[0].n > 0) {
        console.log(`  ${name}: target has ${existingCount.rows[0].n} rows, skipping`);
        continue;
      }

      const sourceRows = sqlite.prepare(`SELECT ${columns.join(', ')} FROM ${name}`).all() as any[];
      if (sourceRows.length === 0) {
        console.log(`  ${name}: source is empty, skipping`);
        continue;
      }

      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const sql = `INSERT INTO ${name} (${columns.join(', ')}) VALUES (${placeholders})`;
      const client = await pg.connect();
      try {
        await client.query('BEGIN');
        for (const row of sourceRows) {
          await client.query(sql, columns.map((c) => row[c]));
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      // Reset sequence so future inserts don't collide with copied IDs.
      // BIGSERIAL columns have a sequence named `<table>_<col>_seq`.
      await pg.query(`SELECT setval(pg_get_serial_sequence('${name}', 'id'), COALESCE((SELECT MAX(id) FROM ${name}), 0) + 1, false)`);

      console.log(`  ${name}: copied ${sourceRows.length} rows`);
    }

    console.log('Migration complete.');
  } finally {
    sqlite.close();
    await pg.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
