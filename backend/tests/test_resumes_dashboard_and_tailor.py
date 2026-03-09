"""Integration-style tests for resume ingestion, dashboard aggregation, job match, and tailoring endpoints."""

from io import BytesIO
from bson import ObjectId


def _create_confirmation_and_evidence(client, headers, user_id, skill_python, skill_ml):
    client.post(
        "/skills/confirmations/",
        headers=headers,
        json={
            "resume_snapshot_id": None,
            "confirmed": [
                {"skill_id": skill_python, "proficiency": 4},
                {"skill_id": skill_ml, "proficiency": 3},
            ],
            "rejected": [],
            "edited": [],
        },
    )
    client.post(
        "/evidence/",
        headers=headers,
        json={
            "user_id": user_id,
            "type": "project",
            "title": "Analytics Project",
            "source": "manual-entry",
            "text_excerpt": "Built Python ML dashboards and APIs.",
            "skill_ids": [skill_python, skill_ml],
            "origin": "user",
        },
    )
    client.post(
        "/portfolio/items",
        headers=headers,
        json={
            "user_id": user_id,
            "type": "project",
            "title": "Analytics Platform",
            "summary": "Built internal analytics systems.",
            "bullets": ["Delivered Python and ML workflows."],
            "skill_ids": [skill_python, skill_ml],
            "visibility": "private",
            "priority": 2,
        },
    )


def test_resume_ingest_promote_dashboard_and_tailor_endpoints(test_context, monkeypatch):
    client = test_context["client"]
    headers = test_context["headers"]
    user_id = test_context["user_id"]
    skill_python = test_context["skill_python"]
    skill_ml = test_context["skill_ml"]

    monkeypatch.setattr("app.routers.resumes.extract_pdf_text", lambda _bytes: "Python ML FastAPI " * 10)

    text_ingest = client.post(
        "/ingest/resume/text",
        headers=headers,
        json={
            "user_id": user_id,
            "text": "\n".join(
                [
                    "Tester Example",
                    "SUMMARY",
                    "Python and ML developer.",
                    "EXPERIENCE",
                    "Capstone Project",
                    "- Built Python ML dashboards.",
                    "- Delivered FastAPI APIs.",
                    "EDUCATION",
                    "BS Computer Science",
                ]
            ),
        },
    )
    assert text_ingest.status_code == 200
    snapshot_id = text_ingest.json()["snapshot_id"]
    assert any(
        str(doc.get("source_id")) == snapshot_id and doc.get("source_type") == "resume_snapshot"
        for doc in test_context["db"]["rag_chunks"].docs
    )

    pdf_ingest = client.post(
        "/ingest/resume/pdf",
        headers=headers,
        files={"file": ("resume.pdf", b"%PDF-1.4 fake", "application/pdf")},
        data={"user_id": user_id},
    )
    assert pdf_ingest.status_code == 200

    client.post(
        "/skills/confirmations/",
        headers=headers,
        json={"resume_snapshot_id": snapshot_id, "confirmed": [{"skill_id": skill_python, "proficiency": 4}], "rejected": [], "edited": []},
    )

    promoted = client.post(f"/ingest/resume/{snapshot_id}/promote", headers=headers, data={"user_id": user_id})
    assert promoted.status_code == 200

    _create_confirmation_and_evidence(client, headers, user_id, skill_python, skill_ml)

    summary = client.get("/dashboard/summary", headers=headers)
    assert summary.status_code == 200
    assert summary.json()["totals"]["confirmed_skills"] >= 1
    assert "portfolio_to_job_analytics" in summary.json()
    assert "portfolio_type_distribution" in summary.json()
    assert "recent_match_trend" in summary.json()

    ingest = client.post(
        "/tailor/job/ingest",
        headers=headers,
        json={
            "user_id": user_id,
            "title": "ML Engineer",
            "company": "Acme",
            "location": "Remote",
            "text": "We need Python, ML, FastAPI, APIs, and analytics experience. Responsibilities include dashboards and model delivery." * 2,
        },
    )
    assert ingest.status_code == 200
    job_id = ingest.json()["id"]

    match = client.post("/tailor/match", headers=headers, json={"user_id": user_id, "job_id": job_id})
    assert match.status_code == 200
    history_id = match.json()["history_id"]
    assert "gap_reasoning_summary" in match.json()
    assert "gap_insights" in match.json()
    assert "personal_skill_vector_score" in match.json()
    assert any(item["label"] == "Personal skill vector" for item in match.json()["score_breakdown"])

    user_vector = client.get("/tailor/user-vector", headers=headers)
    assert user_vector.status_code == 200
    assert user_vector.json()["embedding_dimensions"] > 0

    vector_history = client.get("/tailor/user-vector/history", headers=headers)
    assert vector_history.status_code == 200
    assert vector_history.json()

    refreshed_summary = client.get("/dashboard/summary", headers=headers)
    assert refreshed_summary.status_code == 200
    dashboard_payload = refreshed_summary.json()
    assert isinstance(dashboard_payload["portfolio_to_job_analytics"]["matched_skill_rate_pct"], float)
    assert dashboard_payload["portfolio_to_job_analytics"]["matched_skill_rate_pct"] > 0
    assert dashboard_payload["recent_match_trend"]

    # Older saved runs may have counts persisted without the full matched_skill_ids array.
    # The dashboard metric should still be driven by the stored counts in that case.
    job_match_docs = test_context["db"]["job_match_runs"].docs
    assert job_match_docs
    job_match_docs[0]["analysis"]["matched_skill_ids"] = []

    fallback_summary = client.get("/dashboard/summary", headers=headers)
    assert fallback_summary.status_code == 200
    assert fallback_summary.json()["portfolio_to_job_analytics"]["matched_skill_rate_pct"] > 0

    preview = client.post("/tailor/preview", headers=headers, json={"user_id": user_id, "job_id": job_id, "resume_snapshot_id": snapshot_id})
    assert preview.status_code == 200
    tailored_id = preview.json()["id"]
    assert preview.json()["retrieved_context"]

    rag_search = client.get("/tailor/rag/search", headers=headers, params={"q": "Python ML dashboards", "limit": 3})
    assert rag_search.status_code == 200
    assert rag_search.json()

    resumes = client.get("/tailor/resumes", headers=headers, params={"user_id": user_id})
    assert resumes.status_code == 200
    assert any(item["id"] == tailored_id for item in resumes.json())

    resume_detail = client.get(f"/tailor/resumes/{tailored_id}", headers=headers, params={"user_id": user_id})
    assert resume_detail.status_code == 200

    history = client.get("/tailor/history", headers=headers, params={"user_id": user_id})
    assert history.status_code == 200
    assert any(item["id"] == history_id for item in history.json())

    history_detail = client.get(f"/tailor/history/{history_id}", headers=headers, params={"user_id": user_id})
    assert history_detail.status_code == 200

    compare = client.get("/tailor/history/compare", headers=headers, params={"user_id": user_id, "left_id": history_id, "right_id": history_id})
    assert compare.status_code == 200

    settings = client.get("/tailor/settings/status")
    assert settings.status_code == 200
    assert settings.json()["provider_mode"] == "test"

    rewrite = client.post(f"/tailor/{tailored_id}/rewrite", json={"focus": "ats"})
    assert rewrite.status_code == 200

    docx = client.get(f"/tailor/{tailored_id}/export/docx")
    assert docx.status_code == 200

    pdf = client.get(f"/tailor/{tailored_id}/export/pdf")
    assert pdf.status_code == 200

    delete_history = client.delete(f"/tailor/history/{history_id}", headers=headers, params={"user_id": user_id})
    assert delete_history.status_code == 200

    delete_resume = client.delete(f"/tailor/resumes/{tailored_id}", headers=headers, params={"user_id": user_id})
    assert delete_resume.status_code == 200


def test_tailored_resume_uses_user_resume_template_and_ai_preferences(test_context):
    client = test_context["client"]
    headers = test_context["headers"]
    user_id = test_context["user_id"]
    db = test_context["db"]

    resume_text = "\n".join(
        [
            "Jane Student",
            "SUMMARY",
            "Builder focused on analytics systems and ML delivery.",
            "SKILLS",
            "Python, SQL, Communication",
            "EXPERIENCE",
            "Capstone Research Assistant",
            "- Built internal dashboards for faculty.",
            "EDUCATION",
            "BS Computer Science",
        ]
    )
    ingest = client.post("/ingest/resume/text", headers=headers, json={"user_id": user_id, "text": resume_text})
    assert ingest.status_code == 200
    snapshot_id = ingest.json()["snapshot_id"]

    client.post(
        "/skills/confirmations/",
        headers=headers,
        json={
            "resume_snapshot_id": None,
            "confirmed": [
                {"skill_id": test_context["skill_python"], "proficiency": 4},
                {"skill_id": test_context["skill_ml"], "proficiency": 3},
            ],
            "rejected": [],
            "edited": [],
        },
    )
    client.post(
        "/evidence/",
        headers=headers,
        json={
            "user_id": user_id,
            "type": "project",
            "title": "ML Dashboard",
            "source": "manual-entry",
            "text_excerpt": "Built Python ML dashboard APIs and shipped analytics views.",
            "skill_ids": [test_context["skill_python"], test_context["skill_ml"]],
            "origin": "user",
        },
    )

    ai_settings = client.get("/tailor/settings/preferences", headers=headers)
    assert ai_settings.status_code == 200
    assert ai_settings.json()["preferences"]["inference_mode"]

    patched = client.patch(
        "/tailor/settings/preferences",
        headers=headers,
        json={
          "inference_mode": "local-fallback",
          "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
          "zero_shot_model": "MoritzLaurer/deberta-v3-base-zeroshot-v1.1-all-33",
        },
    )
    assert patched.status_code == 200
    assert patched.json()["preferences"]["inference_mode"] == "local-fallback"

    job = client.post(
        "/tailor/job/ingest",
        headers=headers,
        json={
            "user_id": user_id,
            "title": "Analytics Engineer",
            "company": "SkillBridge",
            "location": "Remote",
            "text": "Looking for Python, ML, dashboard, analytics, and API delivery experience for a product analytics role." * 2,
        },
    )
    assert job.status_code == 200
    job_id = job.json()["id"]

    preview = client.post(
        "/tailor/preview",
        headers=headers,
        json={"user_id": user_id, "job_id": job_id, "resume_snapshot_id": snapshot_id},
    )
    assert preview.status_code == 200
    payload = preview.json()
    assert payload["resume_snapshot_id"] == snapshot_id
    assert payload["template_source"] == "user_resume"
    assert payload["retrieved_context"]
    section_titles = [section["title"] for section in payload["sections"]]
    assert "Summary" in section_titles
    assert "Education" in section_titles
    assert any(section["title"] == "Targeted Highlights" for section in payload["sections"])
    summary_section = next(section for section in payload["sections"] if section["title"] == "Summary")
    assert any("Analytics Engineer at SkillBridge" in line for line in summary_section["lines"])

    stored_resume = next(doc for doc in db["tailored_resumes"].docs if str(doc["_id"]) == payload["id"])
    assert str(stored_resume["resume_snapshot_id"]) == snapshot_id
    assert stored_resume["template_source"] == "user_resume"


def test_job_match_required_coverage_and_missing_skills_are_populated(test_context):
    client = test_context["client"]
    headers = test_context["headers"]
    user_id = test_context["user_id"]
    skill_python = test_context["skill_python"]

    client.post(
        "/skills/confirmations/",
        headers=headers,
        json={
            "resume_snapshot_id": None,
            "confirmed": [{"skill_id": skill_python, "proficiency": 4}],
            "rejected": [],
            "edited": [],
        },
    )

    ingest = client.post(
        "/tailor/job/ingest",
        headers=headers,
        json={
            "user_id": user_id,
            "title": "ML Engineer",
            "company": "Acme",
            "location": "Remote",
            "text": "\n".join(
                [
                    "Required Qualifications:",
                    "- Python",
                    "- Machine Learning",
                    "Responsibilities:",
                    "- Build analytics dashboards and deliver APIs",
                ]
            ),
        },
    )
    assert ingest.status_code == 200

    match = client.post("/tailor/match", headers=headers, json={"user_id": user_id, "job_id": ingest.json()["id"]})
    assert match.status_code == 200
    payload = match.json()

    assert payload["required_skill_count"] == 2
    assert payload["required_matched_count"] == 1
    assert payload["matched_skill_count"] == 1
    assert payload["missing_skill_count"] == 1
    assert "Python" in payload["matched_skills"]
    assert "ML" in payload["missing_skills"]


def test_job_match_falls_back_to_extracted_skills_when_required_section_is_not_detected(test_context):
    client = test_context["client"]
    headers = test_context["headers"]
    user_id = test_context["user_id"]
    skill_python = test_context["skill_python"]

    client.post(
        "/skills/confirmations/",
        headers=headers,
        json={
            "resume_snapshot_id": None,
            "confirmed": [{"skill_id": skill_python, "proficiency": 4}],
            "rejected": [],
            "edited": [],
        },
    )

    ingest = client.post(
        "/tailor/job/ingest",
        headers=headers,
        json={
            "user_id": user_id,
            "title": "Analytics Engineer",
            "company": "Acme",
            "location": "Remote",
            "text": "We are looking for Python and Machine Learning experience to build analytics dashboards and APIs.",
        },
    )
    assert ingest.status_code == 200

    match = client.post("/tailor/match", headers=headers, json={"user_id": user_id, "job_id": ingest.json()["id"]})
    assert match.status_code == 200
    payload = match.json()

    assert payload["extracted_skill_count"] == 2
    assert payload["required_skill_count"] == 2
    assert payload["required_matched_count"] == 1
    assert payload["matched_skill_count"] == 1
    assert payload["missing_skill_count"] == 1


def test_reanalyze_recomputes_job_skills_from_saved_job_text(test_context):
    client = test_context["client"]
    headers = test_context["headers"]
    user_id = test_context["user_id"]
    skill_python = test_context["skill_python"]
    skill_ml = test_context["skill_ml"]
    db = test_context["db"]

    client.post(
        "/skills/confirmations/",
        headers=headers,
        json={
            "resume_snapshot_id": None,
            "confirmed": [
                {"skill_id": skill_python, "proficiency": 4},
                {"skill_id": skill_ml, "proficiency": 3},
            ],
            "rejected": [],
            "edited": [],
        },
    )

    ingest = client.post(
        "/tailor/job/ingest",
        headers=headers,
        json={
            "user_id": user_id,
            "title": "ML Engineer",
            "company": "Acme",
            "location": "Remote",
            "text": "Required skills: Python and Machine Learning. Responsibilities include analytics dashboards and API delivery.",
        },
    )
    assert ingest.status_code == 200
    job_id = ingest.json()["id"]

    job_doc = next(doc for doc in db["job_ingests"].docs if str(doc["_id"]) == job_id)
    job_doc["extracted_skills"] = [{"skill_id": skill_ml, "skill_name": "ML", "matched_on": "alias", "count": 1}]
    job_doc["keywords"] = ["ml"]

    match = client.post("/tailor/match", headers=headers, json={"user_id": user_id, "job_id": job_id})
    assert match.status_code == 200
    payload = match.json()

    assert payload["extracted_skill_count"] >= 2
    assert "Python" in payload["matched_skills"]
    assert "ML" in payload["matched_skills"]


def test_reanalyze_dedupes_alias_equivalent_job_skills(test_context):
    client = test_context["client"]
    headers = test_context["headers"]
    user_id = test_context["user_id"]
    skill_ml = test_context["skill_ml"]
    db = test_context["db"]

    machine_learning_skill_id = "507f1f77bcf86cd799439099"
    db["skills"].docs.append(
        {
            "_id": ObjectId(machine_learning_skill_id),
            "name": "Machine Learning",
            "category": "Data",
            "categories": ["Data"],
            "aliases": ["ML"],
            "tags": ["ai"],
            "origin": "default",
            "hidden": False,
            "created_at": db["skills"].docs[0]["created_at"],
            "updated_at": db["skills"].docs[0]["updated_at"],
        }
    )

    client.post(
        "/skills/confirmations/",
        headers=headers,
        json={
            "resume_snapshot_id": None,
            "confirmed": [{"skill_id": skill_ml, "proficiency": 3}],
            "rejected": [],
            "edited": [],
        },
    )

    ingest = client.post(
        "/tailor/job/ingest",
        headers=headers,
        json={
            "user_id": user_id,
            "title": "ML Engineer",
            "company": "Acme",
            "location": "Remote",
            "text": "Required skills: Machine Learning and ML. The role also includes model delivery, experimentation, and analytics communication.",
        },
    )
    assert ingest.status_code == 200

    match = client.post("/tailor/match", headers=headers, json={"user_id": user_id, "job_id": ingest.json()["id"]})
    assert match.status_code == 200
    payload = match.json()

    assert payload["matched_skill_count"] == 1
    assert payload["missing_skill_count"] == 0
    assert payload["required_skill_count"] == 1
