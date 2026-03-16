"""Reusable evaluation helpers for MLflow-backed local AI experiments."""

from __future__ import annotations

import asyncio
import json
import math
import re
import statistics
import sys
import tempfile
import time
from dataclasses import dataclass
from itertools import product
from pathlib import Path
from typing import Any, Iterable, Sequence


ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = ROOT / "backend"

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def _load_ai_runtime():
    from app.utils.ai import (
        cosine_similarity,
        embed_texts,
        extract_skill_candidates,
        get_inference_status,
        normalize_ai_preferences,
        rewrite_resume_bullets,
    )

    return {
        "cosine_similarity": cosine_similarity,
        "embed_texts": embed_texts,
        "extract_skill_candidates": extract_skill_candidates,
        "get_inference_status": get_inference_status,
        "normalize_ai_preferences": normalize_ai_preferences,
        "rewrite_resume_bullets": rewrite_resume_bullets,
    }


@dataclass(frozen=True)
class ExtractionSample:
    id: str
    text: str
    expected_skills: tuple[str, ...]
    metadata: dict[str, Any]


@dataclass(frozen=True)
class RankingCandidate:
    id: str
    text: str
    label: float
    metadata: dict[str, Any]


@dataclass(frozen=True)
class RankingSample:
    id: str
    query: str
    candidates: tuple[RankingCandidate, ...]
    metadata: dict[str, Any]


@dataclass(frozen=True)
class RewriteSample:
    id: str
    job_text: str
    bullets: tuple[str, ...]
    focus: str
    required_keywords: tuple[str, ...]
    metadata: dict[str, Any]


def read_jsonl(path: str | Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with Path(path).open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            stripped = line.strip()
            if not stripped:
                continue
            try:
                payload = json.loads(stripped)
            except json.JSONDecodeError as exc:
                raise ValueError(f"Invalid JSONL at {path}:{line_number}: {exc}") from exc
            if not isinstance(payload, dict):
                raise ValueError(f"Expected JSON object at {path}:{line_number}")
            rows.append(payload)
    return rows


def normalize_skill_name(value: str) -> str:
    normalized = re.sub(r"\s+", " ", str(value or "").strip().lower())
    return normalized.strip(" .,:;")


def normalize_skill_set(values: Iterable[str]) -> set[str]:
    return {normalized for normalized in (normalize_skill_name(value) for value in values) if normalized}


def _mean(values: Iterable[float]) -> float:
    rows = [float(value) for value in values]
    if not rows:
        return 0.0
    return round(statistics.fmean(rows), 4)


def load_extraction_samples(path: str | Path) -> list[ExtractionSample]:
    rows = read_jsonl(path)
    samples: list[ExtractionSample] = []
    for index, row in enumerate(rows, start=1):
        text = str(row.get("text") or "").strip()
        expected = tuple(str(value or "").strip() for value in (row.get("expected_skills") or []) if str(value or "").strip())
        if not text:
            raise ValueError(f"Extraction sample {index} is missing text")
        if not expected:
            raise ValueError(f"Extraction sample {index} must include expected_skills")
        samples.append(
            ExtractionSample(
                id=str(row.get("id") or f"extraction-{index}"),
                text=text,
                expected_skills=expected,
                metadata=dict(row.get("metadata") or {}),
            )
        )
    return samples


def load_ranking_samples(path: str | Path) -> list[RankingSample]:
    rows = read_jsonl(path)
    samples: list[RankingSample] = []
    for index, row in enumerate(rows, start=1):
        query = str(row.get("query") or "").strip()
        candidates_raw = row.get("candidates") or []
        if not query:
            raise ValueError(f"Ranking sample {index} is missing query")
        if not isinstance(candidates_raw, list) or not candidates_raw:
            raise ValueError(f"Ranking sample {index} must include candidates")
        candidates: list[RankingCandidate] = []
        for candidate_index, candidate in enumerate(candidates_raw, start=1):
            if not isinstance(candidate, dict):
                raise ValueError(f"Ranking sample {index} candidate {candidate_index} must be an object")
            text = str(candidate.get("text") or "").strip()
            if not text:
                raise ValueError(f"Ranking sample {index} candidate {candidate_index} is missing text")
            candidates.append(
                RankingCandidate(
                    id=str(candidate.get("id") or f"{index}-candidate-{candidate_index}"),
                    text=text,
                    label=float(candidate.get("label") or 0.0),
                    metadata=dict(candidate.get("metadata") or {}),
                )
            )
        samples.append(
            RankingSample(
                id=str(row.get("id") or f"ranking-{index}"),
                query=query,
                candidates=tuple(candidates),
                metadata=dict(row.get("metadata") or {}),
            )
        )
    return samples


def load_rewrite_samples(path: str | Path) -> list[RewriteSample]:
    rows = read_jsonl(path)
    samples: list[RewriteSample] = []
    for index, row in enumerate(rows, start=1):
        job_text = str(row.get("job_text") or "").strip()
        bullets = tuple(str(value or "").strip() for value in (row.get("bullets") or []) if str(value or "").strip())
        if not job_text:
            raise ValueError(f"Rewrite sample {index} is missing job_text")
        if not bullets:
            raise ValueError(f"Rewrite sample {index} must include bullets")
        samples.append(
            RewriteSample(
                id=str(row.get("id") or f"rewrite-{index}"),
                job_text=job_text,
                bullets=bullets,
                focus=str(row.get("focus") or "balanced").strip() or "balanced",
                required_keywords=tuple(
                    str(value or "").strip() for value in (row.get("required_keywords") or []) if str(value or "").strip()
                ),
                metadata=dict(row.get("metadata") or {}),
            )
        )
    return samples


def compute_extraction_metrics(records: Sequence[dict[str, Any]]) -> dict[str, Any]:
    sample_count = len(records)
    true_positives = sum(int(record.get("true_positives") or 0) for record in records)
    false_positives = sum(int(record.get("false_positives") or 0) for record in records)
    false_negatives = sum(int(record.get("false_negatives") or 0) for record in records)
    precision = true_positives / (true_positives + false_positives) if (true_positives + false_positives) else 0.0
    recall = true_positives / (true_positives + false_negatives) if (true_positives + false_negatives) else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
    return {
        "sample_count": sample_count,
        "micro_precision": round(precision, 4),
        "micro_recall": round(recall, 4),
        "micro_f1": round(f1, 4),
        "exact_match_rate": _mean(float(bool(record.get("exact_match"))) for record in records),
        "avg_jaccard": _mean(float(record.get("jaccard") or 0.0) for record in records),
        "avg_latency_ms": _mean(float(record.get("latency_ms") or 0.0) for record in records),
        "avg_candidate_count": _mean(float(record.get("candidate_count") or 0.0) for record in records),
        "provider_counts": _count_by_key(records, "provider"),
    }


def _count_by_key(records: Sequence[dict[str, Any]], key: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for record in records:
        value = str(record.get(key) or "unknown")
        counts[value] = counts.get(value, 0) + 1
    return counts


def _dcg(labels: Sequence[float]) -> float:
    score = 0.0
    for index, label in enumerate(labels, start=1):
        score += (2**float(label) - 1) / math.log2(index + 1)
    return score


def compute_ranking_metrics(records: Sequence[dict[str, Any]], ks: Sequence[int] = (1, 3, 5)) -> dict[str, Any]:
    normalized_ks = tuple(sorted({max(1, int(value)) for value in ks}))
    summary: dict[str, Any] = {
        "sample_count": len(records),
        "avg_latency_ms": _mean(float(record.get("latency_ms") or 0.0) for record in records),
        "avg_candidate_count": _mean(float(record.get("candidate_count") or 0.0) for record in records),
        "mrr": _mean(float(record.get("mrr") or 0.0) for record in records),
        "provider_counts": _count_by_key(records, "provider"),
    }
    for k in normalized_ks:
        summary[f"hit_rate_at_{k}"] = _mean(float(record.get(f"hit_rate_at_{k}") or 0.0) for record in records)
        summary[f"recall_at_{k}"] = _mean(float(record.get(f"recall_at_{k}") or 0.0) for record in records)
        summary[f"ndcg_at_{k}"] = _mean(float(record.get(f"ndcg_at_{k}") or 0.0) for record in records)
    return summary


def compute_rewrite_metrics(records: Sequence[dict[str, Any]]) -> dict[str, Any]:
    return {
        "sample_count": len(records),
        "avg_latency_ms": _mean(float(record.get("latency_ms") or 0.0) for record in records),
        "keyword_coverage": _mean(float(record.get("keyword_coverage") or 0.0) for record in records),
        "exact_bullet_count_rate": _mean(float(record.get("exact_bullet_count") or 0.0) for record in records),
        "avg_change_ratio": _mean(float(record.get("change_ratio") or 0.0) for record in records),
        "avg_output_chars": _mean(float(record.get("output_chars") or 0.0) for record in records),
        "provider_counts": _count_by_key(records, "provider"),
    }


async def _evaluate_extraction_samples(
    samples: Sequence[ExtractionSample],
    *,
    preferences: dict[str, str],
    max_candidates: int = 25,
) -> dict[str, Any]:
    runtime = _load_ai_runtime()
    extract_skill_candidates = runtime["extract_skill_candidates"]
    records: list[dict[str, Any]] = []

    for sample in samples:
        started = time.perf_counter()
        predicted, provider = await extract_skill_candidates(sample.text, max_candidates=max_candidates, preferences=preferences)
        latency_ms = round((time.perf_counter() - started) * 1000, 2)
        expected_set = normalize_skill_set(sample.expected_skills)
        predicted_names = [str(entry.get("name") or "").strip() for entry in predicted]
        predicted_set = normalize_skill_set(predicted_names)
        true_positives = len(expected_set & predicted_set)
        false_positives = len(predicted_set - expected_set)
        false_negatives = len(expected_set - predicted_set)
        union_size = len(expected_set | predicted_set)
        records.append(
            {
                "id": sample.id,
                "provider": provider,
                "latency_ms": latency_ms,
                "candidate_count": len(predicted_names),
                "true_positives": true_positives,
                "false_positives": false_positives,
                "false_negatives": false_negatives,
                "exact_match": predicted_set == expected_set,
                "jaccard": round((true_positives / union_size), 4) if union_size else 1.0,
                "expected_skills": sorted(expected_set),
                "predicted_skills": sorted(predicted_set),
                "missing_skills": sorted(expected_set - predicted_set),
                "extra_skills": sorted(predicted_set - expected_set),
                "metadata": sample.metadata,
            }
        )

    return {"summary": compute_extraction_metrics(records), "records": records}


async def _evaluate_ranking_samples(
    samples: Sequence[RankingSample],
    *,
    preferences: dict[str, str],
    ks: Sequence[int] = (1, 3, 5),
) -> dict[str, Any]:
    runtime = _load_ai_runtime()
    embed_texts = runtime["embed_texts"]
    cosine_similarity = runtime["cosine_similarity"]
    normalized_ks = tuple(sorted({max(1, int(value)) for value in ks}))
    records: list[dict[str, Any]] = []

    for sample in samples:
        batch = [sample.query, *[candidate.text for candidate in sample.candidates]]
        started = time.perf_counter()
        vectors, provider = await embed_texts(batch, preferences=preferences)
        latency_ms = round((time.perf_counter() - started) * 1000, 2)
        if len(vectors) != len(batch):
            raise RuntimeError(f"Embedding count mismatch for ranking sample {sample.id}")
        query_vec = vectors[0]
        ranked = []
        for candidate, vector in zip(sample.candidates, vectors[1:]):
            ranked.append(
                {
                    "id": candidate.id,
                    "text": candidate.text,
                    "label": candidate.label,
                    "score": float(cosine_similarity(query_vec, vector)),
                    "metadata": candidate.metadata,
                }
            )
        ranked.sort(key=lambda row: row["score"], reverse=True)

        relevant_labels = [float(entry["label"]) for entry in ranked if float(entry["label"]) > 0]
        positive_count = len(relevant_labels)
        first_relevant_rank = next((index for index, entry in enumerate(ranked, start=1) if float(entry["label"]) > 0), None)
        record: dict[str, Any] = {
            "id": sample.id,
            "provider": provider,
            "latency_ms": latency_ms,
            "candidate_count": len(ranked),
            "mrr": round((1.0 / first_relevant_rank), 4) if first_relevant_rank else 0.0,
            "ranked_candidates": ranked,
            "metadata": sample.metadata,
        }
        ideal_labels = sorted((float(entry["label"]) for entry in ranked), reverse=True)
        for k in normalized_ks:
            top_k = ranked[:k]
            hits = sum(1 for entry in top_k if float(entry["label"]) > 0)
            record[f"hit_rate_at_{k}"] = 1.0 if hits > 0 else 0.0
            record[f"recall_at_{k}"] = round((hits / positive_count), 4) if positive_count else 0.0
            dcg = _dcg([float(entry["label"]) for entry in top_k])
            idcg = _dcg(ideal_labels[:k])
            record[f"ndcg_at_{k}"] = round((dcg / idcg), 4) if idcg > 0 else 0.0
        records.append(record)

    return {"summary": compute_ranking_metrics(records, ks=normalized_ks), "records": records}


async def _evaluate_rewrite_samples(
    samples: Sequence[RewriteSample],
    *,
    preferences: dict[str, str],
) -> dict[str, Any]:
    runtime = _load_ai_runtime()
    rewrite_resume_bullets = runtime["rewrite_resume_bullets"]
    records: list[dict[str, Any]] = []

    for sample in samples:
        started = time.perf_counter()
        rewritten, provider = await rewrite_resume_bullets(sample.job_text, list(sample.bullets), focus=sample.focus)
        latency_ms = round((time.perf_counter() - started) * 1000, 2)
        normalized_output = " ".join(str(value or "").strip().lower() for value in rewritten)
        required_hits = [
            keyword for keyword in sample.required_keywords if str(keyword or "").strip() and str(keyword).strip().lower() in normalized_output
        ]
        original_joined = " ".join(sample.bullets).strip()
        rewritten_joined = " ".join(rewritten).strip()
        change_ratio = 0.0
        if original_joined or rewritten_joined:
            common_length = len(set(original_joined.lower().split()) & set(rewritten_joined.lower().split()))
            denominator = max(1, len(set(original_joined.lower().split()) | set(rewritten_joined.lower().split())))
            change_ratio = round(1.0 - (common_length / denominator), 4)
        records.append(
            {
                "id": sample.id,
                "provider": provider,
                "latency_ms": latency_ms,
                "keyword_coverage": round((len(required_hits) / len(sample.required_keywords)), 4) if sample.required_keywords else 1.0,
                "exact_bullet_count": 1.0 if len(rewritten) == len(sample.bullets) else 0.0,
                "change_ratio": change_ratio,
                "output_chars": len(rewritten_joined),
                "required_hits": list(required_hits),
                "rewritten_bullets": rewritten,
                "metadata": sample.metadata,
            }
        )
    return {"summary": compute_rewrite_metrics(records), "records": records}


def evaluate_extraction_samples(
    samples: Sequence[ExtractionSample],
    *,
    preferences: dict[str, str] | None = None,
    max_candidates: int = 25,
) -> dict[str, Any]:
    runtime = _load_ai_runtime()
    normalized = runtime["normalize_ai_preferences"](preferences)
    return asyncio.run(_evaluate_extraction_samples(samples, preferences=normalized, max_candidates=max_candidates))


def evaluate_ranking_samples(
    samples: Sequence[RankingSample],
    *,
    preferences: dict[str, str] | None = None,
    ks: Sequence[int] = (1, 3, 5),
) -> dict[str, Any]:
    runtime = _load_ai_runtime()
    normalized = runtime["normalize_ai_preferences"](preferences)
    return asyncio.run(_evaluate_ranking_samples(samples, preferences=normalized, ks=ks))


def evaluate_rewrite_samples(
    samples: Sequence[RewriteSample],
    *,
    preferences: dict[str, str] | None = None,
) -> dict[str, Any]:
    runtime = _load_ai_runtime()
    normalized = runtime["normalize_ai_preferences"](preferences)
    return asyncio.run(_evaluate_rewrite_samples(samples, preferences=normalized))


def build_experiment_configs(
    *,
    inference_modes: Sequence[str],
    embedding_models: Sequence[str],
    zero_shot_models: Sequence[str],
) -> list[dict[str, str]]:
    runtime = _load_ai_runtime()
    normalize_ai_preferences = runtime["normalize_ai_preferences"]
    configs: list[dict[str, str]] = []
    seen: set[tuple[str, str, str]] = set()
    for inference_mode, embedding_model, zero_shot_model in product(inference_modes, embedding_models, zero_shot_models):
        normalized = normalize_ai_preferences(
            {
                "inference_mode": inference_mode,
                "embedding_model": embedding_model,
                "zero_shot_model": zero_shot_model,
            }
        )
        key = (normalized["inference_mode"], normalized["embedding_model"], normalized["zero_shot_model"])
        if key in seen:
            continue
        seen.add(key)
        configs.append(normalized)
    return configs


def flatten_numeric_metrics(data: dict[str, Any], prefix: str = "") -> dict[str, float]:
    flattened: dict[str, float] = {}
    for key, value in data.items():
        metric_key = f"{prefix}.{key}" if prefix else str(key)
        if isinstance(value, dict):
            flattened.update(flatten_numeric_metrics(value, metric_key))
            continue
        if isinstance(value, bool):
            flattened[metric_key] = 1.0 if value else 0.0
            continue
        if isinstance(value, (int, float)) and math.isfinite(float(value)):
            flattened[metric_key] = float(value)
    return flattened


def runtime_status(preferences: dict[str, str] | None = None) -> dict[str, Any]:
    runtime = _load_ai_runtime()
    get_inference_status = runtime["get_inference_status"]
    normalize_ai_preferences = runtime["normalize_ai_preferences"]
    normalized = normalize_ai_preferences(preferences)
    return {
        "project_root": str(ROOT),
        "backend_root": str(BACKEND_ROOT),
        "preferences": normalized,
        "inference_status": get_inference_status(normalized),
    }


def write_json_artifact(payload: dict[str, Any], filename: str) -> Path:
    target_dir = Path(tempfile.mkdtemp(prefix="skillbridge-mlflow-"))
    target = target_dir / filename
    target.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    return target

