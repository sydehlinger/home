import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import db from '../db';

const router = Router();

router.use(requireAuth);

// GET /api/meals?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/', async (req, res) => {
  const { start, end } = req.query as { start?: string; end?: string };
  let meals: any[];
  if (start && end) {
    meals = await db.prepare(
      'SELECT * FROM meal_plans WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date ASC, created_at ASC'
    ).all<any>(req.session.userId!, start, end);
  } else {
    meals = await db.prepare(
      'SELECT * FROM meal_plans WHERE user_id = ? ORDER BY date ASC, created_at ASC'
    ).all<any>(req.session.userId!);
  }
  res.json(meals);
});

router.post('/', async (req, res) => {
  const { date, meal_type, name } = req.body;
  const result = await db.prepare(
    'INSERT INTO meal_plans (user_id, date, meal_type, name) VALUES (?, ?, ?, ?)'
  ).run(req.session.userId!, date, meal_type, name);
  res.json(await db.prepare('SELECT * FROM meal_plans WHERE id = ?').get(result.lastInsertRowid));
});

router.patch('/:id', async (req, res) => {
  const { name } = req.body;
  const meal = await db.prepare('SELECT id FROM meal_plans WHERE id = ? AND user_id = ?')
    .get<any>(req.params.id, req.session.userId!);

  if (!meal) { res.status(404).json({ error: 'Not found' }); return; }

  await db.prepare('UPDATE meal_plans SET name = ? WHERE id = ?').run(name, req.params.id);
  res.json(await db.prepare('SELECT * FROM meal_plans WHERE id = ?').get(req.params.id));
});

router.delete('/:id', async (req, res) => {
  const meal = await db.prepare('SELECT id FROM meal_plans WHERE id = ? AND user_id = ?')
    .get<any>(req.params.id, req.session.userId!);

  if (!meal) { res.status(404).json({ error: 'Not found' }); return; }

  await db.prepare('DELETE FROM meal_plans WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
