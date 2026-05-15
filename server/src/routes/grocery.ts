import { Router } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth } from '../middleware/requireAuth';
import db from '../db';

const router = Router();

router.use(requireAuth);

async function getOrCreateList(userId: number) {
  let list = await db.prepare('SELECT * FROM grocery_lists WHERE user_id = ?').get<any>(userId);
  if (!list) {
    const result = await db.prepare('INSERT INTO grocery_lists (user_id) VALUES (?)').run(userId);
    list = await db.prepare('SELECT * FROM grocery_lists WHERE id = ?').get(result.lastInsertRowid);
  }
  return list;
}

async function listWithItems(list: any) {
  const items = await db.prepare(
    'SELECT * FROM grocery_items WHERE list_id = ? ORDER BY checked ASC, created_at ASC'
  ).all(list.id);
  return { ...list, items };
}

router.get('/', async (req, res) => {
  const list = await getOrCreateList(req.session.userId!);
  res.json(await listWithItems(list));
});

router.patch('/', async (req, res) => {
  const { name } = req.body;
  const list = await getOrCreateList(req.session.userId!);
  await db.prepare('UPDATE grocery_lists SET name = ? WHERE id = ?').run(name, list.id);
  res.json(await listWithItems(await db.prepare('SELECT * FROM grocery_lists WHERE id = ?').get(list.id)));
});

router.post('/share', async (req, res) => {
  const list = await getOrCreateList(req.session.userId!);
  const token = randomUUID();
  await db.prepare('UPDATE grocery_lists SET share_token = ? WHERE id = ?').run(token, list.id);
  res.json({ share_token: token });
});

router.delete('/share', async (req, res) => {
  const list = await getOrCreateList(req.session.userId!);
  await db.prepare('UPDATE grocery_lists SET share_token = NULL WHERE id = ?').run(list.id);
  res.json({ ok: true });
});

router.post('/items', async (req, res) => {
  const { name } = req.body;
  const list = await getOrCreateList(req.session.userId!);
  const result = await db.prepare('INSERT INTO grocery_items (list_id, name) VALUES (?, ?)').run(list.id, name);
  res.json(await db.prepare('SELECT * FROM grocery_items WHERE id = ?').get(result.lastInsertRowid));
});

router.patch('/items/:id', async (req, res) => {
  const { checked, name } = req.body;
  const list = await getOrCreateList(req.session.userId!);
  const item = await db.prepare('SELECT id FROM grocery_items WHERE id = ? AND list_id = ?')
    .get<any>(req.params.id, list.id);

  if (!item) { res.status(404).json({ error: 'Not found' }); return; }

  await db.prepare('UPDATE grocery_items SET checked = COALESCE(?, checked), name = COALESCE(?, name) WHERE id = ?')
    .run(checked ?? null, name ?? null, req.params.id);
  res.json(await db.prepare('SELECT * FROM grocery_items WHERE id = ?').get(req.params.id));
});

router.delete('/items/checked', async (req, res) => {
  const list = await getOrCreateList(req.session.userId!);
  await db.prepare('DELETE FROM grocery_items WHERE list_id = ? AND checked = 1').run(list.id);
  res.json({ ok: true });
});

router.delete('/items/:id', async (req, res) => {
  const list = await getOrCreateList(req.session.userId!);
  await db.prepare('DELETE FROM grocery_items WHERE id = ? AND list_id = ?').run(req.params.id, list.id);
  res.json({ ok: true });
});

export default router;
