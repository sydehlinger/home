import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import db from '../db';

const router = Router();
router.use(requireAuth);

const DEFAULT_CATEGORIES = [
  { name: 'Recurring', type: 'withdrawal', color: '#6366f1' },
  { name: 'Insurance', type: 'withdrawal', color: '#3b82f6' },
  { name: 'Utilities', type: 'withdrawal', color: '#8b5cf6' },
  { name: 'Car', type: 'withdrawal', color: '#f97316' },
  { name: 'Subscriptions', type: 'withdrawal', color: '#ec4899' },
  { name: 'Groceries', type: 'withdrawal', color: '#10b981' },
  { name: 'Eating Out', type: 'withdrawal', color: '#f59e0b' },
  { name: 'Gas', type: 'withdrawal', color: '#ef4444' },
  { name: 'Cats', type: 'withdrawal', color: '#14b8a6' },
  { name: 'Fun', type: 'withdrawal', color: '#a855f7' },
  { name: 'Hobbies', type: 'withdrawal', color: '#06b6d4' },
  { name: 'Clothes/Beauty', type: 'withdrawal', color: '#f472b6' },
  { name: 'Other', type: 'withdrawal', color: '#6b7280' },
  { name: 'Emergency Savings', type: 'deposit', color: '#22c55e' },
  { name: 'Down Payment', type: 'deposit', color: '#0ea5e9' },
  { name: 'Deposits', type: 'deposit', color: '#84cc16' },
];

router.get('/categories', async (req, res) => {
  const userId = req.session.userId!;
  let cats = await db.prepare('SELECT * FROM budget_categories WHERE user_id = ? ORDER BY name').all<any>(userId);
  if (cats.length === 0) {
    await db.transaction(async (tx) => {
      const insert = tx.prepare('INSERT INTO budget_categories (user_id, name, type, color) VALUES (?, ?, ?, ?)');
      for (const c of DEFAULT_CATEGORIES) await insert.run(userId, c.name, c.type, c.color);
    });
    cats = await db.prepare('SELECT * FROM budget_categories WHERE user_id = ? ORDER BY name').all<any>(userId);
  }
  res.json(cats);
});

router.post('/categories', async (req, res) => {
  const { name, type, color } = req.body;
  if (!name || !type || !color) { res.status(400).json({ error: 'Missing fields' }); return; }
  if (type !== 'withdrawal' && type !== 'deposit') { res.status(400).json({ error: 'Invalid type' }); return; }
  try {
    const result = await db.prepare(
      'INSERT INTO budget_categories (user_id, name, type, color) VALUES (?, ?, ?, ?)'
    ).run(req.session.userId!, String(name), type, String(color));
    res.json(await db.prepare('SELECT * FROM budget_categories WHERE id = ?').get(result.lastInsertRowid));
  } catch (err: any) {
    // Postgres unique-violation error code.
    if (err.code === '23505') { res.status(409).json({ error: 'Category already exists' }); return; }
    throw err;
  }
});

router.delete('/categories/:id', async (req, res) => {
  const result = await db.prepare('DELETE FROM budget_categories WHERE id = ? AND user_id = ?').run(req.params.id, req.session.userId!);
  if (result.changes === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ ok: true });
});

router.get('/', async (req, res) => {
  const { month, year } = req.query;
  const transactions = month
    ? await db.prepare('SELECT * FROM transactions WHERE user_id = ? AND date LIKE ? ORDER BY date DESC').all(req.session.userId, `${month}%`)
    : year
    ? await db.prepare('SELECT * FROM transactions WHERE user_id = ? AND date LIKE ? ORDER BY date ASC').all(req.session.userId, `${year}%`)
    : await db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC').all(req.session.userId);
  res.json(transactions);
});

router.post('/', async (req, res) => {
  const { date, description, amount, category } = req.body;
  if (!date || !description || amount == null || !category) {
    res.status(400).json({ error: 'Missing fields' }); return;
  }
  const result = await db.prepare(
    'INSERT INTO transactions (user_id, date, description, amount, category) VALUES (?, ?, ?, ?, ?)'
  ).run(req.session.userId, date, String(description), Number(amount), String(category));
  res.json(await db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid));
});

router.post('/import', async (req, res) => {
  const { transactions } = req.body;
  if (!Array.isArray(transactions) || transactions.length === 0) {
    res.status(400).json({ error: 'No transactions provided' }); return;
  }
  await db.transaction(async (tx) => {
    const insert = tx.prepare(
      'INSERT INTO transactions (user_id, date, description, amount, category) VALUES (?, ?, ?, ?, ?)'
    );
    for (const t of transactions) {
      await insert.run(req.session.userId, String(t.date), String(t.description), Number(t.amount), String(t.category));
    }
  });
  res.json({ imported: transactions.length });
});

router.delete('/:id', async (req, res) => {
  const tx = await db.prepare('SELECT id FROM transactions WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
  if (!tx) { res.status(404).json({ error: 'Not found' }); return; }
  await db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
