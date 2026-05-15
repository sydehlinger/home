import { Router } from 'express';
import db from '../db';

const router = Router();

async function getListByToken(token: string) {
  return await db.prepare('SELECT * FROM grocery_lists WHERE share_token = ?').get<any>(token);
}

async function listWithItems(list: any) {
  const items = await db.prepare(
    'SELECT * FROM grocery_items WHERE list_id = ? ORDER BY checked ASC, created_at ASC'
  ).all(list.id);
  return { ...list, items };
}

router.get('/:token', async (req, res) => {
  const list = await getListByToken(req.params.token);
  if (!list) { res.status(404).json({ error: 'List not found' }); return; }
  res.json(await listWithItems(list));
});

router.post('/:token/items', async (req, res) => {
  const list = await getListByToken(req.params.token);
  if (!list) { res.status(404).json({ error: 'List not found' }); return; }

  const { name } = req.body;
  const result = await db.prepare('INSERT INTO grocery_items (list_id, name) VALUES (?, ?)').run(list.id, name);
  res.json(await db.prepare('SELECT * FROM grocery_items WHERE id = ?').get(result.lastInsertRowid));
});

router.patch('/:token/items/:id', async (req, res) => {
  const list = await getListByToken(req.params.token);
  if (!list) { res.status(404).json({ error: 'List not found' }); return; }

  const { checked, name } = req.body;
  const item = await db.prepare('SELECT id FROM grocery_items WHERE id = ? AND list_id = ?')
    .get<any>(req.params.id, list.id);
  if (!item) { res.status(404).json({ error: 'Not found' }); return; }

  await db.prepare('UPDATE grocery_items SET checked = COALESCE(?, checked), name = COALESCE(?, name) WHERE id = ?')
    .run(checked ?? null, name ?? null, req.params.id);
  res.json(await db.prepare('SELECT * FROM grocery_items WHERE id = ?').get(req.params.id));
});

router.delete('/:token/items/:id', async (req, res) => {
  const list = await getListByToken(req.params.token);
  if (!list) { res.status(404).json({ error: 'List not found' }); return; }

  await db.prepare('DELETE FROM grocery_items WHERE id = ? AND list_id = ?').run(req.params.id, list.id);
  res.json({ ok: true });
});

export default router;
