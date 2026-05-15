import { Router } from 'express';
import { google } from 'googleapis';
import { requireAuth } from '../middleware/requireAuth';
import { getAuthClientForUser } from '../lib/google';

const router = Router();

router.use(requireAuth);

router.get('/events', async (req, res) => {
  try {
    const auth = await getAuthClientForUser(req.session.userId!);
    const calendar = google.calendar({ version: 'v3', auth });

    const now = new Date();
    const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const { data: calList } = await calendar.calendarList.list({ minAccessRole: 'reader' });
    const calendarIds = (calList.items ?? []).map((c) => c.id!).filter(Boolean);

    const results = await Promise.all(
      calendarIds.map((calendarId) =>
        calendar.events.list({
          calendarId,
          timeMin: now.toISOString(),
          timeMax: twoWeeksOut.toISOString(),
          singleEvents: true,
          maxResults: 50,
        }).then((r) => r.data.items ?? []).catch(() => [])
      )
    );

    const allEvents = results.flat().sort((a, b) => {
      const aTime = a.start?.dateTime ?? a.start?.date ?? '';
      const bTime = b.start?.dateTime ?? b.start?.date ?? '';
      return aTime < bTime ? -1 : 1;
    });

    res.json(allEvents);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

router.post('/events', async (req, res) => {
  const { summary, description, start, end, allDay } = req.body;
  try {
    const auth = await getAuthClientForUser(req.session.userId!);
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
    const auth = await getAuthClientForUser(req.session.userId!);
    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.delete({ calendarId: 'primary', eventId: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

export default router;
