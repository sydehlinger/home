import { Router } from 'express';
import { google } from 'googleapis';
import { requireAuth } from '../middleware/requireAuth';
import { getAuthClientForUser } from '../lib/google';

const router = Router();

router.use(requireAuth);

router.get('/lists', async (req, res) => {
  try {
    const auth = getAuthClientForUser(req.session.userId!);
    const tasks = google.tasks({ version: 'v1', auth });
    const { data } = await tasks.tasklists.list({ maxResults: 20 });
    res.json(data.items ?? []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch task lists' });
  }
});

router.get('/lists/:listId', async (req, res) => {
  try {
    const auth = getAuthClientForUser(req.session.userId!);
    const tasks = google.tasks({ version: 'v1', auth });
    const { data } = await tasks.tasks.list({
      tasklist: req.params.listId,
      showCompleted: false,
      maxResults: 50,
    });
    res.json(data.items ?? []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.post('/lists/:listId', async (req, res) => {
  const { title, notes, due, parent } = req.body;
  try {
    const auth = getAuthClientForUser(req.session.userId!);
    const tasks = google.tasks({ version: 'v1', auth });
    const { data } = await tasks.tasks.insert({
      tasklist: req.params.listId,
      parent,
      requestBody: { title, notes, due },
    });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.patch('/lists/:listId/:taskId/complete', async (req, res) => {
  try {
    const auth = getAuthClientForUser(req.session.userId!);
    const tasks = google.tasks({ version: 'v1', auth });
    const { data } = await tasks.tasks.patch({
      tasklist: req.params.listId,
      task: req.params.taskId,
      requestBody: { status: 'completed' },
    });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to complete task' });
  }
});

router.delete('/lists/:listId/:taskId', async (req, res) => {
  try {
    const auth = getAuthClientForUser(req.session.userId!);
    const tasks = google.tasks({ version: 'v1', auth });
    await tasks.tasks.delete({ tasklist: req.params.listId, task: req.params.taskId });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

export default router;
