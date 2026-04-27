import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import db from '../db';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  const notes = db.prepare(
    'SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC'
  ).all(req.session.userId!) as any[];
  res.json(notes);
});

router.post('/', (req, res) => {
  const { title, content } = req.body;
  const result = db.prepare(
    'INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)'
  ).run(req.session.userId!, title ?? 'Untitled', content ?? '');
  res.json(db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid));
});

router.patch('/:id', (req, res) => {
  const note = db.prepare('SELECT id FROM notes WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.session.userId!) as any;

  if (!note) { res.status(404).json({ error: 'Not found' }); return; }

  const { title, content } = req.body;
  db.prepare(`
    UPDATE notes SET
      title = COALESCE(?, title),
      content = COALESCE(?, content),
      updated_at = unixepoch()
    WHERE id = ?
  `).run(title ?? null, content ?? null, req.params.id);

  res.json(db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const note = db.prepare('SELECT id FROM notes WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.session.userId!) as any;

  if (!note) { res.status(404).json({ error: 'Not found' }); return; }

  db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
