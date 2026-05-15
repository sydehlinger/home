import express from 'express';
import cors from 'cors';
import path from 'path';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { config } from './lib/config';
import db, { initSchema } from './db';

import authRouter from './routes/auth';
import calendarRouter from './routes/calendar';
import tasksRouter from './routes/tasks';
import sheetsRouter from './routes/sheets';
import projectsRouter from './routes/projects';
import workspacesRouter from './routes/workspaces';
import packagesRouter from './routes/packages';
import notesRouter from './routes/notes';
import groceryRouter from './routes/grocery';
import mealsRouter from './routes/meals';
import recipesRouter from './routes/recipes';
import sharedRouter from './routes/shared';
import budgetRouter from './routes/budget';
import booksRouter from './routes/books';

async function main() {
  await initSchema();

  const app = express();
  const PgSession = connectPgSimple(session);

  if (config.isProd) app.set('trust proxy', 1);

  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(
    session({
      store: new PgSession({ pool: db.pool, createTableIfMissing: true }),
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.cookieSecure,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    })
  );

  app.use('/auth', authRouter);
  app.use('/api/calendar', calendarRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/sheets', sheetsRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/workspaces', workspacesRouter);
  app.use('/api/packages', packagesRouter);
  app.use('/api/notes', notesRouter);
  app.use('/api/grocery', groceryRouter);
  app.use('/api/meals', mealsRouter);
  app.use('/api/recipes', recipesRouter);
  app.use('/api/shared', sharedRouter);
  app.use('/api/budget', budgetRouter);
  app.use('/api/books', booksRouter);

  if (config.isProd) {
    const clientDist = path.resolve(__dirname, '../../client/dist');
    app.use(express.static(clientDist));
    app.get(/^\/(?!api\/|auth\/).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.listen(config.port, () => console.log(`Server running on http://localhost:${config.port}`));
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
