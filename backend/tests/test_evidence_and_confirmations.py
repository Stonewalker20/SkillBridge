from io import BytesIO


def test_evidence_analysis_and_crud(test_context):
    client = test_context["client"]
    headers = test_context["headers"]

    analysis = client.post(
        "/evidence/analyze",
        headers=headers,
        data={"title": "Project Summary", "type": "project", "text": "Built Python ML dashboards with FastAPI APIs."},
    )
    assert analysis.status_code == 200
    extracted = analysis.json()["items"][0]["extracted_skills"]
    assert any(skill["skill_name"] == "Python" for skill in extracted)

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

    listed = client.get("/evidence/", headers=headers)
    assert listed.status_code == 200
    assert any(item["id"] == evidence_id for item in listed.json())

    patched = client.patch(f"/evidence/{evidence_id}", headers=headers, json={"title": "Updated Project Summary"})
    assert patched.status_code == 200
    assert patched.json()["title"] == "Updated Project Summary"

    deleted = client.delete(f"/evidence/{evidence_id}", headers=headers)
    assert deleted.status_code == 200


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
