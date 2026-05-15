import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const isProd = process.env.NODE_ENV === 'production';

if (isProd && process.env.SESSION_SECRET === 'dev-secret') {
  throw new Error('SESSION_SECRET must not be the dev default in production');
}

const allowedEmails = (process.env.ALLOWED_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

if (isProd && allowedEmails.length === 0) {
  throw new Error('ALLOWED_EMAILS must be set in production (comma-separated)');
}

// Render Postgres requires SSL but uses self-signed certs internally — disable cert verification.
// Override with DATABASE_SSL=disable for local Postgres without SSL.
const dbSslSetting = process.env.DATABASE_SSL;
const dbSsl =
  dbSslSetting === 'disable' ? false
  : dbSslSetting === 'strict' ? { rejectUnauthorized: true }
  : isProd ? { rejectUnauthorized: false }
  : false;

export const config = {
  isProd,
  port: Number(process.env.PORT ?? 3001),
  sessionSecret: required('SESSION_SECRET'),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  cookieSecure: process.env.COOKIE_SECURE === 'true' || isProd,
  databaseUrl: required('DATABASE_URL'),
  dbSsl,
  google: {
    clientId: required('GOOGLE_CLIENT_ID'),
    clientSecret: required('GOOGLE_CLIENT_SECRET'),
    redirectUri: required('GOOGLE_REDIRECT_URI'),
  },
  allowedEmails,
};

export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  if (allowedEmails.length === 0) return true;
  return allowedEmails.includes(email.toLowerCase());
}
