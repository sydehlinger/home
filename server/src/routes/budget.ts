import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import db from '../db';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const { month, year } = req.query;
  const transactions = month
    ? db.prepare('SELECT * FROM transactions WHERE user_id = ? AND date LIKE ? ORDER BY date DESC').all(req.session.userId, `${month}%`)
    : year
    ? db.prepare('SELECT * FROM transactions WHERE user_id = ? AND date LIKE ? ORDER BY date ASC').all(req.session.userId, `${year}%`)
    : db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC').all(req.session.userId);
  res.json(transactions);
});

router.post('/', (req, res) => {
  const { date, description, amount, category } = req.body;
  if (!date || !description || amount == null || !category) {
    res.status(400).json({ error: 'Missing fields' }); return;
  }
  const result = db.prepare(
    'INSERT INTO transactions (user_id, date, description, amount, category) VALUES (?, ?, ?, ?, ?)'
  ).run(req.session.userId, date, String(description), Number(amount), String(category));
  res.json(db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid));
});

router.post('/import', (req, res) => {
  const { transactions } = req.body;
  if (!Array.isArray(transactions) || transactions.length === 0) {
    res.status(400).json({ error: 'No transactions provided' }); return;
  }
  const insert = db.prepare(
    'INSERT INTO transactions (user_id, date, description, amount, category) VALUES (?, ?, ?, ?, ?)'
  );
  const insertAll = db.transaction((txs: any[]) => {
    for (const tx of txs) {
      insert.run(req.session.userId, String(tx.date), String(tx.description), Number(tx.amount), String(tx.category));
    }
  });
  insertAll(transactions);
  res.json({ imported: transactions.length });
});

router.delete('/:id', (req, res) => {
  const tx = db.prepare('SELECT id FROM transactions WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
  if (!tx) { res.status(404).json({ error: 'Not found' }); return; }
  db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
