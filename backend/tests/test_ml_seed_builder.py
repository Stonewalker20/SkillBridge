"""Tests for synthetic ML sandbox seed data construction."""

from __future__ import annotations

from ml_sandbox.seed_builder import (
    EvidenceSeed,
    JobSeed,
    ResumeSeed,
    SeedSources,
    SkillSeed,
    build_seed_documents,
)


def test_build_seed_documents_populates_expected_collections():
    sources = SeedSources(
        skills=(
            SkillSeed(name="Python", category="Programming", aliases=("py",)),
            SkillSeed(name="FastAPI", category="Backend", aliases=("fast api",)),
            SkillSeed(name="SQL", category="Data", aliases=()),
        ),
        evidence=(
            EvidenceSeed(
                user_key="student1@example.com",
                user_email="student1@example.com",
                type="project",
                title="API Project",
                source="seed",
                text_excerpt="Built Python FastAPI services for internal tooling.",
                tags=("Python", "FastAPI"),
            ),
        ),
        resumes=(
            ResumeSeed(
                raw_text="SUMMARY\nBuilt Python APIs and wrote SQL queries for analytics dashboards.\nEXPERIENCE\nUsed FastAPI for backend services.",
                category="Software Engineer",
                source="resume-seed",
            ),
        ),
        jobs=(
            JobSeed(
                title="Backend Engineer",
                company="Seed Co",
                location="Remote",
                source="seed",
                description_excerpt="Build backend APIs, support data workflows, and collaborate with engineering stakeholders.",
                required_skills=("Python", "FastAPI"),
            ),
        ),
        manifest={"seed_dir": "test", "loaded_counts": {}, "source_breakdown": {}},
    )

    docs = build_seed_documents(sources, seed_namespace="test-seed", max_jobs_per_user=1)

    assert len(docs["users"]) == 2
    assert len(docs["skills"]) == 3
    assert len(docs["evidence"]) >= 2
    assert len(docs["resume_snapshots"]) >= 1
    assert len(docs["resume_skill_confirmations"]) >= 1
    assert len(docs["job_ingests"]) == len(docs["users"])
    assert len(docs["job_match_runs"]) == len(docs["users"])
    assert len(docs["tailored_resumes"]) == len(docs["users"])
    assert docs["manifest"]["counts"]["users"] == 2


def test_build_seed_documents_tags_all_seeded_docs_with_namespace():
    sources = SeedSources(
        skills=(SkillSeed(name="Python", category="Programming", aliases=()),),
        evidence=(),
        resumes=(),
        jobs=(),
        manifest={"seed_dir": "test", "loaded_counts": {}, "source_breakdown": {}},
    )

    docs = build_seed_documents(sources, seed_namespace="namespace-check", max_jobs_per_user=1)

    for collection_name, rows in docs.items():
        if collection_name == "manifest":
            continue
        for row in rows:
            assert row["seed_namespace"] == "namespace-check"
