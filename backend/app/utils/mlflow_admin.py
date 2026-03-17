"""Helpers for reading MLflow tracking data and running curated sandbox jobs from the admin workspace."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.utils.ai import AVAILABLE_INFERENCE_MODES

ROOT = Path(__file__).resolve().parents[3]
BACKEND_ROOT = ROOT / "backend"
SANDBOX_ROOT = BACKEND_ROOT / "ml_sandbox"
DATASETS_ROOT = SANDBOX_ROOT / "datasets"
GENERATED_DATASETS_ROOT = DATASETS_ROOT / "generated"
RUN_SCRIPT = SANDBOX_ROOT / "scripts" / "run_mlflow_experiment.py"
EXPORT_SCRIPT = SANDBOX_ROOT / "scripts" / "export_eval_sets.py"
TRACKING_DB = SANDBOX_ROOT / "artifacts" / "mlflow.db"
DEFAULT_ANON_SALT_ENV = "ML_SANDBOX_ANON_SALT"
MAX_JOB_LOG_LINES = 400

PREFERRED_METRIC_KEYS = (
    "rewrite.keyword_recall",
    "ranking.map",
    "ranking.ndcg_at_3",
    "ranking.ndcg_at_5",
    "extraction.f1",
    "extraction.recall",
    "extraction.precision",
    "accuracy",
)

_JOBS_LOCK = threading.Lock()
_JOBS: dict[str, dict[str, Any]] = {}


def _from_millis(value: int | float | None) -> datetime | None:
    if value in (None, 0):
        return None
    try:
        return datetime.fromtimestamp(float(value) / 1000.0, tz=timezone.utc)
    except Exception:
        return None


def _default_tracking_uri() -> str:
    return f"sqlite:///{TRACKING_DB.resolve()}"


def _summarize_primary_metric(metrics: dict[str, float]) -> tuple[str | None, float | None]:
    if not metrics:
        return None, None
    for key in PREFERRED_METRIC_KEYS:
        if key in metrics:
            return key, float(metrics[key])
    fallback_key = sorted(metrics.keys())[0]
    return fallback_key, float(metrics[fallback_key])


@dataclass
class MlflowAdminUnavailable(Exception):
    message: str


def _client_and_tracking_uri() -> tuple[Any, str]:
    tracking_uri = _default_tracking_uri()
    try:
        from mlflow.tracking import MlflowClient
    except Exception as exc:  # pragma: no cover - dependency failure path
        raise MlflowAdminUnavailable(f"MLflow is not installed in the backend environment: {exc}") from exc
    return MlflowClient(tracking_uri=tracking_uri), tracking_uri


def _serialize_run(run: Any) -> dict[str, Any]:
    metrics = {str(key): float(value) for key, value in (run.data.metrics or {}).items()}
    primary_metric_key, primary_metric_value = _summarize_primary_metric(metrics)
    start_time = _from_millis(getattr(run.info, "start_time", None))
    end_time = _from_millis(getattr(run.info, "end_time", None))
    duration_seconds = None
    if start_time and end_time:
        duration_seconds = max(0.0, (end_time - start_time).total_seconds())

    return {
        "run_id": run.info.run_id,
        "run_name": run.data.tags.get("mlflow.runName") or run.info.run_name or "Unnamed run",
        "status": str(run.info.status or "UNKNOWN"),
        "experiment_id": str(run.info.experiment_id or ""),
        "artifact_uri": str(run.info.artifact_uri or ""),
        "start_time": start_time,
        "end_time": end_time,
        "duration_seconds": duration_seconds,
        "metrics": metrics,
        "params": {str(key): str(value) for key, value in (run.data.params or {}).items()},
        "tags": {str(key): str(value) for key, value in (run.data.tags or {}).items()},
        "primary_metric_key": primary_metric_key,
        "primary_metric_value": primary_metric_value,
    }


def _serialize_artifact(artifact: Any) -> dict[str, Any]:
    return {
        "path": str(getattr(artifact, "path", "") or ""),
        "is_dir": bool(getattr(artifact, "is_dir", False)),
        "file_size": getattr(artifact, "file_size", None),
    }


def get_mlflow_overview(experiment_limit: int = 12, run_preview_limit: int = 6, registered_model_limit: int = 8) -> dict[str, Any]:
    try:
        client, tracking_uri = _client_and_tracking_uri()
    except MlflowAdminUnavailable as exc:
        return {
            "available": False,
            "tracking_uri": _default_tracking_uri(),
            "experiment_count": 0,
            "registered_model_count": 0,
            "latest_run_started_at": None,
            "experiments": [],
            "registered_models": [],
            "error": exc.message,
        }

    try:
        experiments = list(client.search_experiments(max_results=experiment_limit))
    except Exception as exc:
        return {
            "available": False,
            "tracking_uri": tracking_uri,
            "experiment_count": 0,
            "registered_model_count": 0,
            "latest_run_started_at": None,
            "experiments": [],
            "registered_models": [],
            "error": f"Unable to query MLflow experiments: {exc}",
        }

    experiment_rows: list[dict[str, Any]] = []
    latest_run_started_at: datetime | None = None
    for experiment in experiments:
        recent_runs = client.search_runs(
            experiment_ids=[experiment.experiment_id],
            order_by=["attributes.start_time DESC"],
            max_results=run_preview_limit,
        )
        serialized_runs = [_serialize_run(run) for run in recent_runs]
        latest_experiment_run = serialized_runs[0]["start_time"] if serialized_runs else None
        if latest_experiment_run and (latest_run_started_at is None or latest_experiment_run > latest_run_started_at):
            latest_run_started_at = latest_experiment_run
        experiment_rows.append(
            {
                "id": str(experiment.experiment_id),
                "name": str(experiment.name or "Unnamed experiment"),
                "lifecycle_stage": str(experiment.lifecycle_stage or "active"),
                "creation_time": _from_millis(getattr(experiment, "creation_time", None)),
                "last_update_time": _from_millis(getattr(experiment, "last_update_time", None)),
                "run_count": len(serialized_runs),
                "latest_run_started_at": latest_experiment_run,
                "latest_runs": serialized_runs,
            }
        )

    registered_models: list[dict[str, Any]] = []
    try:
        model_rows = list(client.search_registered_models(max_results=registered_model_limit))
        for model in model_rows:
            latest_versions = []
            for version in getattr(model, "latest_versions", []) or []:
                latest_versions.append(
                    {
                        "name": str(version.name or ""),
                        "version": str(version.version or ""),
                        "current_stage": str(version.current_stage or ""),
                        "run_id": str(version.run_id or ""),
                        "source": str(version.source or ""),
                        "creation_timestamp": _from_millis(getattr(version, "creation_timestamp", None)),
                    }
                )
            registered_models.append(
                {
                    "name": str(model.name or ""),
                    "description": str(model.description or "").strip() or None,
                    "latest_versions": latest_versions,
                }
            )
    except Exception:
        registered_models = []

    return {
        "available": True,
        "tracking_uri": tracking_uri,
        "experiment_count": len(experiment_rows),
        "registered_model_count": len(registered_models),
        "latest_run_started_at": latest_run_started_at,
        "experiments": experiment_rows,
        "registered_models": registered_models,
        "error": None,
    }


def get_mlflow_experiment_runs(experiment_id: str, limit: int = 25) -> list[dict[str, Any]]:
    client, _tracking_uri = _client_and_tracking_uri()
    runs = client.search_runs(
        experiment_ids=[str(experiment_id)],
        order_by=["attributes.start_time DESC"],
        max_results=limit,
    )
    return [_serialize_run(run) for run in runs]


def get_mlflow_run_detail(experiment_id: str, run_id: str) -> dict[str, Any]:
    client, _tracking_uri = _client_and_tracking_uri()
    run = client.get_run(run_id)
    if str(run.info.experiment_id or "") != str(experiment_id):
        raise MlflowAdminUnavailable("Run does not belong to the requested experiment")
    child_runs = client.search_runs(
        experiment_ids=[str(experiment_id)],
        filter_string=f"tags.mlflow.parentRunId = '{run_id}'",
        order_by=["attributes.start_time DESC"],
        max_results=50,
    )
    artifacts = client.list_artifacts(run_id)
    payload = _serialize_run(run)
    payload["parent_run_id"] = run.data.tags.get("mlflow.parentRunId")
    payload["child_runs"] = [_serialize_run(child) for child in child_runs]
    payload["artifacts"] = [_serialize_artifact(artifact) for artifact in artifacts]
    return payload


def _read_manifest_counts(manifest_path: Path) -> dict[str, int]:
    try:
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    counts = data.get("counts")
    if not isinstance(counts, dict):
        return {}
    return {str(key): int(value) for key, value in counts.items() if isinstance(value, int)}


def list_available_eval_datasets() -> list[dict[str, Any]]:
    datasets: list[dict[str, Any]] = []
    sample_extraction = DATASETS_ROOT / "sample_extraction_eval.jsonl"
    sample_ranking = DATASETS_ROOT / "sample_ranking_eval.jsonl"
    sample_rewrite = DATASETS_ROOT / "sample_rewrite_eval.jsonl"
    if sample_extraction.exists() or sample_ranking.exists() or sample_rewrite.exists():
        datasets.append(
            {
                "id": "bundled-samples",
                "label": "Bundled sample evals",
                "kind": "sample",
                "path": str(DATASETS_ROOT),
                "manifest_path": None,
                "extraction_dataset": str(sample_extraction) if sample_extraction.exists() else None,
                "ranking_dataset": str(sample_ranking) if sample_ranking.exists() else None,
                "rewrite_dataset": str(sample_rewrite) if sample_rewrite.exists() else None,
                "created_at": _from_millis(int(DATASETS_ROOT.stat().st_mtime * 1000)),
                "counts": {},
            }
        )

    if GENERATED_DATASETS_ROOT.exists():
        for directory in sorted((path for path in GENERATED_DATASETS_ROOT.iterdir() if path.is_dir()), key=lambda value: value.name, reverse=True):
            extraction = directory / "extraction_eval.jsonl"
            ranking = directory / "ranking_eval.jsonl"
            rewrite = directory / "rewrite_eval.jsonl"
            if not extraction.exists() and not ranking.exists() and not rewrite.exists():
                continue
            manifest = directory / "manifest.json"
            datasets.append(
                {
                    "id": f"generated:{directory.name}",
                    "label": f"Generated bundle {directory.name}",
                    "kind": "generated",
                    "path": str(directory),
                    "manifest_path": str(manifest) if manifest.exists() else None,
                    "extraction_dataset": str(extraction) if extraction.exists() else None,
                    "ranking_dataset": str(ranking) if ranking.exists() else None,
                    "rewrite_dataset": str(rewrite) if rewrite.exists() else None,
                    "created_at": _from_millis(int(directory.stat().st_mtime * 1000)),
                    "counts": _read_manifest_counts(manifest) if manifest.exists() else {},
                }
            )

    return datasets


def _resolve_dataset(dataset_id: str | None) -> dict[str, Any]:
    normalized = str(dataset_id or "bundled-samples").strip() or "bundled-samples"
    for dataset in list_available_eval_datasets():
        if dataset["id"] == normalized:
            return dataset
    raise ValueError("Unknown dataset selection")


def get_local_model_options() -> dict[str, Any]:
    presets = [
        {
            "id": "all-local-balanced",
            "label": "All Local Balanced",
            "description": "Tests the full local transformer stack using the default local models for embeddings, classification, and rewrites.",
            "inference_modes": ["local-transformer"],
            "embedding_models": [settings.local_embedding_model],
            "zero_shot_models": [settings.local_zero_shot_model],
            "rewrite_models": [settings.local_rewrite_model],
        },
        {
            "id": "edge-candidate",
            "label": "Edge Candidate",
            "description": "Uses the lightest configured local models so admins can check whether a fully local stack looks small and fast enough to keep optimizing.",
            "inference_modes": ["local-transformer"],
            "embedding_models": settings.local_embedding_model_options_list[:1],
            "zero_shot_models": settings.local_zero_shot_model_options_list[:1],
            "rewrite_models": settings.local_rewrite_model_options_list[:1],
        },
        {
            "id": "fallback-baseline",
            "label": "Fallback Baseline",
            "description": "Runs the non-transformer fallback path as a cheap baseline for quality and latency comparisons.",
            "inference_modes": ["local-fallback"],
            "embedding_models": settings.local_embedding_model_options_list[:1],
            "zero_shot_models": settings.local_zero_shot_model_options_list[:1],
            "rewrite_models": settings.local_rewrite_model_options_list[:1],
        },
    ]
    return {
        "available_inference_modes": list(AVAILABLE_INFERENCE_MODES),
        "embedding_models": settings.local_embedding_model_options_list,
        "zero_shot_models": settings.local_zero_shot_model_options_list,
        "rewrite_models": settings.local_rewrite_model_options_list,
        "default_inference_mode": "local-transformer",
        "default_embedding_model": settings.local_embedding_model,
        "default_zero_shot_model": settings.local_zero_shot_model,
        "default_rewrite_model": settings.local_rewrite_model,
        "presets": presets,
    }


def _ensure_script_exists(path: Path) -> None:
    if not path.exists():
        raise FileNotFoundError(f"Required script is missing: {path}")


def _sanitize_cli_values(values: list[str], *, field_name: str, max_items: int = 8) -> list[str]:
    cleaned: list[str] = []
    for raw in values:
        value = str(raw or "").strip()
        if not value:
            continue
        if len(value) > 200:
            raise ValueError(f"{field_name} value is too long")
        if value not in cleaned:
            cleaned.append(value)
    if not cleaned:
        raise ValueError(f"At least one {field_name} value is required")
    if len(cleaned) > max_items:
        raise ValueError(f"Too many {field_name} values")
    return cleaned


def _start_job(kind: str, command: list[str], *, summary: dict[str, Any], env_overrides: dict[str, str] | None = None) -> dict[str, Any]:
    job_id = uuid.uuid4().hex[:12]
    job = {
        "id": job_id,
        "kind": kind,
        "status": "queued",
        "created_at": datetime.now(timezone.utc),
        "started_at": None,
        "finished_at": None,
        "command": [str(value) for value in command],
        "summary": {str(key): str(value) for key, value in summary.items()},
        "log_lines": [],
        "return_code": None,
        "error": None,
    }
    with _JOBS_LOCK:
        _JOBS[job_id] = job

    env = os.environ.copy()
    if env_overrides:
        env.update({str(key): str(value) for key, value in env_overrides.items()})

    def runner() -> None:
        with _JOBS_LOCK:
            stored = _JOBS[job_id]
            stored["status"] = "running"
            stored["started_at"] = datetime.now(timezone.utc)
        try:
            process = subprocess.Popen(
                command,
                cwd=ROOT,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                env=env,
                bufsize=1,
            )
            assert process.stdout is not None
            for line in process.stdout:
                text = line.rstrip()
                if not text:
                    continue
                with _JOBS_LOCK:
                    lines = _JOBS[job_id]["log_lines"]
                    lines.append(text)
                    if len(lines) > MAX_JOB_LOG_LINES:
                        del lines[:-MAX_JOB_LOG_LINES]
            return_code = process.wait()
            with _JOBS_LOCK:
                stored = _JOBS[job_id]
                stored["return_code"] = return_code
                stored["status"] = "succeeded" if return_code == 0 else "failed"
                if return_code != 0 and not stored["error"]:
                    stored["error"] = f"Process exited with code {return_code}"
        except Exception as exc:
            with _JOBS_LOCK:
                stored = _JOBS[job_id]
                stored["status"] = "failed"
                stored["error"] = str(exc)
        finally:
            with _JOBS_LOCK:
                _JOBS[job_id]["finished_at"] = datetime.now(timezone.utc)

    thread = threading.Thread(target=runner, name=f"mlflow-admin-{job_id}", daemon=True)
    thread.start()
    return get_mlflow_job(job_id)


def list_mlflow_jobs(limit: int = 20) -> list[dict[str, Any]]:
    with _JOBS_LOCK:
        rows = list(_JOBS.values())
    rows.sort(key=lambda row: row["created_at"], reverse=True)
    return [dict(row) for row in rows[:limit]]


def get_mlflow_job(job_id: str) -> dict[str, Any]:
    with _JOBS_LOCK:
        job = _JOBS.get(job_id)
        if job is None:
            raise KeyError(job_id)
        return dict(job)


def launch_eval_export_job(payload: dict[str, Any]) -> dict[str, Any]:
    _ensure_script_exists(EXPORT_SCRIPT)
    salt = os.getenv(DEFAULT_ANON_SALT_ENV, "").strip()
    if not salt:
        raise ValueError(
            f"Missing anonymization salt in server env. Set {DEFAULT_ANON_SALT_ENV} before launching exports."
        )

    command = [
        sys.executable,
        str(EXPORT_SCRIPT),
        "--max-users",
        str(int(payload["max_users"])),
        "--max-per-user",
        str(int(payload["max_per_user"])),
        "--negative-count",
        str(int(payload["negative_count"])),
    ]
    mongo_db = str(payload.get("mongo_db") or "").strip()
    if mongo_db:
        if len(mongo_db) > 120:
            raise ValueError("mongo_db value is too long")
        command.extend(["--mongo-db", mongo_db])

    summary = {
        "max_users": payload["max_users"],
        "max_per_user": payload["max_per_user"],
        "negative_count": payload["negative_count"],
        "mongo_db": mongo_db or "default",
    }
    return _start_job("dataset_export", command, summary=summary)


def launch_mlflow_experiment_job(payload: dict[str, Any]) -> dict[str, Any]:
    _ensure_script_exists(RUN_SCRIPT)
    experiment_name = str(payload["experiment_name"]).strip()
    run_name = str(payload.get("run_name") or "").strip()
    if len(experiment_name) > 120:
        raise ValueError("experiment_name is too long")
    if run_name and len(run_name) > 120:
        raise ValueError("run_name is too long")

    dataset = _resolve_dataset(payload.get("dataset_id"))
    inference_modes = _sanitize_cli_values(payload.get("inference_modes") or ["auto"], field_name="inference mode")
    embedding_models = _sanitize_cli_values(
        payload.get("embedding_models") or ["sentence-transformers/all-MiniLM-L6-v2"],
        field_name="embedding model",
    )
    zero_shot_models = _sanitize_cli_values(
        payload.get("zero_shot_models") or ["MoritzLaurer/deberta-v3-base-zeroshot-v1.1-all-33"],
        field_name="zero-shot model",
    )
    rewrite_models = _sanitize_cli_values(
        payload.get("rewrite_models") or [settings.local_rewrite_model],
        field_name="rewrite model",
    )
    top_k_values = [int(value) for value in (payload.get("top_k") or [1, 3, 5])]
    if not top_k_values or any(value < 1 or value > 25 for value in top_k_values):
        raise ValueError("top_k values must be between 1 and 25")

    command = [
        sys.executable,
        str(RUN_SCRIPT),
        "--experiment-name",
        experiment_name,
        "--max-candidates",
        str(int(payload.get("max_candidates", 25))),
    ]
    if run_name:
        command.extend(["--run-name", run_name])
    if dataset["kind"] == "generated":
        command.extend(["--dataset-dir", dataset["path"]])
    if payload.get("skip_extraction"):
        command.append("--skip-extraction")
    if payload.get("skip_ranking"):
        command.append("--skip-ranking")
    if payload.get("skip_rewrite"):
        command.append("--skip-rewrite")
    for value in top_k_values:
        command.extend(["--top-k", str(value)])
    for value in inference_modes:
        command.extend(["--inference-mode", value])
    for value in embedding_models:
        command.extend(["--embedding-model", value])
    for value in zero_shot_models:
        command.extend(["--zero-shot-model", value])
    for value in rewrite_models:
        command.extend(["--rewrite-model", value])

    tags = payload.get("tags") or {}
    if isinstance(tags, dict):
        for key, value in tags.items():
            tag_key = str(key).strip()
            tag_value = str(value).strip()
            if not tag_key or not tag_value:
                continue
            if len(tag_key) > 80 or len(tag_value) > 200:
                raise ValueError("tag values are too long")
            command.extend(["--tag", f"{tag_key}={tag_value}"])

    summary = {
        "experiment_name": experiment_name,
        "run_name": run_name or "auto",
        "dataset": dataset["label"],
        "config_count": len(inference_modes) * len(embedding_models) * len(zero_shot_models) * len(rewrite_models),
    }
    return _start_job("experiment_run", command, summary=summary)
