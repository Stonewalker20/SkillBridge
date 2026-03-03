# SkillBridge Backend (FastAPI + MongoDB)

API server for SkillBridge.

## Requirements
- Python 3.11+
- MongoDB (local or container)

## Configure
Create `backend/.env` (or use Docker) with at least:
- `MONGO_URI=mongodb://localhost:27017`
- `MONGO_DB=skillbridge`

## Run locally
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Seed demo users
```bash
cd backend
python scripts/seed_mongo.py
```

If your seed script supports it, use the demo credentials it prints (or adjust the script to your needs).

## Indexes
On startup the app ensures:
- `users.email` unique
- `sessions.token` unique
- `sessions.expires_at` TTL
