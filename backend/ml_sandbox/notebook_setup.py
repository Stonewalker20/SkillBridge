"""Notebook bootstrap helpers for local ML experimentation without changing production backend code."""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = ROOT / "backend"

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import settings  # noqa: E402
from app.utils.ai import cosine_similarity, embed_texts, extract_skill_candidates, get_inference_status  # noqa: E402
from ml_sandbox.pipeline import (  # noqa: E402
    evaluate_extraction_samples,
    evaluate_ranking_samples,
    evaluate_rewrite_samples,
    load_extraction_samples,
    load_ranking_samples,
    load_rewrite_samples,
    runtime_status as pipeline_runtime_status,
)


def read_json(path: str | Path):
    with Path(path).open("r", encoding="utf-8") as handle:
        return json.load(handle)


def generated_dataset_paths(output_dir: str | Path) -> dict[str, str]:
    root = Path(output_dir)
    return {
        "extraction": str(root / "extraction_eval.jsonl"),
        "ranking": str(root / "ranking_eval.jsonl"),
        "rewrite": str(root / "rewrite_eval.jsonl"),
        "manifest": str(root / "manifest.json"),
    }


def benchmark_extraction(texts: Iterable[str], max_candidates: int = 25) -> list[dict]:
    import asyncio

    rows: list[dict] = []
    for index, text in enumerate(texts, start=1):
        started = time.perf_counter()
        skills, provider = asyncio.run(extract_skill_candidates(text, max_candidates=max_candidates))
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
        rows.append(
            {
                "row": index,
                "provider": provider,
                "elapsed_ms": elapsed_ms,
                "candidate_count": len(skills),
                "skills": skills,
            }
        )
    return rows


def benchmark_embeddings(texts: Iterable[str]) -> dict:
    import asyncio

    started = time.perf_counter()
    vectors, provider = asyncio.run(embed_texts(list(texts)))
    elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
    return {
        "provider": provider,
        "elapsed_ms": elapsed_ms,
        "vector_count": len(vectors),
        "dimensions": len(vectors[0]) if vectors else 0,
    }


def pairwise_alignment(reference: str, candidates: Iterable[str]) -> list[dict]:
    import asyncio

    batch = [reference, *list(candidates)]
    vectors, provider = asyncio.run(embed_texts(batch))
    if len(vectors) < 2:
        return []

    reference_vec = vectors[0]
    rows: list[dict] = []
    for text, vec in zip(batch[1:], vectors[1:]):
        rows.append(
            {
                "text": text,
                "semantic_alignment": cosine_similarity(reference_vec, vec),
                "provider": provider,
            }
        )
    rows.sort(key=lambda row: row["semantic_alignment"], reverse=True)
    return rows


def runtime_status() -> dict:
    return {
        "project_root": str(ROOT),
        "backend_root": str(BACKEND_ROOT),
        "inference_status": get_inference_status(),
        "embedding_model": settings.local_embedding_model,
        "zero_shot_model": settings.local_zero_shot_model,
        "device": settings.local_model_device,
    }


def evaluate_extraction_dataset(path: str | Path, preferences: dict | None = None, max_candidates: int = 25) -> dict:
    return evaluate_extraction_samples(load_extraction_samples(path), preferences=preferences, max_candidates=max_candidates)


def evaluate_ranking_dataset(path: str | Path, preferences: dict | None = None, ks: tuple[int, ...] = (1, 3, 5)) -> dict:
    return evaluate_ranking_samples(load_ranking_samples(path), preferences=preferences, ks=ks)


def evaluate_rewrite_dataset(path: str | Path, preferences: dict | None = None) -> dict:
    return evaluate_rewrite_samples(load_rewrite_samples(path), preferences=preferences)


def sandbox_runtime_status(preferences: dict | None = None) -> dict:
    return pipeline_runtime_status(preferences)
