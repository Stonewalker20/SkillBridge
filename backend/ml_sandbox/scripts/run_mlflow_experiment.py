"""Run MLflow-tracked sandbox evaluations against the current SkillBridge AI stack."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
BACKEND_ROOT = ROOT / "backend"

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from ml_sandbox.pipeline import (  # noqa: E402
    build_experiment_configs,
    evaluate_extraction_samples,
    evaluate_ranking_samples,
    evaluate_rewrite_samples,
    flatten_numeric_metrics,
    load_extraction_samples,
    load_ranking_samples,
    load_rewrite_samples,
    runtime_status,
    write_json_artifact,
)


def _git_sha() -> str:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
    except Exception:
        return "unknown"
    return result.stdout.strip() or "unknown"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    default_tracking_db = ROOT / "backend" / "ml_sandbox" / "artifacts" / "mlflow.db"
    default_artifact_root = ROOT / "backend" / "ml_sandbox" / "artifacts" / "mlartifacts"
    parser.add_argument(
        "--tracking-uri",
        default=f"sqlite:///{default_tracking_db.resolve()}",
        help="MLflow tracking URI. Defaults to a local SQLite store under backend/ml_sandbox/artifacts/mlflow.db.",
    )
    parser.add_argument(
        "--artifact-root",
        default=f"file://{default_artifact_root.resolve()}",
        help="Artifact root for newly created MLflow experiments.",
    )
    parser.add_argument("--experiment-name", default="skillbridge-local-ai")
    parser.add_argument("--run-name", default="")
    parser.add_argument(
        "--dataset-dir",
        default="",
        help="Directory containing extraction_eval.jsonl, ranking_eval.jsonl, rewrite_eval.jsonl, and optionally manifest.json.",
    )
    parser.add_argument("--extraction-dataset", default=str(ROOT / "backend" / "ml_sandbox" / "datasets" / "sample_extraction_eval.jsonl"))
    parser.add_argument("--ranking-dataset", default=str(ROOT / "backend" / "ml_sandbox" / "datasets" / "sample_ranking_eval.jsonl"))
    parser.add_argument("--rewrite-dataset", default=str(ROOT / "backend" / "ml_sandbox" / "datasets" / "sample_rewrite_eval.jsonl"))
    parser.add_argument("--skip-extraction", action="store_true")
    parser.add_argument("--skip-ranking", action="store_true")
    parser.add_argument("--skip-rewrite", action="store_true")
    parser.add_argument("--max-candidates", type=int, default=25)
    parser.add_argument("--top-k", type=int, nargs="*", default=[1, 3, 5])
    parser.add_argument("--inference-mode", action="append", default=[])
    parser.add_argument("--embedding-model", action="append", default=[])
    parser.add_argument("--zero-shot-model", action="append", default=[])
    parser.add_argument("--rewrite-model", action="append", default=[])
    parser.add_argument(
        "--tag",
        action="append",
        default=[],
        help="Run tag in key=value form. Can be passed multiple times.",
    )
    return parser.parse_args()


def _parse_tags(items: list[str]) -> dict[str, str]:
    tags: dict[str, str] = {}
    for item in items:
        if "=" not in item:
            raise ValueError(f"Invalid tag '{item}'. Use key=value.")
        key, value = item.split("=", 1)
        tags[key.strip()] = value.strip()
    return tags


def _evaluate_config(args: argparse.Namespace, config: dict[str, str]) -> dict[str, dict]:
    results: dict[str, dict] = {}
    if not args.skip_extraction and Path(args.extraction_dataset).exists():
        extraction_samples = load_extraction_samples(args.extraction_dataset)
        results["extraction"] = evaluate_extraction_samples(
            extraction_samples,
            preferences=config,
            max_candidates=args.max_candidates,
        )
    if not args.skip_ranking and Path(args.ranking_dataset).exists():
        ranking_samples = load_ranking_samples(args.ranking_dataset)
        results["ranking"] = evaluate_ranking_samples(
            ranking_samples,
            preferences=config,
            ks=args.top_k,
        )
    if not args.skip_rewrite and Path(args.rewrite_dataset).exists():
        rewrite_samples = load_rewrite_samples(args.rewrite_dataset)
        results["rewrite"] = evaluate_rewrite_samples(
            rewrite_samples,
            preferences=config,
        )
    return results


def main() -> int:
    args = parse_args()
    import mlflow
    from mlflow.tracking import MlflowClient

    if args.dataset_dir:
        dataset_dir = Path(args.dataset_dir).expanduser()
        args.extraction_dataset = str(dataset_dir / "extraction_eval.jsonl")
        args.ranking_dataset = str(dataset_dir / "ranking_eval.jsonl")
        args.rewrite_dataset = str(dataset_dir / "rewrite_eval.jsonl")

    args.inference_mode = args.inference_mode or ["auto"]
    args.embedding_model = args.embedding_model or ["sentence-transformers/all-MiniLM-L6-v2"]
    args.zero_shot_model = args.zero_shot_model or ["MoritzLaurer/deberta-v3-base-zeroshot-v1.1-all-33"]
    args.rewrite_model = args.rewrite_model or ["google/flan-t5-small"]

    artifacts_root = ROOT / "backend" / "ml_sandbox" / "artifacts"
    artifacts_root.mkdir(parents=True, exist_ok=True)
    (artifacts_root / "mlartifacts").mkdir(parents=True, exist_ok=True)

    mlflow.set_tracking_uri(args.tracking_uri)
    client = MlflowClient(tracking_uri=args.tracking_uri)
    experiment = client.get_experiment_by_name(args.experiment_name)
    if experiment is None:
        experiment_id = client.create_experiment(args.experiment_name, artifact_location=args.artifact_root)
    else:
        experiment_id = experiment.experiment_id

    configs = build_experiment_configs(
        inference_modes=args.inference_mode,
        embedding_models=args.embedding_model,
        zero_shot_models=args.zero_shot_model,
        rewrite_models=args.rewrite_model,
    )
    tags = _parse_tags(args.tag)
    parent_run_name = args.run_name or f"skillbridge-sweep-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"

    with mlflow.start_run(experiment_id=experiment_id, run_name=parent_run_name) as parent_run:
        mlflow.set_tags(
            {
                "pipeline": "skillbridge-ml-sandbox",
                "git_sha": _git_sha(),
                **tags,
            }
        )
        mlflow.log_params(
            {
                "config_count": len(configs),
                "max_candidates": args.max_candidates,
                "top_k": ",".join(str(value) for value in args.top_k),
                "tracking_uri": args.tracking_uri,
                "dataset_dir": args.dataset_dir or "",
                "extraction_dataset": args.extraction_dataset,
                "ranking_dataset": args.ranking_dataset,
                "rewrite_dataset": args.rewrite_dataset,
                "rewrite_models": ",".join(args.rewrite_model),
            }
        )
        manifest_path = Path(args.dataset_dir).expanduser() / "manifest.json" if args.dataset_dir else None
        if manifest_path and manifest_path.exists():
            mlflow.log_artifact(str(manifest_path), artifact_path="datasets")

        parent_summary: dict[str, dict] = {}
        for index, config in enumerate(configs, start=1):
            child_run_name = (
                f"{config['inference_mode']}::{config['embedding_model'].split('/')[-1]}"
                f"::{config['zero_shot_model'].split('/')[-1]}"
                f"::{config['rewrite_model'].split('/')[-1]}"
            )
            with mlflow.start_run(experiment_id=experiment_id, run_name=child_run_name, nested=True):
                mlflow.log_params(config)
                status = runtime_status(config)
                mlflow.log_dict(status, "runtime_status.json")
                results = _evaluate_config(args, config)
                metrics: dict[str, float] = {}
                compact_summary: dict[str, dict] = {}
                for task_name, payload in results.items():
                    summary = payload["summary"]
                    metrics.update(flatten_numeric_metrics(summary, task_name))
                    compact_summary[task_name] = summary
                    artifact_path = write_json_artifact(payload, f"{task_name}_evaluation.json")
                    mlflow.log_artifact(str(artifact_path), artifact_path="evaluations")
                mlflow.log_metrics(metrics)
                mlflow.set_tags(
                    {
                        "config_index": str(index),
                        "has_extraction": str("extraction" in results).lower(),
                        "has_ranking": str("ranking" in results).lower(),
                        "has_rewrite": str("rewrite" in results).lower(),
                    }
                )
                parent_summary[child_run_name] = compact_summary

        summary_path = write_json_artifact(parent_summary, "sweep_summary.json")
        mlflow.log_artifact(str(summary_path), artifact_path="summaries")
        print(json.dumps({"experiment": args.experiment_name, "parent_run_id": parent_run.info.run_id, "configs": list(parent_summary.keys())}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
