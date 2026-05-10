import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(__dirname, '../../home.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expiry INTEGER,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    url TEXT,
    color TEXT DEFAULT '#6366f1',
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS project_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS meal_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    date TEXT NOT NULL,
    meal_type TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS grocery_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL DEFAULT 'Grocery List',
    share_token TEXT UNIQUE,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS grocery_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER NOT NULL REFERENCES grocery_lists(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    checked INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL DEFAULT 'Untitled',
    content TEXT NOT NULL DEFAULT '',
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL DEFAULT 'Untitled Recipe',
    content TEXT NOT NULL DEFAULT '',
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    tracking_number TEXT NOT NULL,
    carrier TEXT NOT NULL,
    label TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    expected_delivery INTEGER,
    delivered_at INTEGER,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS budget_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'withdrawal',
    color TEXT NOT NULL DEFAULT '#6366f1',
    created_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(user_id, name)
  );

  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    author TEXT,
    isbn TEXT,
    formats TEXT NOT NULL DEFAULT '["physical"]',
    status TEXT NOT NULL DEFAULT 'to-read',
    cover_url TEXT,
    rating REAL,
    pages INTEGER,
    notes TEXT,
    date_finished INTEGER,
    ownership TEXT NOT NULL DEFAULT 'none',
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );
`);

// Migrations for columns added after initial schema
try { db.exec(`ALTER TABLE recipes ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'`); } catch {}

// books: format (single) -> formats (JSON array)
try { db.exec(`ALTER TABLE books ADD COLUMN formats TEXT NOT NULL DEFAULT '["physical"]'`); } catch {}
try { db.exec(`UPDATE books SET formats = json_array(format) WHERE format IS NOT NULL`); } catch {}
try { db.exec(`ALTER TABLE books DROP COLUMN format`); } catch {}

// books: owned column. Backfill heuristic: to-read books are wishlist, others are owned.
// Both statements run together; if ALTER throws (column exists), UPDATE is skipped — preserves user edits.
try {
  db.exec(`ALTER TABLE books ADD COLUMN owned INTEGER NOT NULL DEFAULT 1`);
  db.exec(`UPDATE books SET owned = 0 WHERE status = 'to-read'`);
} catch {}

// books: owned (bool) -> ownership (tri-state: 'owned' | 'tbr' | 'none').
// Atomic block: if ALTER fails (column exists), no other statements run.
try {
  db.exec(`ALTER TABLE books ADD COLUMN ownership TEXT NOT NULL DEFAULT 'none'`);
  db.exec(`
    UPDATE books SET ownership = CASE
      WHEN owned = 1            THEN 'owned'
      WHEN status = 'to-read'   THEN 'tbr'
      ELSE                           'none'
    END
  `);
  db.exec(`ALTER TABLE books DROP COLUMN owned`);
} catch {}

// books: collapse ownership 'wishlist' / 'tbr' -> 'none' (TBR now derives from status, not ownership)
// Idempotent: no-op once no rows have those legacy values.
try { db.exec(`UPDATE books SET ownership = 'none' WHERE ownership IN ('wishlist', 'tbr')`); } catch {}

export default db;
