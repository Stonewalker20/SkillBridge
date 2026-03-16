"""Tests for evidence ingestion, evidence CRUD, and user skill confirmation flows."""

from io import BytesIO


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
