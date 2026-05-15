import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import db from '../db';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const recipes = await db.prepare(
    'SELECT * FROM recipes WHERE user_id = ? ORDER BY updated_at DESC'
  ).all<any>(req.session.userId!);
  res.json(recipes);
});

router.post('/', async (req, res) => {
  const { title, content, tags } = req.body;
  const result = await db.prepare(
    'INSERT INTO recipes (user_id, title, content, tags) VALUES (?, ?, ?, ?)'
  ).run(req.session.userId!, title ?? 'Untitled Recipe', content ?? '', tags ?? '[]');
  res.json(await db.prepare('SELECT * FROM recipes WHERE id = ?').get(result.lastInsertRowid));
});

router.patch('/:id', async (req, res) => {
  const recipe = await db.prepare('SELECT id FROM recipes WHERE id = ? AND user_id = ?')
    .get<any>(req.params.id, req.session.userId!);
  if (!recipe) { res.status(404).json({ error: 'Not found' }); return; }

  const { title, content, tags } = req.body;
  await db.prepare(`
    UPDATE recipes SET
      title = COALESCE(?, title),
      content = COALESCE(?, content),
      tags = COALESCE(?, tags),
      updated_at = unixepoch()
    WHERE id = ?
  `).run(title ?? null, content ?? null, tags ?? null, req.params.id);

  res.json(await db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id));
});

router.delete('/:id', async (req, res) => {
  const recipe = await db.prepare('SELECT id FROM recipes WHERE id = ? AND user_id = ?')
    .get<any>(req.params.id, req.session.userId!);
  if (!recipe) { res.status(404).json({ error: 'Not found' }); return; }

  await db.prepare('DELETE FROM recipes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
