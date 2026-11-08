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
- Food search with common Indian-name aliases, serving-size adjustment, and
  nutrition review before logging.
- Persistent favorite foods and a recently logged catalog-food list.
- Manual food entry and AI-assisted food logging with a clarification and
  confirm-before-save flow.
- Meal assignment and per-meal nutrition totals.
- A Profile tab for age, sex used by the BMR formula, height, current and
  target weight, activity level, food preference, and daily routine in India
  Standard Time.
- Estimated BMR, maintenance calories, goal calories, BMI screening value, and
  starter macro targets, plus a personalized seven-day calorie and activity
  schedule.
- Basic AI coach chat and workout planning.
- Searchable exercise library, equipment-filtered workout templates, active
  workout set logging, and recent workout history.
- SQLite persistence, WAL mode, Alembic migrations, and local API health check.
- Responsive Aurora Night visual theme.

Still planned or incomplete:

- Broader Indian recipe coverage, saved meals, and photo logging. An optional
  offline USDA Foundation Foods importer is available.
- Water and weight tracking are implemented. Sleep, mood, steps, and other
  activity tracking remain planned.
- Advanced workout progression, exercise demonstrations, and personalized
  injury accommodations.
- Meal planning, grocery lists, insights, reports, and reminders.
- Trend-based calorie target adjustments and richer meal-planning guidance.
- Authentication, installable/offline PWA support, scheduled backups, data
  export, and Mac auto-start configuration.
- Core backend regression checks are added; automated browser regression
  coverage remains planned.
- Fitbit and Pixel Watch data sync through the Google Health API (final planned
  integration phase; not implemented yet).

### Profile estimates and weekly activity plan

The Profile tab uses the Mifflin–St Jeor equation to estimate resting energy
needs, then applies the activity level selected by the user for a rough
maintenance estimate. Weight-loss mode starts with a 15% estimated reduction,
capped at 500 kcal/day. These are app heuristics for an initial conversation,
not clinical prescriptions or promises about weight change. Macro grams are
also starting estimates based on a 25/45/30 calorie split. The displayed BMI
is a screening value, not a diagnosis.

For a sedentary profile, the first week starts with shorter walks and suggests
gradually building toward at least 150 minutes of moderate activity per week.
Other activity levels receive five 30-minute aerobic sessions and two
strength days. These targets follow the general adult activity guidance from
the [CDC](https://www.cdc.gov/physical-activity-basics/guidelines/adults.html).
The energy equation originates in the [Mifflin–St Jeor study](https://pubmed.ncbi.nlm.nih.gov/2305711/);
individual energy needs can differ from equation estimates.

### Final planned phase: Google Health API / Fitbit sync

Use Google's current **Google Health API**, the successor to the Fitbit Web
API, to let the user explicitly connect a Google account and import selected
Fitbit data. The first release should focus on daily steps, activity/workout
summaries, heart-rate summaries, sleep, and weight where available. The user
must be able to choose which data is synced, see the last sync time, retry or
disconnect, and delete imported records. Keep credentials out of source
control, store refresh tokens securely on the Mac, and keep imported records in
the local database. Do not send wearable history to an AI model by default.

Implementation depends on registering a Google Cloud project, enabling the
Google Health API, configuring OAuth consent and redirect URIs, and confirming
the API's currently available data types and access requirements. Use Google's
[setup guide](https://developers.google.com/health/setup), [data access and
authorization guide](https://developers.google.com/health/migration/data-access),
and [API data types](https://developers.google.com/health/data-types) when this
phase begins. This is a cloud OAuth/data connection, while the app's database
and day-to-day processing can remain on the Mac.

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
ollama pull gemma3:4b
ollama list
```

Ollama must be running locally when you use AI features. The backend defaults
to `gemma3:4b`, which can be changed with `LOCALHEALTH_OLLAMA_MODEL`.

### 3. Install frontend dependencies

```sh
cd frontend
npm install
cd ..
```

`frontend/package-lock.json` is committed so installs can be reproduced with
`npm ci` after the first setup.

### Optional: import USDA Foundation Foods

The app can import USDA Foundation Foods into the local database. The importer
uses an extracted official CSV release, keeps the FDC food ID and release label
for provenance, imports values per 100 g, skips entries missing any core
nutrient, and can be rerun to update the same FDC records. The dataset itself
is not bundled in this repository. USDA FoodData Central data is CC0; USDA
requests attribution, which the food picker displays for imported entries.

1. Download the latest **Foundation Foods CSV** archive from the [USDA
   download page](https://fdc.nal.usda.gov/download-datasets/) and extract it.
2. Activate the backend virtual environment from the repository root, then run
   the importer with the extracted directory and release label:

   ```sh
   source backend/.venv/bin/activate
   python -m backend.import_usda_foundation \
     "/path/to/extracted/Foundation_Foods_CSV" --version 2026-10
   ```

3. Restart the API if it is running. Imported foods are available through
   regular local search; no USDA API key or network request is used by the app.

The USDA Foundation dataset primarily covers ingredients, not a comprehensive
catalog of Indian prepared recipes. The existing curated entries remain
available alongside USDA entries.

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
| `LOCALHEALTH_OLLAMA_MODEL` | `gemma3:4b` | Exact Ollama model tag used by food parsing and the coach. |

Create a local `.env` or `.env.local` only if you add environment-file loading;
the current app reads these settings from the process environment. Do not
commit secrets or private configuration.

## Food catalog and AI behavior

The API seeds a small starter food catalog at startup, including common foods
and Indian meals. Optionally imported USDA Foundation foods are shown per 100 g
with their data source and release label. Selecting a result opens a serving
multiplier and nutrition preview; nothing is logged until you confirm. Use
**Add manually** when you already know the values for a food that is not in the
catalog.

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
| `GET`, `POST` | `/profile` | Read or update the profile, routine, and calculated health targets. |
| `GET` | `/profile/weekly-plan` | Build the next seven days of calorie, meal-time, and activity guidance in IST. |
| `GET` | `/search-food?q=...` | Search the local food catalog. |
| `GET` | `/foods/favorites` | List favorite catalog foods. |
| `PUT`, `DELETE` | `/foods/{id}/favorite` | Add or remove a favorite. |
| `GET` | `/foods/recent` | List recently logged catalog foods. |
| `POST` | `/ai/food-draft` | Request an AI clarification or reviewable nutrition draft. |
| `GET` | `/ai/parse-live?text=...` | Return live food/quantity chips for the input. |
| `GET`, `POST`, `DELETE` | `/logs` and `/logs/{id}` | Read, create, or delete health logs. `GET /logs` accepts `date_filter=YYYY-MM-DD`. |
| `GET` | `/summary?date_filter=YYYY-MM-DD` | Return daily macro totals and per-meal totals. |
| `GET` | `/exercises` | Read the seeded exercise library. |
| `GET` | `/workouts/templates?equipment=...` | Read equipment-matched workout templates. |
| `POST` | `/workouts/plan` | Generate an AI workout plan. |
| `POST` | `/workouts/log` | Save a workout session and completed sets. |
| `GET` | `/workouts/sessions` | Read recent workout history and sets. |
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
not yet complete. Run the backend API regression checks from the repository
root with:

```sh
python -m unittest discover -s backend/tests -v
```

These checks use an isolated in-memory SQLite database and do not touch your
project database.

## Roadmap

1. Improve nutrition database coverage and food logging workflows.
2. Complete tracking with sleep, mood, and activity metrics (water and weight
   logging are already implemented).
3. Add workout progression, exercise demonstrations, and more personalized
   accommodations.
4. Add guarded coach actions, meal planning, and grocery lists.
5. Build nutrition and activity insights and reports.
6. Add local authentication, backup/export automation, and Mac launch-at-login.
7. Add PWA/offline support, accessibility polish, and automated regression
   coverage.
8. Integrate Fitbit and Pixel Watch data through the Google Health API with
   explicit OAuth consent and local storage.
