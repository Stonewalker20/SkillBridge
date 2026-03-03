# SkillBridge ML Sandbox

This workspace is for notebook-driven experimentation on the local transformer pipeline without changing the production request path first.

Use it for:
- benchmarking skill extraction latency
- comparing embedding models
- tuning semantic alignment scoring
- building small labeled evaluation sets for accuracy checks
- profiling memory and throughput before promoting a change into `backend/app/utils/ai.py`

## Layout

- `requirements.txt`: notebook and evaluation dependencies for the sandbox
- `notebook_setup.py`: helpers that import the real SkillBridge backend modules
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

## Recommended Workflow

1. Add a small labeled dataset under `datasets/`.
2. Use the notebook to measure baseline latency and extraction quality.
3. Compare alternate local models by overriding:
   - `settings.local_embedding_model`
   - `settings.local_zero_shot_model`
4. Keep candidate extraction and scoring changes in the sandbox first.
5. Only port changes into production code after you have benchmark evidence.

## Notes

- The sandbox imports the real `app.utils.ai` module, so it exercises the same code path the backend uses.
- Keep large datasets and model artifacts out of git unless they are intentionally versioned.
- `TOKENIZERS_PARALLELISM=false` is already enforced in the production AI module to avoid macOS semaphore warnings.
