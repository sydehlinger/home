import { Router } from 'express';
import { createOAuthClient, SCOPES } from '../lib/google';
import { google } from 'googleapis';
import db from '../db';

const router = Router();

router.get('/google', (_req, res) => {
  const client = createOAuthClient();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
  res.redirect(url);
});

router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code || typeof code !== 'string') {
    res.status(400).send('Missing code');
    return;
  }

  try {
    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data: profile } = await oauth2.userinfo.get();

    const existing = db.prepare('SELECT id FROM users WHERE google_id = ?').get(profile.id!) as any;

    let userId: number;
    if (existing) {
      db.prepare(`
        UPDATE users SET access_token = ?, refresh_token = COALESCE(?, refresh_token),
        token_expiry = ?, name = ?, email = ? WHERE id = ?
      `).run(tokens.access_token, tokens.refresh_token, tokens.expiry_date, profile.name, profile.email, existing.id);
      userId = existing.id;
    } else {
      const result = db.prepare(`
        INSERT INTO users (google_id, email, name, access_token, refresh_token, token_expiry)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(profile.id!, profile.email!, profile.name!, tokens.access_token, tokens.refresh_token, tokens.expiry_date);
      userId = result.lastInsertRowid as number;
    }

    req.session.userId = userId;
    res.redirect('http://localhost:5173');
  } catch (err) {
    console.error(err);
    res.status(500).send('OAuth error');
  }
});

router.get('/me', (req, res) => {
  if (!req.session.userId) {
    res.json({ user: null });
    return;
  }
  const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(req.session.userId) as any;
  res.json({ user });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

export default router;
