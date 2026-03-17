# SkillBridge

SkillBridge is a full-stack career intelligence platform for collecting evidence, confirming skills, analyzing job fit, and generating tailored resumes. The repository is split into a FastAPI backend, a React/Vite frontend, MongoDB-backed persistence, and a local transformer-backed analysis pipeline with a safe fallback path.

## Current Architecture

### Frontend

- React 18
- Vite 6
- React Router 7
- Tailwind 4 with Radix UI primitives
- Light and dark theme support with `next-themes`

### Backend

- FastAPI
- Motor + MongoDB
- Pydantic v2
- Local transformer inference for semantic matching and skill extraction
- Rule-based fallback when transformer models are unavailable

### Data and Dev Tooling

- MongoDB for application data
- Backend contract tests with `pytest` + `httpx`
- ML sandbox notebooks under `backend/ml_sandbox/`
- Docker assets under `infra/`

## What the App Does

- User authentication and session management
- Skills catalog, confirmations, proficiency, and evidence support
- Evidence ingestion from pasted text, PDF, and DOCX uploads
- Job Match analysis with skill coverage, semantic alignment, and keyword overlap
- Tailored resume generation and PDF export
- Dashboard metrics and recent activity
- Owner and team admin workspace

## Repository Layout

```text
skillbridge/
├── assets/                     # shared brand and project assets
├── backend/
│   ├── app/
│   │   ├── core/
│   │   ├── models/
│   │   ├── routers/
│   │   └── utils/
│   ├── data/                   # raw, processed, and taxonomy-backed data assets
│   ├── ml_sandbox/             # notebook-based model tuning workspace
│   ├── scripts/                # one-off migrations, seeding, and cleanup utilities
│   ├── tests/                  # backend contract and route tests
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── Dockerfile
│   └── README.md
├── data/                       # project-level reference datasets
├── docs/                       # supporting documentation and writeups
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   ├── context/
│   │   │   ├── pages/
│   │   │   ├── services/
│   │   │   ├── App.tsx
│   │   │   └── routes.tsx
│   │   ├── imports/            # shared SVGs and imported design assets
│   │   ├── styles/
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   ├── Dockerfile
│   └── README.md
├── infra/
│   └── docker-compose.yml      # local MongoDB container setup
├── tests/                      # top-level integration or legacy project tests
├── .env.example
└── README.md
```

## Startup Guide

### Prerequisites

- Python 3.10 or newer
- Node.js 18 or newer
- npm
- MongoDB running locally on `mongodb://localhost:27017`, or another reachable MongoDB instance

### 1. Clone and enter the repo

```bash
git clone <your-repo-url>
cd skillbridge
```

### 2. Configure the backend environment

Create `backend/.env` with at least:

```env
APP_ENV=development
ALLOWED_ORIGINS=http://localhost:5173
MONGO_URI=mongodb://localhost:27017
MONGO_DB=skillbridge
PUBLIC_APP_URL=http://localhost:5173
PUBLIC_API_URL=http://localhost:8000
```

Optional variables you may want during development:

```env
LOCAL_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
LOCAL_ZERO_SHOT_MODEL=MoritzLaurer/deberta-v3-base-zeroshot-v1.1-all-33
LOCAL_MODEL_DEVICE=-1
LOCAL_MODEL_PREWARM=true
ADMIN_OWNER_EMAILS=owner@example.com
ADMIN_TEAM_EMAILS=teammate1@example.com,teammate2@example.com
```

Notes:

- `LOCAL_MODEL_DEVICE=-1` keeps inference on CPU.
- `LOCAL_MODEL_PREWARM=true` loads transformer models during backend startup.
- `ADMIN_OWNER_EMAILS` and `ADMIN_TEAM_EMAILS` bootstrap admin access on registration.
- Use `backend/.env.staging.example` and `backend/.env.production.example` as the starting point for deployed environments.

### 3. Start MongoDB

If you already run MongoDB locally, keep that running and skip to the backend setup.

If you want a Docker-managed Mongo instance:

```bash
docker compose -f infra/docker-compose.yml up -d
```

This starts:

- `mongo` on `localhost:27017`

### 4. Install and run the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend URLs:

- API base: `http://localhost:8000`
- OpenAPI docs: `http://localhost:8000/docs`

On startup, the backend prints the active AI mode so you can confirm whether transformer inference or fallback mode is active.

### 5. Install and run the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:

- App: `http://localhost:5173`

The Vite dev server proxies `/api/*` requests to the backend at `http://localhost:8000`.
For deployed frontend environments, start from `frontend/.env.staging.example` or `frontend/.env.production.example` and set `VITE_API_BASE` to the deployed backend URL.

## First-Run Checklist

After both services are up:

1. Open `http://localhost:5173`
2. Create a user account
3. Add evidence from text or file upload
4. Confirm extracted skills on the Skills page
5. Run a Job Match analysis
6. Generate a tailored resume PDF

If you want to access the admin page, sign up with an email listed in `ADMIN_OWNER_EMAILS` or `ADMIN_TEAM_EMAILS`.

## Core Routes

### Frontend application pages

- `/` landing page
- `/login`
- `/signup`
- `/app` dashboard
- `/app/skills`
- `/app/evidence`
- `/app/jobs`
- `/app/resumes`
- `/app/account`
- `/app/admin` for owner, admin, and team roles

### Major backend API groups

- `/auth`
- `/skills`
- `/skills/confirmations`
- `/evidence`
- `/jobs`
- `/tailor`
- `/dashboard`
- `/taxonomy`
- `/portfolio`
- `/projects`
- `/admin`

## Testing

Backend tests are developer-only tooling and are not exposed to end users.

Install dev dependencies:

```bash
cd backend
source .venv/bin/activate
pip install -r requirements-dev.txt
```

Run the backend suite:

```bash
pytest -q
```

The current backend tests cover route surface validation plus major API flows including auth, admin access, dashboard, skills, evidence, projects, portfolio, and tailoring endpoints.

## Local Transformer Inference

SkillBridge can run semantic matching and extraction fully in the backend.

Current configured models:

- Embeddings: `sentence-transformers/all-MiniLM-L6-v2`
- Zero-shot classification: `MoritzLaurer/deberta-v3-base-zeroshot-v1.1-all-33`

Behavior:

- If local transformer dependencies and model weights are available, the backend uses them.
- If not, the backend falls back to its lighter local rule and hash pipeline.

You can confirm the active mode through:

```bash
curl http://localhost:8000/tailor/settings/status
```

## ML Sandbox

For model tuning and notebook-based experimentation, use:

- `backend/ml_sandbox/notebooks/`
- `backend/ml_sandbox/datasets/`
- `backend/ml_sandbox/artifacts/`

This is intended for development workflows only and does not affect the production app unless you move changes back into `backend/app/`.

## Deployment Notes

SkillBridge is structured so the frontend, backend, and MongoDB can be deployed independently.

At minimum, a production deployment needs:

- a MongoDB connection string
- a backend environment with the variables shown above
- a frontend build served with an API base that reaches the backend
- correct `ALLOWED_ORIGINS` configuration for the deployed frontend domain

If you deploy with Docker, the current compose assets live in `infra/` and the service Dockerfiles live under `backend/` and `frontend/`.

For the current launch plan and ship-progress tracker, see [docs/ship_checklist.md](/Users/cordellstonecipher/OU_Undergrad/skillbridge/docs/ship_checklist.md).

## Version

Current application version: `0.5.0`

Versioned surfaces in this repo:

- frontend package version
- backend API version

## Additional Docs

- [backend/README.md](/Users/cordellstonecipher/OU_Undergrad/skillbridge/backend/README.md)
- [frontend/README.md](/Users/cordellstonecipher/OU_Undergrad/skillbridge/frontend/README.md)
- [backend/ml_sandbox/README.md](/Users/cordellstonecipher/OU_Undergrad/skillbridge/backend/ml_sandbox/README.md)
