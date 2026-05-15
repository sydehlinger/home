import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import db from '../db';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const books = await db.prepare(
    'SELECT * FROM books WHERE user_id = ? ORDER BY created_at DESC'
  ).all<any>(req.session.userId!);
  res.json(books);
});

router.post('/', async (req, res) => {
  const { title, author, isbn, formats, status, cover_url, rating, pages, notes, date_finished, ownership } = req.body;
  if (!title) { res.status(400).json({ error: 'Title required' }); return; }
  const effectiveStatus = status ?? 'to-read';
  const ownershipDefault = 'owned';
  const result = await db.prepare(`
    INSERT INTO books (user_id, title, author, isbn, formats, status, cover_url, rating, pages, notes, date_finished, ownership)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.session.userId!,
    title,
    author ?? null,
    isbn ?? null,
    formats ?? '["physical"]',
    effectiveStatus,
    cover_url ?? null,
    rating ?? null,
    pages ?? null,
    notes ?? null,
    date_finished ?? null,
    normalizeOwnership(ownership) ?? ownershipDefault,
  );
  res.json(await db.prepare('SELECT * FROM books WHERE id = ?').get(result.lastInsertRowid));
});

router.patch('/:id', async (req, res) => {
  const book = await db.prepare('SELECT id FROM books WHERE id = ? AND user_id = ?')
    .get<any>(req.params.id, req.session.userId!);

  if (!book) { res.status(404).json({ error: 'Not found' }); return; }

  const { title, author, isbn, formats, status, cover_url, rating, pages, notes, date_finished, ownership } = req.body;
  await db.prepare(`
    UPDATE books SET
      title = COALESCE(?, title),
      author = COALESCE(?, author),
      isbn = COALESCE(?, isbn),
      formats = COALESCE(?, formats),
      status = COALESCE(?, status),
      cover_url = COALESCE(?, cover_url),
      rating = COALESCE(?, rating),
      pages = COALESCE(?, pages),
      notes = COALESCE(?, notes),
      date_finished = COALESCE(?, date_finished),
      ownership = COALESCE(?, ownership),
      updated_at = unixepoch()
    WHERE id = ?
  `).run(
    title ?? null, author ?? null, isbn ?? null, formats ?? null, status ?? null,
    cover_url ?? null, rating ?? null, pages ?? null, notes ?? null, date_finished ?? null,
    normalizeOwnership(ownership) ?? null,
    req.params.id,
  );
  res.json(await db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id));
});

router.delete('/:id', async (req, res) => {
  const book = await db.prepare('SELECT id FROM books WHERE id = ? AND user_id = ?')
    .get<any>(req.params.id, req.session.userId!);

  if (!book) { res.status(404).json({ error: 'Not found' }); return; }

  await db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// OpenLibrary search proxy — avoids CORS, lets us shape results
router.get('/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) { res.json({ results: [] }); return; }

  try {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=10&fields=key,title,author_name,isbn,number_of_pages_median,cover_i,first_publish_year`;
    const r = await fetch(url);
    const data = await r.json() as any;
    const results = (data.docs ?? []).map((d: any) => ({
      title: d.title,
      author: (d.author_name ?? []).join(', ') || null,
      isbn: d.isbn?.[0] ?? null,
      pages: d.number_of_pages_median ?? null,
      cover_url: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
      year: d.first_publish_year ?? null,
    }));
    res.json({ results });
  } catch (e: any) {
    res.status(500).json({ error: 'OpenLibrary search failed', detail: e?.message });
  }
});

// Backfill OpenLibrary covers for books with ISBN but no cover
router.post('/backfill-covers', async (req, res) => {
  const rows = await db.prepare(
    `SELECT id, isbn FROM books WHERE user_id = ? AND (cover_url IS NULL OR cover_url = '') AND isbn IS NOT NULL AND isbn != ''`
  ).all<{ id: number; isbn: string }>(req.session.userId!);

  let updated = 0;
  await db.transaction(async (tx) => {
    const update = tx.prepare('UPDATE books SET cover_url = ?, updated_at = unixepoch() WHERE id = ?');
    for (const r of rows) {
      const digits = r.isbn.replace(/[^0-9X]/gi, '');
      if (digits.length < 10) continue;
      await update.run(`https://covers.openlibrary.org/b/isbn/${digits}-M.jpg?default=false`, r.id);
      updated++;
    }
  });
  res.json({ updated });
});

// Import StoryGraph CSV export
router.post('/import', async (req, res) => {
  const csv = String(req.body?.csv ?? '');
  if (!csv.trim()) { res.status(400).json({ error: 'No CSV provided' }); return; }

  const rows = parseCsv(csv);
  if (rows.length < 2) { res.status(400).json({ error: 'CSV is empty or missing rows' }); return; }

  const header = rows[0].map(h => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name.toLowerCase());

  const titleI    = idx('Title');
  const authorsI  = idx('Authors');
  const isbnI     = idx('ISBN/UID');
  const formatI   = idx('Format');
  const statusI   = idx('Read Status');
  const ratingI   = idx('Star Rating');
  const reviewI   = idx('Review');
  const lastReadI = idx('Last Date Read');
  const ownedI    = idx('Owned?');

  if (titleI < 0) { res.status(400).json({ error: 'CSV missing Title column' }); return; }

  let imported = 0;
  let updated = 0;

  await db.transaction(async (tx) => {
    const insert = tx.prepare(`
      INSERT INTO books (user_id, title, author, isbn, formats, status, rating, notes, date_finished, cover_url, ownership)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Dedupe: prefer ISBN match, fall back to title+author. Re-import updates ownership/status/rating only.
    const findByIsbn = tx.prepare(`SELECT id FROM books WHERE user_id = ? AND isbn = ? AND isbn != ''`);
    const findByTitleAuthor = tx.prepare(`SELECT id FROM books WHERE user_id = ? AND lower(title) = lower(?) AND lower(COALESCE(author, '')) = lower(COALESCE(?, ''))`);
    const updateExisting = tx.prepare(`
      UPDATE books SET ownership = ?, status = ?, rating = COALESCE(?, rating), updated_at = unixepoch() WHERE id = ?
    `);

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const title = (row[titleI] ?? '').trim();
      if (!title) continue;

      const author = (row[authorsI] ?? '').trim() || null;
      const isbn = (row[isbnI] ?? '').trim() || null;

      const rawFormat = (row[formatI] ?? '').trim().toLowerCase();
      const formats = JSON.stringify([mapFormat(rawFormat)]);

      const rawStatus = (row[statusI] ?? '').trim().toLowerCase();
      const status = mapStatus(rawStatus);

      const ratingStr = (row[ratingI] ?? '').trim();
      const rating = ratingStr ? parseFloat(ratingStr) : null;
      const ratingClean = rating != null && !isNaN(rating) ? rating : null;

      const lastRead = (row[lastReadI] ?? '').trim();
      let dateFinished: number | null = null;
      if (lastRead && status === 'read') {
        const t = Date.parse(lastRead);
        if (!isNaN(t)) dateFinished = Math.floor(t / 1000);
      }

      const isbnDigits = isbn?.replace(/[^0-9X]/gi, '') ?? null;
      const coverUrl = isbnDigits && isbnDigits.length >= 10
        ? `https://covers.openlibrary.org/b/isbn/${isbnDigits}-M.jpg?default=false`
        : null;

      // StoryGraph "Owned?" -> ownership ('owned' | 'none'). TBR is derived from status, not ownership.
      const ownedRaw = ownedI >= 0 ? (row[ownedI] ?? '').trim().toLowerCase() : '';
      const ownership: string = ownedRaw === 'yes' ? 'owned' : 'none';

      let existing: { id: number } | undefined;
      if (isbn) existing = await findByIsbn.get<{ id: number }>(req.session.userId!, isbn);
      if (!existing) existing = await findByTitleAuthor.get<{ id: number }>(req.session.userId!, title, author);

      if (existing) {
        await updateExisting.run(ownership, status, ratingClean, existing.id);
        updated++;
        continue;
      }

      await insert.run(
        req.session.userId!,
        title,
        author,
        isbn,
        formats,
        status,
        ratingClean,
        (row[reviewI] ?? '').trim() || null,
        dateFinished,
        coverUrl,
        ownership,
      );
      imported++;
    }
  });

  res.json({ imported, updated });
});

function normalizeOwnership(v: unknown): string | null {
  if (v == null) return null;
  return v === 'owned' || v === 'none' ? v : null;
}

function mapFormat(s: string): string {
  if (!s) return 'physical';
  if (s.includes('audio')) return 'audio';
  if (s.includes('ebook') || s.includes('digital') || s.includes('kindle')) return 'ebook';
  return 'physical';
}

function mapStatus(s: string): string {
  if (s.includes('currently')) return 'reading';
  if (s.includes('did-not') || s.includes('did not')) return 'dnf';
  if (s === 'read') return 'read';
  return 'to-read';
}

// Minimal RFC-4180-ish CSV parser (handles quoted fields, escaped quotes, embedded newlines/commas)
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }

    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }

  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

export default router;
