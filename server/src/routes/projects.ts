import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import db from '../db';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  const projects = db.prepare(
    'SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC'
  ).all(req.session.userId!) as any[];
  res.json(projects);
});

router.post('/', (req, res) => {
  const { name, description, status, url, color } = req.body;
  const result = db.prepare(`
    INSERT INTO projects (user_id, name, description, status, url, color)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.session.userId!, name, description ?? null, status ?? 'active', url ?? null, color ?? '#6366f1');

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
  res.json(project);
});

router.patch('/:id', (req, res) => {
  const { name, description, status, url, color } = req.body;
  const project = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.session.userId!) as any;

  if (!project) { res.status(404).json({ error: 'Not found' }); return; }

  db.prepare(`
    UPDATE projects SET name = COALESCE(?, name), description = COALESCE(?, description),
    status = COALESCE(?, status), url = COALESCE(?, url), color = COALESCE(?, color),
    updated_at = unixepoch() WHERE id = ?
  `).run(name ?? null, description ?? null, status ?? null, url ?? null, color ?? null, req.params.id);

  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const project = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.session.userId!) as any;

  if (!project) { res.status(404).json({ error: 'Not found' }); return; }

  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/:id/notes', (req, res) => {
  const notes = db.prepare(
    'SELECT * FROM project_notes WHERE project_id = ? ORDER BY created_at DESC'
  ).all(req.params.id);
  res.json(notes);
});

router.post('/:id/notes', (req, res) => {
  const { content } = req.body;
  const result = db.prepare(
    'INSERT INTO project_notes (project_id, content) VALUES (?, ?)'
  ).run(req.params.id, content);
  res.json(db.prepare('SELECT * FROM project_notes WHERE id = ?').get(result.lastInsertRowid));
});

router.delete('/:id/notes/:noteId', (req, res) => {
  db.prepare('DELETE FROM project_notes WHERE id = ? AND project_id = ?')
    .run(req.params.noteId, req.params.id);
  res.json({ ok: true });
});

export default router;
