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

    text_ingest = client.post("/ingest/resume/text", json={"user_id": user_id, "text": "Python ML resume text " * 10})
    assert text_ingest.status_code == 200
    snapshot_id = text_ingest.json()["snapshot_id"]

    pdf_ingest = client.post(
        "/ingest/resume/pdf",
        files={"file": ("resume.pdf", b"%PDF-1.4 fake", "application/pdf")},
        data={"user_id": user_id},
    )
    assert pdf_ingest.status_code == 200

    client.post(
        "/skills/confirmations/",
        headers=headers,
        json={"resume_snapshot_id": snapshot_id, "confirmed": [{"skill_id": skill_python, "proficiency": 4}], "rejected": [], "edited": []},
    )

    promoted = client.post(f"/ingest/resume/{snapshot_id}/promote", data={"user_id": user_id})
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

    preview = client.post("/tailor/preview", json={"user_id": user_id, "job_id": job_id})
    assert preview.status_code == 200
    tailored_id = preview.json()["id"]

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
