"""Unit tests for anonymized eval-set export helpers."""

from __future__ import annotations

from bson import ObjectId

from ml_sandbox.eval_export import (
    build_export_bundle,
    build_ranking_samples,
    redact_text,
)


def test_redact_text_scrubs_contact_and_header_pii():
    user = {"email": "jane.student@example.com", "username": "janestudent"}
    text = "\n".join(
        [
            "Jane Student",
            "Detroit, MI",
            "jane.student@example.com | (313) 555-0100 | https://github.com/janestudent",
            "Built Python APIs and analytics dashboards for faculty users.",
        ]
    )

    redacted = redact_text(text, user_doc=user, max_chars=500)

    assert "Jane Student" not in redacted
    assert "jane.student@example.com" not in redacted
    assert "313" not in redacted
    assert "github.com" not in redacted
    assert "Python APIs" in redacted


def test_build_ranking_samples_mixes_positive_and_negative_candidates():
    user_id = ObjectId()
    evidence_id = ObjectId()
    other_evidence_id = ObjectId()
    snapshot_id = ObjectId()
    users = [{"_id": user_id, "email": "tester@example.com", "username": "tester"}]
    evidence_docs = [
        {
            "_id": evidence_id,
            "user_id": user_id,
            "type": "project",
            "text_excerpt": "Built Python APIs and analytics dashboards for internal teams.",
            "created_at": 3,
        },
        {
            "_id": other_evidence_id,
            "user_id": user_id,
            "type": "project",
            "text_excerpt": "Managed campus event logistics and recruiting calendars.",
            "created_at": 2,
        },
    ]
    resume_snapshots = [
        {
            "_id": snapshot_id,
            "user_id": user_id,
            "raw_text": "SUMMARY\nBuilt ML experiments and reporting dashboards.\nEXPERIENCE\nDelivered backend APIs.",
            "created_at": 1,
        }
    ]
    job_match_runs = [
        {
            "_id": ObjectId(),
            "user_id": user_id,
            "job_text_snapshot": "Looking for Python API delivery and analytics dashboard experience in a backend role.",
            "analysis": {
                "retrieved_context": [
                    {
                        "source_type": "evidence",
                        "source_id": str(evidence_id),
                        "snippet": "Built Python APIs and analytics dashboards for internal teams.",
                        "score": 0.92,
                    }
                ]
            },
            "created_at": 4,
        }
    ]

    samples, stats = build_ranking_samples(
        users=users,
        evidence_docs=evidence_docs,
        resume_snapshots=resume_snapshots,
        job_match_runs=job_match_runs,
        tailored_resumes=[],
        anon_salt="secret-salt",
        max_per_user=4,
        negative_count=2,
    )

    assert len(samples) == 1
    assert stats["job_match_candidates"] == 1
    assert any(candidate["label"] == 1 for candidate in samples[0]["candidates"])
    assert any(candidate["label"] == 0 for candidate in samples[0]["candidates"])


def test_build_export_bundle_derives_all_three_task_types():
    user_id = ObjectId()
    skill_python = ObjectId()
    skill_ml = ObjectId()
    evidence_id = ObjectId()
    tailored_id = ObjectId()
    job_id = ObjectId()
    snapshot_id = ObjectId()

    bundle = build_export_bundle(
        users=[{"_id": user_id, "email": "tester@example.com", "username": "tester"}],
        skills=[
            {"_id": skill_python, "name": "Python"},
            {"_id": skill_ml, "name": "Machine Learning"},
        ],
        evidence_docs=[
            {
                "_id": evidence_id,
                "user_id": user_id,
                "type": "project",
                "text_excerpt": "Built Python APIs and ML dashboards for analytics teams.",
                "skill_ids": [skill_python, skill_ml],
                "created_at": 5,
            }
        ],
        resume_snapshots=[
            {
                "_id": snapshot_id,
                "user_id": user_id,
                "source_type": "paste",
                "raw_text": "Jane Student\nSUMMARY\nBuilt backend APIs and ML reporting dashboards.\nEXPERIENCE\nDelivered Python services.",
                "created_at": 4,
            }
        ],
        confirmations=[
            {
                "_id": ObjectId(),
                "user_id": user_id,
                "resume_snapshot_id": snapshot_id,
                "confirmed": [{"skill_id": skill_python}, {"skill_id": skill_ml}],
                "created_at": 4,
            }
        ],
        job_match_runs=[
            {
                "_id": ObjectId(),
                "user_id": user_id,
                "job_text_snapshot": "Seeking Python engineers with machine learning dashboard delivery, API ownership, analytics reporting, and cross-functional execution experience.",
                "analysis": {
                    "retrieved_context": [
                        {
                            "source_type": "evidence",
                            "source_id": str(evidence_id),
                            "snippet": "Built Python APIs and ML dashboards for analytics teams.",
                            "score": 0.88,
                        }
                    ]
                },
                "created_at": 3,
            }
        ],
        tailored_resumes=[
            {
                "_id": tailored_id,
                "user_id": user_id,
                "job_id": job_id,
                "job_text": "Seeking Python engineers with machine learning dashboard delivery, API ownership, analytics reporting, and cross-functional execution experience.",
                "selected_skill_ids": [skill_python, skill_ml],
                "selected_item_ids": [evidence_id],
                "retrieved_context": [],
                "sections": [
                    {"title": "Targeted Highlights", "lines": ["- Built Python APIs for analytics teams.", "- Shipped ML dashboards for internal users."]}
                ],
                "template_source": "user_resume",
                "created_at": 2,
            }
        ],
        job_ingests=[
            {
                "_id": job_id,
                "user_id": user_id,
                "text": "Seeking Python engineers with machine learning dashboard delivery, API ownership, analytics reporting, and cross-functional execution experience.",
                "keywords": ["python", "ml", "dashboard", "api"],
            }
        ],
        anon_salt="secret-salt",
        max_per_user=4,
        negative_count=2,
    )

    assert bundle.manifest["counts"]["extraction_samples"] >= 1
    assert bundle.manifest["counts"]["ranking_samples"] >= 1
    assert bundle.manifest["counts"]["rewrite_samples"] == 1
    assert bundle.rewrite_samples[0]["required_keywords"] == ["Python", "Machine Learning"]
