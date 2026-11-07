# LocalHealth Pro

> **Working title.** A short Indian-inspired name option is **Ayu** (life); a
> Japanese-inspired option is **Mori** (forest). The product name has not yet
> been changed in the app.

LocalHealth Pro is a private, local-first health tracking app for nutrition,
food logging, and workouts. It is designed to run on a Mac mini and be used
from devices on a trusted home network. The API and database run locally, and
AI features use a local Ollama model.

## Project status

This is an actively developed single-user prototype. Implemented today:

- Daily nutrition dashboard with date navigation and calories, protein,
  carbohydrates, fat, and fiber totals.
- Food search, serving-size adjustment, and nutrition review before logging.
- Manual food entry and AI-assisted food logging with a clarification and
  confirm-before-save flow.
- Meal assignment and per-meal nutrition totals.
- Profile targets, basic AI coach chat, and a basic AI workout planner.
- SQLite persistence, WAL mode, Alembic migrations, and local API health check.
- Responsive Aurora Night visual theme.

Still planned or incomplete:

- Full IFCT and USDA food datasets, favorites, recent foods, saved meals, and
  photo logging.
- Water, weight, sleep, mood, steps, and other tracking modules.
- Exercise templates, workout safety checks, and an interactive workout player.
- Meal planning, grocery lists, insights, reports, and reminders.
- Authentication, installable/offline PWA support, scheduled backups, data
  export, and Mac auto-start configuration.
- Automated backend and browser regression tests.

Nutrition values in the included food catalog are reference estimates. AI
nutrition is an estimate too; review it before saving. This app is informational
and is not medical advice.

## Architecture

```text
Phone or desktop browser (home network)
              │
              ├── React + Vite frontend :5173
              │        │ HTTP / JSON
              │        ▼
              └── FastAPI backend :8000 ─── SQLite (health_pro.db, WAL)
                         │
                         └── Ollama :11434 (local model; AI features)
```

The frontend is in `frontend/`; the API, SQLAlchemy models, AI services, and
migrations are in `backend/`. The SQLite database path is relative to the
working directory unless `LOCALHEALTH_DATABASE_URL` is set. Run backend
commands from the repository root to use the project-root `health_pro.db`.

## Requirements

- macOS on the Mac mini; Python 3.12 is recommended.
- Node.js and npm (use the current Node LTS release).
- Ollama installed locally for AI-assisted food logging, coach chat, and workout
  generation. Search and manual logging work without the model once the API is
  running.
- A browser on the Mac or another device on the same trusted LAN.

## First-time setup

Run the following from the repository root.

### 1. Create the backend environment

```sh
python3.12 -m venv backend/.venv
source backend/.venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt
```

If your Mac does not have Python 3.12, install it using your preferred package
manager and rerun the commands with that Python executable.

### 2. Install the local AI model (optional for non-AI logging)

```sh
ollama pull llama3.1
ollama list
```

Ollama must be running locally when you use AI features. The current model name
is configured in `backend/app/ai_engine.py` as `llama3.1`.

### 3. Install frontend dependencies

```sh
cd frontend
npm install
cd ..
```

`frontend/package-lock.json` is committed so installs can be reproduced with
`npm ci` after the first setup.

## Run in development

Open two terminal windows. Run both commands from the repository root unless
the command says otherwise.

### Terminal 1: API

```sh
source backend/.venv/bin/activate
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

Database migrations run automatically on API startup. Expected startup output
includes SQLite/Alembic context messages followed by the server's startup
complete message. The API remains running until you stop it with `Ctrl+C`.

### Terminal 2: frontend

For use on the Mac itself:

```sh
cd frontend
npm run dev -- --host 127.0.0.1
```

Open <http://localhost:5173>. The API health check is at
<http://localhost:8000/health>; interactive API docs are at
<http://localhost:8000/docs>.

## Use from a phone or another device on your home network

1. Find the Mac's current LAN address in macOS Network settings (for example,
   `192.168.1.20`). Use a reserved DHCP address if your router supports it.
2. Stop the API if it is already running. From the repository root, activate
   the backend environment and set its allowed frontend origin before start:

   ```sh
   LOCALHEALTH_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://192.168.1.20:5173 \
   source backend/.venv/bin/activate
   ```

   Shell environment assignments do not persist across separate commands.
   An easier reliable option is to activate the environment first, then run:

   ```sh
   export LOCALHEALTH_CORS_ORIGINS='http://localhost:5173,http://127.0.0.1:5173,http://192.168.1.20:5173'
   uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

3. In another terminal, run Vite with the Mac's API address:

   ```sh
   cd frontend
   VITE_API_BASE_URL=http://192.168.1.20:8000 npm run dev -- --host 0.0.0.0
   ```

4. On the phone, open `http://192.168.1.20:5173` (replace the sample address).
   Both devices must be on the same LAN, and the Mac firewall must allow the
   development servers. The browser's origin must match an entry in
   `LOCALHEALTH_CORS_ORIGINS` exactly.

The API currently binds to all network interfaces for LAN access and does not
have user authentication. Keep it on a trusted private network. Do not
configure router port forwarding or expose it directly to the public internet.
If you only want local Mac access, use the loopback binding (`127.0.0.1`) and
the default CORS origins instead.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `LOCALHEALTH_DATABASE_URL` | `sqlite:///./health_pro.db` | SQLAlchemy database URL; relative SQLite paths resolve from the backend process working directory. |
| `LOCALHEALTH_CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated list of allowed frontend origins. |
| `VITE_API_BASE_URL` | `http://localhost:8000` | API origin used by the frontend at build/dev time. |

Create a local `.env` or `.env.local` only if you add environment-file loading;
the current app reads these settings from the process environment. Do not
commit secrets or private configuration.

## Food catalog and AI behavior

The API seeds a small starter food catalog at startup, including common foods
and Indian meals. Search results show values per serving. Selecting a result
opens a serving multiplier and nutrition preview; nothing is logged until you
confirm. Use **Add manually** when you already know the values for a food that
is not in the catalog.

For AI logging, describe a food and portion in the Log screen. The assistant
may ask for a missing quantity or preparation detail. When it has enough
information, it returns an editable estimate. Confirming saves the nutrition
values and meal assignment. Values are labeled by source (`database`,
`user-edited`, or `AI-estimated`).

Current AI endpoints expect Ollama at its local default address. If Ollama is
stopped, catalog search and manual entry still work; AI features return an
error toast rather than saving empty nutrition values.

## Database and migrations

The database file is `health_pro.db` by default and uses SQLite WAL mode. The
app applies migrations when the API starts. Migration files are under
`backend/migrations/versions/`.

To apply migrations manually from the repository root:

```sh
source backend/.venv/bin/activate
alembic -c backend/alembic.ini upgrade head
```

To seed or refresh the starter catalog manually:

```sh
source backend/.venv/bin/activate
python -m backend.seed_db
```

The initial baseline is designed to preserve pre-Alembic tables. Later schema
changes should be added as new Alembic revisions; do not edit an applied
migration to change an existing database.

## Backup and restore

For a simple manual backup, stop the API first, then copy the database file:

```sh
mkdir -p backups
cp health_pro.db "backups/health_pro-$(date +%Y-%m-%d-%H%M).db"
```

Restore only while the API is stopped:

```sh
cp backups/health_pro-YYYY-MM-DD-HHMM.db health_pro.db
```

The `backups/` folder and database files are ignored by Git. SQLite WAL mode
can keep recent changes in sidecar files while the server is running, so do
not back up only the main `.db` file during writes. A scheduled/online backup
and data export tool are planned but not implemented yet.

## API overview

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | API health check. |
| `GET`, `POST` | `/profile` | Read or update the single profile and calculated targets. |
| `GET` | `/search-food?q=...` | Search the local food catalog. |
| `POST` | `/ai/food-draft` | Request an AI clarification or reviewable nutrition draft. |
| `GET` | `/ai/parse-live?text=...` | Return live food/quantity chips for the input. |
| `GET`, `POST`, `DELETE` | `/logs` and `/logs/{id}` | Read, create, or delete health logs. `GET /logs` accepts `date_filter=YYYY-MM-DD`. |
| `GET` | `/summary?date_filter=YYYY-MM-DD` | Return daily macro totals and per-meal totals. |
| `GET` | `/exercises` | Read the seeded exercise library. |
| `POST` | `/workouts/plan` | Generate an AI workout plan. |
| `POST` | `/workouts/log` | Save a workout session. |
| `POST` | `/coach/chat` | Send a message to the AI coach. |

FastAPI's interactive documentation at `/docs` is the source of truth for
request and response shapes.

## Troubleshooting

### Backend says Ollama is unavailable

Start the Ollama application, ensure the model is installed with
`ollama list`, and retry. Food search and manual logging do not depend on AI.

### Browser reports CORS errors

Check the exact address in the browser bar and add its origin (scheme, host,
and port) to `LOCALHEALTH_CORS_ORIGINS`. Restart FastAPI after changing the
environment. Set `VITE_API_BASE_URL` to the Mac's LAN API address for phone
access; `localhost` on a phone refers to the phone itself.

### API cannot find the database

Run the backend from the repository root. A relative database URL is resolved
against the process's current working directory. To use another location, set
`LOCALHEALTH_DATABASE_URL` to an absolute SQLite URL.

### Port is already in use

Stop the old Vite or Uvicorn process before starting another one, or select a
different port and update the frontend URL and CORS origin to match.

## Development quality checks

From the repository root:

```sh
source backend/.venv/bin/activate
python -m compileall backend/app
```

Build the frontend:

```sh
cd frontend
npm run build
```

Automated test suites, lint/format configuration, and browser smoke tests are
not set up yet.

## Roadmap

1. Improve nutrition database coverage and food logging workflows.
2. Add water and weight tracking to the daily dashboard.
3. Expand exercises, workout templates, safety validation, and workout player.
4. Add guarded coach actions, meal planning, and grocery lists.
5. Build nutrition and activity insights and reports.
6. Add local authentication, backup/export automation, and Mac launch-at-login.
7. Add PWA/offline support, accessibility polish, and automated regression
   coverage.
