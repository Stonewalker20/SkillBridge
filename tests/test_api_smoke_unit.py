import uuid


def test_health_endpoints(client):
    r = client.get("/health/")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

    r = client.get("/health/db_counts")
    assert r.status_code == 200
    assert set(r.json().keys()) >= {"skills", "resume_snapshots", "evidence", "jobs"}


def test_skills_crud(client, auth_headers):
    r = client.post("/skills/", headers=auth_headers, json={"name": "Python", "category": "language", "aliases": ["py"], "tags": []})
    assert r.status_code == 200, r.text
    sid = r.json()["id"]

    r = client.get("/skills/", headers=auth_headers)
    assert r.status_code == 200
    assert any(s["id"] == sid for s in r.json())

    r = client.patch(f"/skills/{sid}", headers=auth_headers, json={"name": "Python 3"})
    assert r.status_code == 200
    assert r.json()["name"] == "Python 3"

    r = client.delete(f"/skills/{sid}", headers=auth_headers)
    assert r.status_code == 200


def test_resume_ingest_text_and_extract(client, auth_headers, user_id):
    r = client.post(
        "/ingest/resume/text",
        headers=auth_headers,
        json={"user_id": user_id, "text": "I used Python and FastAPI to build internal analytics APIs and dashboards for the product team."},
    )
    assert r.status_code == 200, r.text
    snapshot_id = r.json()["snapshot_id"]

    r = client.post(f"/skills/extract/skills/{snapshot_id}", headers=auth_headers)
    assert r.status_code in (200, 404), r.text


def test_confirmations_roundtrip(client, auth_headers, user_id):
    skill = client.post(
        "/skills/",
        headers=auth_headers,
        json={"name": f"Python-{uuid.uuid4().hex[:6]}", "category": "language", "aliases": ["py"], "tags": []},
    )
    assert skill.status_code == 200, skill.text
    skill_id = skill.json()["id"]

    snap = client.post(
        "/ingest/resume/text",
        headers=auth_headers,
        json={"user_id": user_id, "text": "I used Python to build internal APIs and analytics pipelines for several semester projects."},
    ).json()

    payload = {
        "user_id": user_id,
        "resume_snapshot_id": snap["snapshot_id"],
        "confirmed": [{"skill_id": skill_id, "skill_name": "Python", "proficiency": 3}],
        "rejected": [],
        "edited": [],
    }
    r = client.post("/skills/confirmations/", headers=auth_headers, json=payload)
    assert r.status_code in (200, 201), r.text

    r = client.get("/skills/confirmations/", headers=auth_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_jobs_projects_roles_taxonomy_evidence_portfolio_smoke(client, auth_headers, user_id):
    # Role
    r = client.post("/roles/", json={"name": "ML Engineer", "description": ""})
    assert r.status_code == 200
    role_id = r.json()["id"]
    assert client.get("/roles/").status_code == 200

    # Skill for linking
    s = client.post("/skills/", headers=auth_headers, json={"name": "FastAPI", "category": "tool", "aliases": [], "tags": []}).json()

    # Taxonomy aliases + relation
    assert client.put(f"/taxonomy/aliases/{s['id']}", headers=auth_headers, json={"aliases": ["fast api"]}).status_code in (200, 204)
    rel = client.post("/taxonomy/relations", headers=auth_headers, json={"from_skill_id": s["id"], "to_skill_id": s["id"], "relation_type": "related_to"})
    assert rel.status_code == 200
    assert client.get("/taxonomy/relations", headers=auth_headers).status_code == 200

    # Job
    j = client.post(
        "/jobs/",
        headers=auth_headers,
        json={
            "title": "ML Engineer",
            "company": "ACME",
            "location": "Remote",
            "source": "manual",
            "description_excerpt": "...",
            "required_skills": ["FastAPI"],
            "required_skill_ids": [s["id"]],
            "role_ids": [role_id],
        },
    )
    assert j.status_code == 200, j.text
    job_id = j.json()["id"]
    assert client.get("/jobs/").status_code == 200
    assert client.patch(f"/jobs/{job_id}/moderate", headers=auth_headers, json={"moderation_status": "approved"}).status_code == 200
    assert client.post(f"/jobs/{job_id}/roles", headers=auth_headers, json={"role_id": role_id}).status_code == 200

    # Project
    p = client.post("/projects/", headers=auth_headers, json={"user_id": user_id, "title": "Capstone", "description": ""})
    assert p.status_code == 200
    pid = p.json()["id"]
    assert client.get(f"/projects/{pid}", headers=auth_headers).status_code == 200
    assert client.post(f"/projects/{pid}/skills", headers=auth_headers, json={"skill_id": s["id"]}).status_code == 200
    assert client.get(f"/projects/{pid}/skills", headers=auth_headers).status_code == 200

    # Evidence
    ev = client.post(
        "/evidence/",
        headers=auth_headers,
        json={
            "user_id": user_id,
            "type": "project",
            "title": "Capstone",
            "source": "repo",
            "text_excerpt": "...",
            "skill_ids": [s["id"]],
            "project_id": pid,
        },
    )
    assert ev.status_code == 200
    assert client.get("/evidence/", headers=auth_headers).status_code == 200

    # Portfolio
    item = client.post(
        "/portfolio/items",
        headers=auth_headers,
        json={
            "user_id": user_id,
            "type": "project",
            "title": "SkillBridge",
            "bullets": ["Built FastAPI backend"],
            "skill_ids": [s["id"]],
        },
    )
    assert item.status_code == 200
    iid = item.json()["id"]
    assert client.get("/portfolio/items", headers=auth_headers).status_code == 200
    assert client.patch(f"/portfolio/items/{iid}", headers=auth_headers, json={"title": "SkillBridge v2"}).status_code == 200
    assert client.delete(f"/portfolio/items/{iid}", headers=auth_headers).status_code == 200


def test_tailor_ingest_and_preview_smoke(client, auth_headers, user_id):
    # Seed a skill that can match
    client.post("/skills/", headers=auth_headers, json={"name": "Python", "category": "language", "aliases": ["py"], "tags": []})

    # Create a portfolio item that can be selected
    client.post(
        "/portfolio/items",
        headers=auth_headers,
        json={
            "user_id": user_id,
            "type": "project",
            "title": "SkillBridge",
            "summary": "Built a FastAPI backend in Python",
            "skill_ids": [],
            "bullets": ["Python FastAPI"],
            "priority": 1,
        },
    )

    ingest = client.post(
        "/tailor/job/ingest",
        headers=auth_headers,
        json={"user_id": user_id, "title": "ML", "company": "ACME", "location": "Remote", "text": "Python " + ("x" * 60)},
    )
    assert ingest.status_code == 200, ingest.text
    job_id = ingest.json()["id"]

    preview = client.post("/tailor/preview", headers=auth_headers, json={"user_id": user_id, "job_id": job_id})
    assert preview.status_code == 200, preview.text
    assert "plain_text" in preview.json()
