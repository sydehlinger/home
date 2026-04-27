import { google } from 'googleapis';
import db from '../db';

export function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
];

export function getAuthClientForUser(userId: number) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  if (!user) throw new Error('User not found');

  const client = createOAuthClient();
  client.setCredentials({
    access_token: user.access_token,
    refresh_token: user.refresh_token,
    expiry_date: user.token_expiry,
  });

  client.on('tokens', (tokens) => {
    if (tokens.access_token) {
      db.prepare('UPDATE users SET access_token = ?, token_expiry = ? WHERE id = ?')
        .run(tokens.access_token, tokens.expiry_date, userId);
    }
  });

  return client;
}
