import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import db from '../db';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const workspaces = await db.prepare(
    'SELECT * FROM workspaces WHERE user_id = ? ORDER BY created_at ASC'
  ).all(req.session.userId!);
  res.json(workspaces);
});

router.post('/', async (req, res) => {
  const { name, color } = req.body;
  const result = await db.prepare(
    'INSERT INTO workspaces (user_id, name, color) VALUES (?, ?, ?)'
  ).run(req.session.userId!, name, color ?? '#6366f1');
  res.json(await db.prepare('SELECT * FROM workspaces WHERE id = ?').get(result.lastInsertRowid));
});

router.patch('/:id', async (req, res) => {
  const { name, color } = req.body;
  const ws = await db.prepare('SELECT id FROM workspaces WHERE id = ? AND user_id = ?')
    .get<any>(req.params.id, req.session.userId!);
  if (!ws) { res.status(404).json({ error: 'Not found' }); return; }

  await db.prepare(
    'UPDATE workspaces SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ?'
  ).run(name ?? null, color ?? null, req.params.id);
  res.json(await db.prepare('SELECT * FROM workspaces WHERE id = ?').get(req.params.id));
});

router.delete('/:id', async (req, res) => {
  const ws = await db.prepare('SELECT id FROM workspaces WHERE id = ? AND user_id = ?')
    .get<any>(req.params.id, req.session.userId!);
  if (!ws) { res.status(404).json({ error: 'Not found' }); return; }

  await db.prepare('DELETE FROM workspaces WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/:id/resources', async (req, res) => {
  const ws = await db.prepare('SELECT id FROM workspaces WHERE id = ? AND user_id = ?')
    .get<any>(req.params.id, req.session.userId!);
  if (!ws) { res.status(404).json({ error: 'Not found' }); return; }

  const resources = await db.prepare(
    'SELECT * FROM workspace_resources WHERE workspace_id = ? ORDER BY created_at DESC'
  ).all(req.params.id);
  res.json(resources);
});

router.post('/:id/resources', async (req, res) => {
  const ws = await db.prepare('SELECT id FROM workspaces WHERE id = ? AND user_id = ?')
    .get<any>(req.params.id, req.session.userId!);
  if (!ws) { res.status(404).json({ error: 'Not found' }); return; }

  const { type, title, url, content } = req.body;
  const result = await db.prepare(
    'INSERT INTO workspace_resources (workspace_id, type, title, url, content) VALUES (?, ?, ?, ?, ?)'
  ).run(req.params.id, type ?? 'link', title, url ?? null, content ?? null);
  res.json(await db.prepare('SELECT * FROM workspace_resources WHERE id = ?').get(result.lastInsertRowid));
});

router.delete('/:id/resources/:resourceId', async (req, res) => {
  const ws = await db.prepare('SELECT id FROM workspaces WHERE id = ? AND user_id = ?')
    .get<any>(req.params.id, req.session.userId!);
  if (!ws) { res.status(404).json({ error: 'Not found' }); return; }

  await db.prepare('DELETE FROM workspace_resources WHERE id = ? AND workspace_id = ?')
    .run(req.params.resourceId, req.params.id);
  res.json({ ok: true });
});

export default router;
