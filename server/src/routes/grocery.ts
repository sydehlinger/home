import { Router } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth } from '../middleware/requireAuth';
import db from '../db';

const router = Router();

router.use(requireAuth);

function getOrCreateList(userId: number) {
  let list = db.prepare('SELECT * FROM grocery_lists WHERE user_id = ?').get(userId) as any;
  if (!list) {
    const result = db.prepare('INSERT INTO grocery_lists (user_id) VALUES (?)').run(userId);
    list = db.prepare('SELECT * FROM grocery_lists WHERE id = ?').get(result.lastInsertRowid);
  }
  return list;
}

function listWithItems(list: any) {
  const items = db.prepare(
    'SELECT * FROM grocery_items WHERE list_id = ? ORDER BY checked ASC, created_at ASC'
  ).all(list.id);
  return { ...list, items };
}

router.get('/', (req, res) => {
  const list = getOrCreateList(req.session.userId!);
  res.json(listWithItems(list));
});

router.patch('/', (req, res) => {
  const { name } = req.body;
  const list = getOrCreateList(req.session.userId!);
  db.prepare('UPDATE grocery_lists SET name = ? WHERE id = ?').run(name, list.id);
  res.json(listWithItems(db.prepare('SELECT * FROM grocery_lists WHERE id = ?').get(list.id)));
});

router.post('/share', (req, res) => {
  const list = getOrCreateList(req.session.userId!);
  const token = randomUUID();
  db.prepare('UPDATE grocery_lists SET share_token = ? WHERE id = ?').run(token, list.id);
  res.json({ share_token: token });
});

router.delete('/share', (req, res) => {
  const list = getOrCreateList(req.session.userId!);
  db.prepare('UPDATE grocery_lists SET share_token = NULL WHERE id = ?').run(list.id);
  res.json({ ok: true });
});

router.post('/items', (req, res) => {
  const { name } = req.body;
  const list = getOrCreateList(req.session.userId!);
  const result = db.prepare('INSERT INTO grocery_items (list_id, name) VALUES (?, ?)').run(list.id, name);
  res.json(db.prepare('SELECT * FROM grocery_items WHERE id = ?').get(result.lastInsertRowid));
});

router.patch('/items/:id', (req, res) => {
  const { checked, name } = req.body;
  const list = getOrCreateList(req.session.userId!);
  const item = db.prepare('SELECT id FROM grocery_items WHERE id = ? AND list_id = ?')
    .get(req.params.id, list.id) as any;

  if (!item) { res.status(404).json({ error: 'Not found' }); return; }

  db.prepare('UPDATE grocery_items SET checked = COALESCE(?, checked), name = COALESCE(?, name) WHERE id = ?')
    .run(checked ?? null, name ?? null, req.params.id);
  res.json(db.prepare('SELECT * FROM grocery_items WHERE id = ?').get(req.params.id));
});

router.delete('/items/checked', (req, res) => {
  const list = getOrCreateList(req.session.userId!);
  db.prepare('DELETE FROM grocery_items WHERE list_id = ? AND checked = 1').run(list.id);
  res.json({ ok: true });
});

router.delete('/items/:id', (req, res) => {
  const list = getOrCreateList(req.session.userId!);
  db.prepare('DELETE FROM grocery_items WHERE id = ? AND list_id = ?').run(req.params.id, list.id);
  res.json({ ok: true });
});

export default router;
