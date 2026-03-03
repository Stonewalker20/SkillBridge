# Backend

## Local Transformer Mode

SkillBridge can run its AI features fully in the backend with local transformer models while keeping the existing fallback path.

Current local models:

- Embeddings: `sentence-transformers/all-MiniLM-L6-v2`
- Zero-shot skill filtering: `MoritzLaurer/deberta-v3-base-zeroshot-v1.1-all-33`

If those models are unavailable, the backend automatically falls back to the lighter local hash/rule logic.

## Install

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Optional Environment Variables

```bash
LOCAL_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
LOCAL_ZERO_SHOT_MODEL=MoritzLaurer/deberta-v3-base-zeroshot-v1.1-all-33
LOCAL_MODEL_DEVICE=-1
LOCAL_MODEL_PREWARM=true
ADMIN_OWNER_EMAILS=owner@example.com
ADMIN_TEAM_EMAILS=teammate1@example.com,teammate2@example.com
```

Notes:

- `LOCAL_MODEL_DEVICE=-1` keeps inference on CPU.
- Set `LOCAL_MODEL_DEVICE=0` if you have a CUDA GPU available to the backend.
- `LOCAL_MODEL_PREWARM=true` loads the transformer models on backend startup instead of waiting for the first Job Match or Evidence request.
- `ADMIN_OWNER_EMAILS` bootstraps owner access on registration for the listed emails.
- `ADMIN_TEAM_EMAILS` bootstraps team access on registration for the listed emails.

## Run

```bash
uvicorn app.main:app --reload
```

On startup, the backend prints which AI mode is active.

You can also confirm the current mode from the API:

```bash
curl http://localhost:8000/tailor/settings/status
```
