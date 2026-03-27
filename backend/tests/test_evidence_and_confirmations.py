"""Tests for evidence ingestion, evidence CRUD, and user skill confirmation flows."""

from io import BytesIO
from bson import ObjectId

from app.core.auth import now_utc


def test_evidence_skill_matching_resolves_aliases_and_acronyms(test_context):
    client = test_context["client"]
    headers = test_context["headers"]

    response = client.post(
        "/evidence/analyze",
        headers=headers,
        data={"title": "Alias Coverage", "type": "project", "text": "Built machine learning dashboards with Python services."},
    )

    assert response.status_code == 200
    extracted = response.json()["items"][0]["extracted_skills"]
    extracted_names = {skill["skill_name"] for skill in extracted}
    assert "ML" in extracted_names
    assert "Python" in extracted_names


def test_evidence_skill_matching_keeps_short_skill_matching_strict(test_context, monkeypatch):
    client = test_context["client"]
    headers = test_context["headers"]

    async def _fake_extract_skill_candidates(_text: str, max_candidates: int = 25, preferences: dict | None = None):
        return [{"name": "Learning", "category": "General"}], "test-transformer"

    monkeypatch.setattr("app.routers.evidence.extract_skill_candidates", _fake_extract_skill_candidates)

    response = client.post(
        "/evidence/analyze",
        headers=headers,
        data={"title": "Strict Short Skill", "type": "project", "text": "The team focused on learning systems and mentoring."},
    )

    assert response.status_code == 200
    extracted = response.json()["items"][0]["extracted_skills"]
    extracted_names = {skill["skill_name"] for skill in extracted}
    assert "ML" not in extracted_names


def test_evidence_analysis_does_not_invent_short_skill_candidates_without_catalog_match(test_context, monkeypatch):
    client = test_context["client"]
    headers = test_context["headers"]
    db = test_context["db"]

    db["skills"].docs = [doc for doc in db["skills"].docs if doc.get("name") != "ML"]

    async def _fake_extract_skill_candidates(_text: str, max_candidates: int = 25, preferences: dict | None = None):
        return [{"name": "ML", "category": "Data"}], "test-transformer"

    monkeypatch.setattr("app.routers.evidence.extract_skill_candidates", _fake_extract_skill_candidates)

    response = client.post(
        "/evidence/analyze",
        headers=headers,
        data={"title": "Short Candidate", "type": "project", "text": "Built internal dashboards and model evaluation workflows."},
    )

    assert response.status_code == 200
    extracted = response.json()["items"][0]["extracted_skills"]
    extracted_names = {skill["skill_name"] for skill in extracted}
    assert "ML" not in extracted_names


def test_evidence_analysis_and_crud(test_context):
    client = test_context["client"]
    headers = test_context["headers"]
    db = test_context["db"]

    analysis = client.post(
        "/evidence/analyze",
        headers=headers,
        data={"title": "Project Summary", "type": "project", "text": "Built Python ML dashboards with FastAPI APIs."},
    )
    assert analysis.status_code == 200
    extracted = analysis.json()["items"][0]["extracted_skills"]
    assert any(skill["skill_name"] == "Python" for skill in extracted)
    assert all(0.0 <= float(skill.get("confidence", 0.0)) <= 1.0 for skill in extracted)

    created = client.post(
        "/evidence/",
        headers=headers,
        json={
            "user_id": test_context["user_id"],
            "type": "project",
            "title": "Project Summary",
            "source": "manual-entry",
            "text_excerpt": "Built Python ML dashboards with FastAPI APIs.",
            "skill_ids": [test_context["skill_python"], test_context["skill_ml"]],
            "origin": "user",
        },
    )
    assert created.status_code == 200
    evidence_id = created.json()["id"]
    assert any(str(doc.get("source_id")) == evidence_id for doc in db["rag_chunks"].docs)

    listed = client.get("/evidence/", headers=headers)
    assert listed.status_code == 200
    assert any(item["id"] == evidence_id for item in listed.json())

    patched = client.patch(f"/evidence/{evidence_id}", headers=headers, json={"title": "Updated Project Summary"})
    assert patched.status_code == 200
    assert patched.json()["title"] == "Updated Project Summary"
    assert any(doc.get("title") == "Updated Project Summary" for doc in db["rag_chunks"].docs if str(doc.get("source_id")) == evidence_id)

    deleted = client.delete(f"/evidence/{evidence_id}", headers=headers)
    assert deleted.status_code == 200
    assert not any(str(doc.get("source_id")) == evidence_id for doc in db["rag_chunks"].docs)


def test_resume_evidence_unlocks_template_ready_achievement(test_context):
    client = test_context["client"]
    headers = test_context["headers"]
    db = test_context["db"]

    db["user_rewards"].docs = [
        {
            "_id": ObjectId(),
            "user_id": ObjectId(test_context["user_id"]),
            "counters": {
                "evidence_saved": 0,
                "profile_skills_confirmed": 0,
                "resume_snapshots_uploaded": 0,
                "job_matches_run": 0,
                "tailored_resumes_generated": 0,
            },
            "unlocked": [],
            "recent_unlocks": [],
            "updated_at": now_utc(),
        }
    ]

    created = client.post(
        "/evidence/",
        headers=headers,
        json={
            "user_id": test_context["user_id"],
            "type": "resume",
            "title": "Resume Baseline",
            "source": "manual-entry",
            "text_excerpt": "Python machine learning experience with FastAPI services and analytics dashboards.",
            "skill_ids": [test_context["skill_python"], test_context["skill_ml"]],
            "origin": "user",
        },
    )
    assert created.status_code == 200
    assert db["user_rewards"].docs[0]["counters"]["resume_snapshots_uploaded"] == 0

    summary = client.get("/rewards/summary", headers=headers)
    assert summary.status_code == 200
    payload = summary.json()
    assert payload["counters"]["resume_snapshots_uploaded"] == 1
    assert payload["badge_count"] == payload["total_count"]
    assert payload["unlocked_badge_count"] == payload["unlocked_count"] == 2
    achievement = next(item for item in payload["achievements"] if item["key"] == "first_resume_uploaded")
    assert achievement["unlocked"] is True
    badge = next(item for item in payload["badges"] if item["key"] == "first_resume_uploaded")
    assert badge["unlocked"] is True


def test_rewards_summary_exposes_badges_and_counts(test_context):
    client = test_context["client"]
    headers = test_context["headers"]

    response = client.get("/rewards/summary", headers=headers)
    assert response.status_code == 200
    payload = response.json()

    assert payload["badge_count"] == payload["total_count"] == 8
    assert payload["unlocked_badge_count"] == payload["unlocked_count"] == 0
    assert len(payload["badges"]) == 8
    assert all("reward" in badge for badge in payload["badges"])


def test_rewards_summary_tolerates_malformed_stored_reward_doc(test_context):
    client = test_context["client"]
    headers = test_context["headers"]
    db = test_context["db"]

    db["user_rewards"].docs = [
        {
            "_id": ObjectId(),
            "user_id": ObjectId(test_context["user_id"]),
            "counters": ["bad-data"],
            "unlocked": {"not": "a-list"},
            "recent_unlocks": ["also-bad"],
            "updated_at": now_utc(),
        }
    ]

    response = client.get("/rewards/summary", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["total_count"] == 8
    assert isinstance(payload["achievements"], list)
    assert len(payload["achievements"]) == 8


def test_evidence_multi_file_analysis(test_context, monkeypatch):
    client = test_context["client"]
    headers = test_context["headers"]

    monkeypatch.setattr(
        "app.routers.evidence.extract_text_from_upload",
        lambda filename, _raw: (
            "Python ML experience from a PDF report."
            if str(filename).lower().endswith(".pdf")
            else "FastAPI analytics experience from a DOCX file."
        ),
    )

    response = client.post(
        "/evidence/analyze",
        headers=headers,
        data={"title": "Batch Upload", "type": "project", "text": "Built Python dashboards."},
        files=[
            ("files", ("report.pdf", b"%PDF-1.4 fake", "application/pdf")),
            ("files", ("report.docx", b"fake-docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")),
        ],
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["user_id"] == test_context["user_id"]
    assert len(payload["items"]) == 3
    extracted_names = {
        skill["skill_name"]
        for item in payload["items"]
        for skill in item["extracted_skills"]
    }
    assert "Python" in extracted_names
    assert "ML" in extracted_names or "FastAPI" in extracted_names


def test_evidence_confidence_increases_with_repeated_support(test_context):
    client = test_context["client"]
    headers = test_context["headers"]

    low_support = client.post(
        "/evidence/analyze",
        headers=headers,
        data={"title": "Low Support", "type": "project", "text": "Built one Python dashboard."},
    )
    assert low_support.status_code == 200
    low_python = next(
        float(skill["confidence"])
        for skill in low_support.json()["items"][0]["extracted_skills"]
        if skill["skill_name"] == "Python"
    )

    high_support = client.post(
        "/evidence/analyze",
        headers=headers,
        data={"title": "High Support", "type": "project", "text": "Python services, Python dashboards, Python automation, Python APIs."},
    )
    assert high_support.status_code == 200
    high_python = next(
        float(skill["confidence"])
        for skill in high_support.json()["items"][0]["extracted_skills"]
        if skill["skill_name"] == "Python"
    )

    assert high_python > low_python


def test_evidence_analysis_is_rate_limited_per_user(test_context):
    client = test_context["client"]
    headers = test_context["headers"]

    for _ in range(10):
        response = client.post(
            "/evidence/analyze",
            headers=headers,
            data={"title": "Rate Limit Check", "type": "project", "text": "Built Python ML dashboards with FastAPI APIs."},
        )
        assert response.status_code == 200

    limited = client.post(
        "/evidence/analyze",
        headers=headers,
        data={"title": "Rate Limit Check", "type": "project", "text": "Built Python ML dashboards with FastAPI APIs."},
    )
    assert limited.status_code == 429
    assert limited.json()["detail"] == "Rate limit exceeded"


def test_profile_confirmation_routes(test_context):
    client = test_context["client"]
    headers = test_context["headers"]

    upsert = client.post(
        "/skills/confirmations/",
        headers=headers,
        json={
            "resume_snapshot_id": None,
            "confirmed": [{"skill_id": test_context["skill_python"], "proficiency": 3}],
            "rejected": [{"skill_id": test_context["skill_ml"]}],
            "edited": [],
        },
    )
    assert upsert.status_code == 200
    assert upsert.json()["confirmed"][0]["skill_name"] == "Python"

    profile = client.get("/skills/confirmations/profile", headers=headers)
    assert profile.status_code == 200
    assert len(profile.json()["confirmed"]) == 1

    listed = client.get("/skills/confirmations/", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()) >= 1

    confirmed_gaps = client.get("/skills/gaps/confirmed", headers=headers)
    assert confirmed_gaps.status_code == 200
