import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import db from '../db';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const notes = await db.prepare(
    'SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC'
  ).all<any>(req.session.userId!);
  res.json(notes);
});

router.post('/', async (req, res) => {
  const { title, content } = req.body;
  const result = await db.prepare(
    'INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)'
  ).run(req.session.userId!, title ?? 'Untitled', content ?? '');
  res.json(await db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid));
});

router.patch('/:id', async (req, res) => {
  const note = await db.prepare('SELECT id FROM notes WHERE id = ? AND user_id = ?')
    .get<any>(req.params.id, req.session.userId!);

  if (!note) { res.status(404).json({ error: 'Not found' }); return; }

  const { title, content } = req.body;
  await db.prepare(`
    UPDATE notes SET
      title = COALESCE(?, title),
      content = COALESCE(?, content),
      updated_at = unixepoch()
    WHERE id = ?
  `).run(title ?? null, content ?? null, req.params.id);

  res.json(await db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id));
});

router.delete('/:id', async (req, res) => {
  const note = await db.prepare('SELECT id FROM notes WHERE id = ? AND user_id = ?')
    .get<any>(req.params.id, req.session.userId!);

  if (!note) { res.status(404).json({ error: 'Not found' }); return; }

  await db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
