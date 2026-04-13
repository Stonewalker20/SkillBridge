"""Tests for evidence ingestion, evidence CRUD, and user skill confirmation flows."""

from bson import ObjectId
import pytest

from app.core.auth import now_utc
from app.routers.evidence import MAX_EVIDENCE_UPLOAD_BYTES


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


def test_evidence_enforces_project_ownership(test_context):
    client = test_context["client"]
    headers = test_context["headers"]
    db = test_context["db"]

    user_oid = ObjectId(test_context["user_id"])
    owned_project_id = ObjectId()
    foreign_project_id = ObjectId()
    now = now_utc()

    db["projects"].docs.extend(
        [
            {
                "_id": owned_project_id,
                "user_id": user_oid,
                "title": "Owned Project",
                "description": "Visible to the authenticated user",
                "start_date": None,
                "end_date": None,
                "tags": [],
                "created_at": now,
                "updated_at": now,
            },
            {
                "_id": foreign_project_id,
                "user_id": ObjectId(),
                "title": "Foreign Project",
                "description": "Belongs to another user",
                "start_date": None,
                "end_date": None,
                "tags": [],
                "created_at": now,
                "updated_at": now,
            },
        ]
    )

    created = client.post(
        "/evidence/",
        headers=headers,
        json={
            "user_id": test_context["user_id"],
            "type": "project",
            "title": "Project-Owned Evidence",
            "source": "manual-entry",
            "text_excerpt": "Built Python ML dashboards with FastAPI APIs.",
            "project_id": str(owned_project_id),
            "origin": "user",
        },
    )
    assert created.status_code == 200
    assert created.json()["project_id"] == str(owned_project_id)

    rejected = client.post(
        "/evidence/",
        headers=headers,
        json={
            "user_id": test_context["user_id"],
            "type": "project",
            "title": "Foreign Project Evidence",
            "source": "manual-entry",
            "text_excerpt": "Built Python ML dashboards with FastAPI APIs.",
            "project_id": str(foreign_project_id),
            "origin": "user",
        },
    )
    assert rejected.status_code == 403

    patched = client.patch(
        f"/evidence/{created.json()['id']}",
        headers=headers,
        json={"project_id": str(foreign_project_id)},
    )
    assert patched.status_code == 403


def test_evidence_analysis_rejects_oversized_uploads(test_context):
    client = test_context["client"]
    headers = test_context["headers"]

    response = client.post(
        "/evidence/analyze",
        headers=headers,
        data={"title": "Large Upload", "type": "project"},
        files={"file": ("large.txt", b"x" * (MAX_EVIDENCE_UPLOAD_BYTES + 1), "text/plain")},
    )

    assert response.status_code == 413


def test_evidence_analysis_strips_citation_sections(test_context):
    client = test_context["client"]
    headers = test_context["headers"]

    response = client.post(
        "/evidence/analyze",
        headers=headers,
        data={
            "title": "Research Project Summary",
            "type": "project",
            "text": (
                "Built Python ML dashboards for internal decision support.\n\n"
                "References\n"
                "[1] Smith, J. (2024). Deep learning systems. Journal of AI, 12(3), 1-9. doi:10.1000/xyz\n"
                "[2] Retrieved from https://example.com/paper"
            ),
        },
    )

    assert response.status_code == 200
    item = response.json()["items"][0]
    assert "Built Python ML dashboards" in item["text_excerpt"]
    assert "References" not in item["text_excerpt"]
    assert "doi:" not in item["text_excerpt"].lower()


def test_link_extraction_blocks_private_hosts_and_caps_remote_fetch_size(monkeypatch):
    from app.utils import link_extraction

    with monkeypatch.context() as m:
        called = False

        def _should_not_fetch(*_args, **_kwargs):
            nonlocal called
            called = True
            raise AssertionError("private hosts should not be fetched")

        m.setattr(link_extraction, "_fetch_html", _should_not_fetch)
        with pytest.raises(link_extraction.LinkExtractionError):
            link_extraction._extract_link_sync("http://127.0.0.1/private")
        assert not called

    class _Headers:
        def __init__(self, content_length: str | None = None):
            self.content_length = content_length

        def get_content_charset(self):
            return "utf-8"

        def get(self, key: str, default=None):
            if key.lower() == "content-length":
                return self.content_length
            return default

    class _Response:
        def __init__(self, body: bytes, *, content_length: str | None = None):
            self.body = body
            self.headers = _Headers(content_length)
            self.read_sizes: list[int] = []

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self, size: int = -1):
            self.read_sizes.append(size)
            return self.body[:size]

    response = _Response(b"<html><title>Example</title>" + b"a" * (link_extraction.MAX_REMOTE_FETCH_BYTES + 128))
    with monkeypatch.context() as m:
        m.setattr(
            link_extraction,
            "build_opener",
            lambda *_handlers: type("FakeOpener", (), {"open": staticmethod(lambda _request, timeout=8: response)})(),
        )
        with pytest.raises(link_extraction.LinkExtractionError):
            link_extraction._fetch_html("https://example.com")
    assert response.read_sizes == [link_extraction.MAX_REMOTE_FETCH_BYTES + 1]


def test_evidence_manual_skill_overrides_are_kept_separate_from_extracted_skills(test_context):
    client = test_context["client"]
    headers = test_context["headers"]

    created = client.post(
        "/evidence/",
        headers=headers,
        json={
            "user_id": test_context["user_id"],
            "type": "project",
            "title": "Manual Skill Override",
            "source": "manual-entry",
            "text_excerpt": "Built Python APIs for analytics delivery.",
            "extracted_skill_ids": [test_context["skill_python"]],
            "manual_skill_ids": [test_context["skill_ml"]],
            "manual_skill_names": ["ML"],
            "origin": "user",
        },
    )
    assert created.status_code == 200
    payload = created.json()
    assert payload["extracted_skill_ids"] == [test_context["skill_python"]]
    assert payload["manual_skill_ids"] == [test_context["skill_ml"]]
    assert payload["manual_skill_names"] == ["ML"]
    assert payload["skill_ids"] == [test_context["skill_python"], test_context["skill_ml"]]

    patched = client.patch(
        f"/evidence/{payload['id']}",
        headers=headers,
        json={"manual_skill_ids": [test_context["skill_python"]], "manual_skill_names": ["Python"]},
    )
    assert patched.status_code == 200
    patched_payload = patched.json()
    assert patched_payload["manual_skill_ids"] == [test_context["skill_python"]]
    assert patched_payload["manual_skill_names"] == ["Python"]


def test_evidence_analyze_and_create_can_derive_text_from_link(test_context, monkeypatch):
    client = test_context["client"]
    headers = test_context["headers"]

    async def _fake_extract_link(_url: str):
        from app.utils.link_extraction import LinkExtractionResult

        return LinkExtractionResult(
            url="https://github.com/example/python-ml-dashboard",
            source_kind="github",
            title="example/python-ml-dashboard",
            description="Python ML dashboard repo",
            text="Python ML dashboard repo with FastAPI services and analytics charts.",
        )

    monkeypatch.setattr("app.routers.evidence.extract_link_evidence_content", _fake_extract_link)

    analysis = client.post(
        "/evidence/analyze",
        headers=headers,
        data={"type": "project", "url": "https://github.com/example/python-ml-dashboard"},
    )
    assert analysis.status_code == 200
    item = analysis.json()["items"][0]
    assert item["title"] == "example/python-ml-dashboard"
    extracted_names = {entry["skill_name"] for entry in item["extracted_skills"]}
    assert {"Python", "ML"} <= extracted_names

    created = client.post(
        "/evidence/",
        headers=headers,
        json={
            "user_id": test_context["user_id"],
            "type": "project",
            "title": "Repo Link",
            "source": "https://github.com/example/python-ml-dashboard",
            "text_excerpt": "",
            "origin": "user",
        },
    )
    assert created.status_code == 200
    payload = created.json()
    assert "FastAPI services" in payload["text_excerpt"]
    assert test_context["skill_python"] in payload["skill_ids"]


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
                "skill_categories_covered": 0,
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
    assert payload["counters"]["resume_snapshots_uploaded"] >= 1
    assert payload["badge_count"] == payload["total_count"]
    assert payload["unlocked_badge_count"] == payload["unlocked_count"] == 2
    achievement = next(item for item in payload["achievements"] if item["key"] == "resume_snapshots_uploaded")
    assert achievement["unlocked"] is True
    assert achievement["current_tier"] == "bronze"
    assert achievement["next_tier"] == "silver"
    badge = next(item for item in payload["badges"] if item["key"] == "resume_snapshots_uploaded")
    assert badge["unlocked"] is True


def test_rewards_summary_exposes_badges_and_counts(test_context):
    client = test_context["client"]
    headers = test_context["headers"]

    response = client.get("/rewards/summary", headers=headers)
    assert response.status_code == 200
    payload = response.json()

    assert payload["badge_count"] == payload["total_count"] == 6
    assert payload["unlocked_badge_count"] == payload["unlocked_count"] == 0
    assert payload["mastered_badge_count"] == 0
    assert payload["tier_step_unlocked_count"] == 0
    assert payload["tier_step_total_count"] == 42
    assert payload["completion_pct"] == 0.0
    assert len(payload["badges"]) == 6
    assert all("reward" in badge for badge in payload["badges"])
    assert all(len(badge["tier_progress"]) == 7 for badge in payload["badges"])


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
    assert payload["total_count"] == 6
    assert isinstance(payload["achievements"], list)
    assert len(payload["achievements"]) == 6


def test_rewards_summary_counts_legacy_evidence_and_profile_confirmation_records(test_context):
    client = test_context["client"]
    headers = test_context["headers"]
    db = test_context["db"]
    user_oid = ObjectId(test_context["user_id"])

    db["evidence"].docs = [
        {
            "_id": ObjectId(),
            "user_id": user_oid,
            "type": "project",
            "title": "Legacy Project Evidence",
            "source": "legacy-import",
            "text_excerpt": "Older evidence row without an origin field.",
            "skill_ids": [ObjectId(test_context["skill_python"])],
            "created_at": now_utc(),
            "updated_at": now_utc(),
        },
        {
            "_id": ObjectId(),
            "user_id": user_oid,
            "type": "resume",
            "title": "Legacy Resume Evidence",
            "source": "legacy-import",
            "text_excerpt": "Older resume evidence row without an origin field.",
            "skill_ids": [ObjectId(test_context["skill_python"])],
            "created_at": now_utc(),
            "updated_at": now_utc(),
        },
    ]
    db["resume_skill_confirmations"].docs = [
        {
            "_id": ObjectId(),
            "user_id": user_oid,
            "resume_snapshot_id": "",
            "confirmed": [
                {"skill_id": ObjectId(test_context["skill_python"]), "skill_name": "Python", "proficiency": 4},
                {"skill_id": ObjectId(test_context["skill_ml"]), "skill_name": "ML", "proficiency": 3},
            ],
            "rejected": [],
            "edited": [],
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
    ]

    response = client.get("/rewards/summary", headers=headers)
    assert response.status_code == 200
    payload = response.json()

    assert payload["counters"]["evidence_saved"] == 2
    assert payload["counters"]["resume_snapshots_uploaded"] >= 1
    assert payload["counters"]["profile_skills_confirmed"] == 2
    assert payload["counters"]["skill_categories_covered"] >= 2


def test_rewards_summary_scales_badge_tiers_up_to_master(test_context):
    client = test_context["client"]
    headers = test_context["headers"]
    db = test_context["db"]
    user_oid = ObjectId(test_context["user_id"])

    db["evidence"].docs = [
        {
            "_id": ObjectId(),
            "user_id": user_oid,
            "type": "project",
            "title": f"Evidence {index}",
            "source": "manual-entry",
            "text_excerpt": "Proof item",
            "skill_ids": [ObjectId(test_context["skill_python"])],
            "origin": "user",
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        for index in range(100)
    ]

    response = client.get("/rewards/summary", headers=headers)
    assert response.status_code == 200
    payload = response.json()

    evidence_badge = next(item for item in payload["badges"] if item["key"] == "evidence_saved")
    assert evidence_badge["current_tier"] == "master"
    assert evidence_badge["next_tier"] is None
    assert evidence_badge["target_value"] == 15
    assert evidence_badge["progress_pct"] == 100.0
    assert payload["completion_pct"] > 0


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
