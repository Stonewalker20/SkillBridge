from io import BytesIO


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

    ingest = client.post(
        "/tailor/job/ingest",
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

    match = client.post("/tailor/match", json={"user_id": user_id, "job_id": job_id})
    assert match.status_code == 200
    history_id = match.json()["history_id"]

    preview = client.post("/tailor/preview", json={"user_id": user_id, "job_id": job_id, "resume_snapshot_id": snapshot_id})
    assert preview.status_code == 200
    tailored_id = preview.json()["id"]
    assert preview.json()["retrieved_context"]

    rag_search = client.get("/tailor/rag/search", headers=headers, params={"q": "Python ML dashboards", "limit": 3})
    assert rag_search.status_code == 200
    assert rag_search.json()

    resumes = client.get("/tailor/resumes", params={"user_id": user_id})
    assert resumes.status_code == 200
    assert any(item["id"] == tailored_id for item in resumes.json())

    resume_detail = client.get(f"/tailor/resumes/{tailored_id}", params={"user_id": user_id})
    assert resume_detail.status_code == 200

    history = client.get("/tailor/history", params={"user_id": user_id})
    assert history.status_code == 200
    assert any(item["id"] == history_id for item in history.json())

    history_detail = client.get(f"/tailor/history/{history_id}", params={"user_id": user_id})
    assert history_detail.status_code == 200

    compare = client.get("/tailor/history/compare", params={"user_id": user_id, "left_id": history_id, "right_id": history_id})
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

    delete_history = client.delete(f"/tailor/history/{history_id}", params={"user_id": user_id})
    assert delete_history.status_code == 200

    delete_resume = client.delete(f"/tailor/resumes/{tailored_id}", params={"user_id": user_id})
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
