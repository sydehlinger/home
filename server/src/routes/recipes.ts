import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import db from '../db';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const recipes = db.prepare(
    'SELECT * FROM recipes WHERE user_id = ? ORDER BY updated_at DESC'
  ).all(req.session.userId!) as any[];
  res.json(recipes);
});

router.post('/', (req, res) => {
  const { title, content, tags } = req.body;
  const result = db.prepare(
    'INSERT INTO recipes (user_id, title, content, tags) VALUES (?, ?, ?, ?)'
  ).run(req.session.userId!, title ?? 'Untitled Recipe', content ?? '', tags ?? '[]');
  res.json(db.prepare('SELECT * FROM recipes WHERE id = ?').get(result.lastInsertRowid));
});

router.patch('/:id', (req, res) => {
  const recipe = db.prepare('SELECT id FROM recipes WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.session.userId!) as any;
  if (!recipe) { res.status(404).json({ error: 'Not found' }); return; }

  const { title, content, tags } = req.body;
  db.prepare(`
    UPDATE recipes SET
      title = COALESCE(?, title),
      content = COALESCE(?, content),
      tags = COALESCE(?, tags),
      updated_at = unixepoch()
    WHERE id = ?
  `).run(title ?? null, content ?? null, tags ?? null, req.params.id);

  res.json(db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const recipe = db.prepare('SELECT id FROM recipes WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.session.userId!) as any;
  if (!recipe) { res.status(404).json({ error: 'Not found' }); return; }

  db.prepare('DELETE FROM recipes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
