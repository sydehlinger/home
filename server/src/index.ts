import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import FileStore from 'session-file-store';

import authRouter from './routes/auth';
import calendarRouter from './routes/calendar';
import tasksRouter from './routes/tasks';
import sheetsRouter from './routes/sheets';
import projectsRouter from './routes/projects';
import packagesRouter from './routes/packages';
import notesRouter from './routes/notes';
import groceryRouter from './routes/grocery';
import mealsRouter from './routes/meals';
import recipesRouter from './routes/recipes';
import sharedRouter from './routes/shared';
import budgetRouter from './routes/budget';
import booksRouter from './routes/books';

const app = express();
const FileSession = FileStore(session);

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(
  session({
    store: new FileSession({ path: './sessions', ttl: 7 * 24 * 60 * 60, reapInterval: 3600 }) as any,
    secret: process.env.SESSION_SECRET ?? 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 },
  })
);

app.use('/auth', authRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/sheets', sheetsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/packages', packagesRouter);
app.use('/api/notes', notesRouter);
app.use('/api/grocery', groceryRouter);
app.use('/api/meals', mealsRouter);
app.use('/api/recipes', recipesRouter);
app.use('/api/shared', sharedRouter);
app.use('/api/budget', budgetRouter);
app.use('/api/books', booksRouter);

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
