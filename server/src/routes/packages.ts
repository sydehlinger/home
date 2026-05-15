import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import db from '../db';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const packages = await db.prepare(
    'SELECT * FROM packages WHERE user_id = ? ORDER BY created_at DESC'
  ).all<any>(req.session.userId!);
  res.json(packages);
});

router.post('/', async (req, res) => {
  const { tracking_number, carrier, label, status, expected_delivery } = req.body;
  const result = await db.prepare(`
    INSERT INTO packages (user_id, tracking_number, carrier, label, status, expected_delivery)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    req.session.userId!,
    tracking_number,
    carrier,
    label,
    status ?? 'pending',
    expected_delivery ?? null,
  );
  res.json(await db.prepare('SELECT * FROM packages WHERE id = ?').get(result.lastInsertRowid));
});

router.patch('/:id', async (req, res) => {
  const { status, label, expected_delivery } = req.body;
  const pkg = await db.prepare('SELECT id FROM packages WHERE id = ? AND user_id = ?')
    .get<any>(req.params.id, req.session.userId!);

  if (!pkg) { res.status(404).json({ error: 'Not found' }); return; }

  await db.prepare(`
    UPDATE packages SET
      status = COALESCE(?, status),
      label = COALESCE(?, label),
      expected_delivery = COALESCE(?, expected_delivery),
      delivered_at = CASE WHEN ? = 'delivered' AND delivered_at IS NULL THEN unixepoch() ELSE delivered_at END
    WHERE id = ?
  `).run(status ?? null, label ?? null, expected_delivery ?? null, status ?? '', req.params.id);

  res.json(await db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id));
});

router.delete('/:id', async (req, res) => {
  const pkg = await db.prepare('SELECT id FROM packages WHERE id = ? AND user_id = ?')
    .get<any>(req.params.id, req.session.userId!);

  if (!pkg) { res.status(404).json({ error: 'Not found' }); return; }

  await db.prepare('DELETE FROM packages WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
