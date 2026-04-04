# SkillBridge ML Sandbox

This workspace is for sandboxed experimentation on the local transformer pipeline without changing the production request path first.

Use it for:
- benchmarking skill extraction latency
- comparing embedding models
- tuning semantic alignment scoring
- tracking experiment sweeps in MLflow
- building small labeled evaluation sets for accuracy checks
- profiling memory and throughput before promoting a change into `backend/app/utils/ai.py`

## Layout

- `requirements.txt`: notebook and evaluation dependencies for the sandbox
- `notebook_setup.py`: helpers that import the real SkillBridge backend modules
- `pipeline.py`: reusable dataset loaders, evaluators, and metrics helpers
- `scripts/run_mlflow_experiment.py`: CLI runner that logs experiment sweeps to MLflow
- `notebooks/transformer_lab.ipynb`: starter notebook for local experiments
- `datasets/`: place labeled samples here
- `artifacts/`: save benchmark outputs, plots, and test results here

## Quick Start

From the repo root:

```bash
python3 -m venv .venv-ml
source .venv-ml/bin/activate
pip install -r backend/requirements.txt
pip install -r backend/ml_sandbox/requirements.txt
python -m ipykernel install --user --name skillbridge-ml --display-name "SkillBridge ML"
jupyter lab
```

Then open:

- `backend/ml_sandbox/notebooks/transformer_lab.ipynb`

Use the `SkillBridge ML` kernel.

To launch the local MLflow UI after running experiments:

```bash
mlflow ui --backend-store-uri sqlite:///backend/ml_sandbox/artifacts/mlflow.db
```

Then open the local MLflow URL shown in the terminal.

## Recommended Workflow

1. Add a small labeled dataset under `datasets/`.
2. Use the notebook to measure baseline latency and extraction quality.
3. Compare alternate local models by overriding:
   - `settings.local_embedding_model`
   - `settings.local_zero_shot_model`
4. Run tracked sweeps with MLflow before changing production heuristics:

```bash
python backend/ml_sandbox/scripts/run_mlflow_experiment.py \
  --inference-mode auto \
  --inference-mode local-fallback \
  --embedding-model sentence-transformers/all-MiniLM-L6-v2 \
  --embedding-model sentence-transformers/all-MiniLM-L12-v2 \
  --zero-shot-model MoritzLaurer/deberta-v3-base-zeroshot-v1.1-all-33
```

5. Keep candidate extraction and scoring changes in the sandbox first.
6. Only port changes into production code after you have benchmark evidence.

## Bootstrapping Without Real Users

If you do not have live user data yet, seed a separate local Mongo database from the repo's unified backend data folder.

Current local paths:
- seed inputs: `backend/data/seed/`
- avatar uploads: `backend/data/uploads/avatars`

Dry-run the synthetic seeder:

```bash
python backend/ml_sandbox/scripts/seed_synthetic_eval_data.py --dry-run
```

Populate a dedicated seed database:

```bash
python backend/ml_sandbox/scripts/seed_synthetic_eval_data.py \
  --mongo-db skillbridge_ml_seed \
  --max-resume-rows 12 \
  --max-external-postings 12 \
  --max-large-linkedin-jobs 12 \
  --max-nyc-jobs 12
```

Then export eval sets from that synthetic database:

```bash
export ML_SANDBOX_ANON_SALT="replace-with-a-long-random-secret"
python backend/ml_sandbox/scripts/export_eval_sets.py --mongo-db skillbridge_ml_seed
```

## Exporting Safe Eval Sets From Mongo

The sandbox now includes a generator that mines real SkillBridge artifacts and emits anonymized JSONL files for extraction, retrieval, and rewrite evaluation.

What it does:
- reads recent active-user data from Mongo
- replaces raw identifiers with deterministic HMAC-based pseudonyms
- redacts emails, phone numbers, URLs, IPs, and likely resume-header PII
- writes generated datasets under `backend/ml_sandbox/datasets/generated/`

What it does not do:
- export raw Mongo `_id` values
- include unhashed user emails or usernames in dataset rows
- write generated datasets into git-tracked paths by default

Set a salt in your shell first:

```bash
export ML_SANDBOX_ANON_SALT="replace-with-a-long-random-secret"
```

Dry-run the export to inspect counts without writing files:

```bash
python backend/ml_sandbox/scripts/export_eval_sets.py --dry-run
```

Write a generated eval set bundle:

```bash
python backend/ml_sandbox/scripts/export_eval_sets.py \
  --max-users 150 \
  --max-per-user 6 \
  --negative-count 3
```

The command prints the output directory plus the three dataset paths:
- `extraction_eval.jsonl`
- `ranking_eval.jsonl`
- `rewrite_eval.jsonl`
- `manifest.json`

Feed those files into the MLflow runner:

```bash
python backend/ml_sandbox/scripts/run_mlflow_experiment.py \
  --experiment-name skillbridge-live-evals \
  --dataset-dir backend/ml_sandbox/datasets/generated/<stamp> \
  --inference-mode auto \
  --inference-mode local-fallback
```

## Dataset Formats

### Extraction evaluation

One JSON object per line:

```json
{"id":"extract-1","text":"Built FastAPI APIs in Python.","expected_skills":["Python","FastAPI"]}
```

### Ranking evaluation

One query plus labeled candidate snippets per line:

```json
{
  "id":"rank-1",
  "query":"python backend apis",
  "candidates":[
    {"id":"c1","text":"Built Python FastAPI APIs.","label":1},
    {"id":"c2","text":"Led campus recruiting.","label":0}
  ]
}
```

### Rewrite evaluation

Optional dataset for resume-bullet rewrite benchmarking:

```json
{
  "id":"rewrite-1",
  "job_text":"Looking for Python API experience.",
  "bullets":["Built internal tools for faculty."],
  "focus":"ats",
  "required_keywords":["python","api"]
}
```

## Notes

- The sandbox imports the real `app.utils.ai` module, so it exercises the same code path the backend uses.
- The MLflow runner logs per-task summaries, runtime config, and full evaluation artifacts for later comparison.
- Generated eval bundles are ignored by git via `backend/ml_sandbox/datasets/generated/`.
- Keep large datasets and model artifacts out of git unless they are intentionally versioned.
- `TOKENIZERS_PARALLELISM=false` is already enforced in the production AI module to avoid macOS semaphore warnings.
