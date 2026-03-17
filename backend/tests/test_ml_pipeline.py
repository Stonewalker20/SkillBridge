"""Unit tests for the sandbox ML evaluation helpers."""

from ml_sandbox.pipeline import (
    build_experiment_configs,
    compute_extraction_metrics,
    compute_ranking_metrics,
    compute_rewrite_metrics,
    normalize_skill_name,
    normalize_skill_set,
)


def test_normalize_skill_name_and_set():
    assert normalize_skill_name("  FastAPI ") == "fastapi"
    assert normalize_skill_set(["Python", " python ", "", "FastAPI"]) == {"python", "fastapi"}


def test_compute_extraction_metrics():
    metrics = compute_extraction_metrics(
        [
            {
                "provider": "local-transformer",
                "latency_ms": 10,
                "candidate_count": 3,
                "true_positives": 2,
                "false_positives": 1,
                "false_negatives": 0,
                "exact_match": False,
                "jaccard": 0.6667,
            },
            {
                "provider": "local-transformer",
                "latency_ms": 20,
                "candidate_count": 2,
                "true_positives": 1,
                "false_positives": 0,
                "false_negatives": 1,
                "exact_match": False,
                "jaccard": 0.5,
            },
        ]
    )
    assert metrics["sample_count"] == 2
    assert metrics["micro_precision"] == 0.75
    assert metrics["micro_recall"] == 0.75
    assert metrics["micro_f1"] == 0.75
    assert metrics["provider_counts"]["local-transformer"] == 2


def test_compute_ranking_metrics():
    metrics = compute_ranking_metrics(
        [
            {
                "provider": "local-transformer",
                "latency_ms": 12,
                "candidate_count": 3,
                "mrr": 1.0,
                "hit_rate_at_1": 1.0,
                "recall_at_1": 0.5,
                "ndcg_at_1": 1.0,
                "hit_rate_at_3": 1.0,
                "recall_at_3": 1.0,
                "ndcg_at_3": 1.0,
            },
            {
                "provider": "local-hash",
                "latency_ms": 18,
                "candidate_count": 4,
                "mrr": 0.5,
                "hit_rate_at_1": 0.0,
                "recall_at_1": 0.0,
                "ndcg_at_1": 0.0,
                "hit_rate_at_3": 1.0,
                "recall_at_3": 1.0,
                "ndcg_at_3": 0.6309,
            },
        ],
        ks=(1, 3),
    )
    assert metrics["sample_count"] == 2
    assert metrics["mrr"] == 0.75
    assert metrics["hit_rate_at_1"] == 0.5
    assert metrics["recall_at_3"] == 1.0
    assert metrics["provider_counts"]["local-transformer"] == 1
    assert metrics["provider_counts"]["local-hash"] == 1


def test_compute_rewrite_metrics():
    metrics = compute_rewrite_metrics(
        [
            {
                "provider": "local-rule",
                "latency_ms": 15,
                "keyword_coverage": 1.0,
                "exact_bullet_count": 1.0,
                "change_ratio": 0.6,
                "output_chars": 120,
            },
            {
                "provider": "local-llm",
                "latency_ms": 35,
                "keyword_coverage": 0.5,
                "exact_bullet_count": 1.0,
                "change_ratio": 0.8,
                "output_chars": 140,
            },
        ]
    )
    assert metrics["sample_count"] == 2
    assert metrics["keyword_coverage"] == 0.75
    assert metrics["exact_bullet_count_rate"] == 1.0
    assert metrics["provider_counts"]["local-rule"] == 1
    assert metrics["provider_counts"]["local-llm"] == 1


def test_build_experiment_configs_dedupes_normalized_combinations():
    configs = build_experiment_configs(
        inference_modes=["auto", "auto", "local-fallback"],
        embedding_models=["sentence-transformers/all-MiniLM-L6-v2"],
        zero_shot_models=["MoritzLaurer/deberta-v3-base-zeroshot-v1.1-all-33"],
    )
    assert len(configs) == 2
    assert {config["inference_mode"] for config in configs} == {"auto", "local-fallback"}
