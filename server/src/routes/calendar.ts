import { Router } from 'express';
import { google } from 'googleapis';
import { requireAuth } from '../middleware/requireAuth';
import { getAuthClientForUser } from '../lib/google';

const router = Router();

router.use(requireAuth);

router.get('/events', async (req, res) => {
  try {
    const auth = getAuthClientForUser(req.session.userId!);
    const calendar = google.calendar({ version: 'v3', auth });

    const now = new Date();
    const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const { data } = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: twoWeeksOut.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 20,
    });

    res.json(data.items ?? []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

router.post('/events', async (req, res) => {
  const { summary, description, start, end, allDay } = req.body;
  try {
    const auth = getAuthClientForUser(req.session.userId!);
    const calendar = google.calendar({ version: 'v3', auth });

    const event: any = {
      summary,
      description,
      start: allDay ? { date: start } : { dateTime: start },
      end: allDay ? { date: end } : { dateTime: end },
    };

    const { data } = await calendar.events.insert({ calendarId: 'primary', requestBody: event });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

router.delete('/events/:id', async (req, res) => {
  try {
    const auth = getAuthClientForUser(req.session.userId!);
    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.delete({ calendarId: 'primary', eventId: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

export default router;
