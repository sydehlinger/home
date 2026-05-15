import { Router } from 'express';
import { google } from 'googleapis';
import { requireAuth } from '../middleware/requireAuth';
import { getAuthClientForUser } from '../lib/google';

const router = Router();

router.use(requireAuth);

// GET /api/sheets/:spreadsheetId?range=Sheet1!A1:Z100
router.get('/:spreadsheetId', async (req, res) => {
  const { spreadsheetId } = req.params;
  const range = (req.query.range as string) || 'A1:Z200';

  try {
    const auth = await getAuthClientForUser(req.session.userId!);
    const sheets = google.sheets({ version: 'v4', auth });

    const [metaRes, dataRes] = await Promise.all([
      sheets.spreadsheets.get({ spreadsheetId }),
      sheets.spreadsheets.values.get({ spreadsheetId, range }),
    ]);

    res.json({
      title: metaRes.data.properties?.title,
      sheets: metaRes.data.sheets?.map((s) => s.properties?.title),
      values: dataRes.data.values ?? [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch spreadsheet' });
  }
});

// GET /api/sheets/:spreadsheetId/tab/:tabName
router.get('/:spreadsheetId/tab/:tabName', async (req, res) => {
  const { spreadsheetId, tabName } = req.params;

  try {
    const auth = await getAuthClientForUser(req.session.userId!);
    const sheets = google.sheets({ version: 'v4', auth });

    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!A1:Z500`,
    });

    res.json({ values: data.values ?? [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch sheet tab' });
  }
});

export default router;
