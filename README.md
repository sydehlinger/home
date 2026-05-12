# Home Dashboard

A personal home dashboard built with React and Express. Aggregates daily life into one place — calendar, tasks, budget, projects, notes, packages, grocery list, meal planning, recipes, and book library — with live weather in the header.

## Features

- **Dashboard** — daily overview with weather, upcoming events, active projects, recent notes, today's meals, and what you're currently reading
- **Calendar** — upcoming events via Google Calendar
- **Tasks** — task lists via Google Tasks
- **Budget** — spending tracking via Google Sheets
- **Projects** — kanban-style project tracker with status and links
- **Packages** — shipment tracking across multiple carriers
- **Notes** — markdown notes with live side-by-side preview and auto-save
- **Grocery** — shared grocery list with a public shareable link (no login required for guests)
- **Meal Plan** — weekly and monthly meal planner
- **Kitchen** — recipe collection with tags
- **Library** — book tracker with multiple formats per book (physical, ebook, audio), ownership state (owned vs. not), and tabs for *My Library*, *TBR*, *Read*, and *All*. Auto-fills metadata via the OpenLibrary search API and supports importing your StoryGraph library via CSV (covers fetched automatically by ISBN).
- **Settings** — reorder sidebar navigation via drag-and-drop

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Express, TypeScript, Node.js |
| Database | SQLite via `better-sqlite3` |
| Auth | Google OAuth 2.0 (session-based) |
| Data | Google Calendar, Tasks, and Sheets APIs |
| Weather | Open-Meteo (no API key required) |
| Books | OpenLibrary search and cover APIs (no API key required) |

## Getting Started

### Prerequisites

- Node.js 18+
- A Google Cloud project with OAuth 2.0 credentials and the Calendar, Tasks, and Sheets APIs enabled

### 1. Clone and install

```bash
git clone <repo-url>
cd home
npm run install:all
```

### 2. Configure environment

Create `server/.env`:

```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback
SESSION_SECRET=a_long_random_string
PORT=3001
```

### 3. Run

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Project Structure

```
home/
├── client/          # React frontend (Vite)
│   └── src/
│       ├── components/   # Layout, WeatherWidget
│       ├── lib/          # API client, nav order
│       └── pages/        # One file per route
└── server/          # Express backend
    └── src/
        ├── db/           # SQLite schema and connection
        └── routes/       # auth, calendar, tasks, meals, etc.
```

## Notes

- The SQLite database file (`home.db`) and session files are gitignored and created automatically on first run.
- Schema migrations run on every server start and are guarded with `try/catch` so they're safe to re-run.
- Grocery lists can be shared via a public token URL (`/shared/:token`) — no login required for the recipient.
- Sidebar order is persisted in `localStorage`.
- Library imports from StoryGraph: export from *Manage Account → Manage Your Data → Export StoryGraph Library*, then upload the CSV. Re-imports dedupe by ISBN (or title + author) and refresh ownership/status/rating without creating duplicates.
