import { google } from 'googleapis';
import db from '../db';
import { config } from './config';

export function createOAuthClient() {
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
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

export async function getAuthClientForUser(userId: number) {
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get<any>(userId);
  if (!user) throw new Error('User not found');

  const client = createOAuthClient();
  client.setCredentials({
    access_token: user.access_token,
    refresh_token: user.refresh_token,
    expiry_date: user.token_expiry,
  });

  client.on('tokens', (tokens) => {
    if (tokens.access_token) {
      // Fire-and-forget — pg returns a promise but we don't have one to await here.
      db.prepare('UPDATE users SET access_token = ?, token_expiry = ? WHERE id = ?')
        .run(tokens.access_token, tokens.expiry_date, userId)
        .catch((err) => console.error('Failed to refresh user token:', err));
    }
  });

  return client;
}
