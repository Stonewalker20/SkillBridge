def test_admin_workspace_endpoints(test_context):
    client = test_context["client"]
    db = test_context["db"]
    user_id = test_context["user_id"]

    db["users"].docs[0]["role"] = "owner"
    job_id = db["jobs"].docs[0]["_id"] if db["jobs"].docs else None
    if job_id is None:
        inserted = client.post(
            "/jobs/submit",
            json={
                "title": "Pending Role",
                "company": "Acme",
                "location": "Remote",
                "source": "board",
                "description_excerpt": "Python ML role",
                "required_skills": ["Python"],
                "required_skill_ids": [test_context["skill_python"]],
                "role_ids": [],
            },
        )
        assert inserted.status_code == 200
        job_id = inserted.json()["id"]
    else:
        job_id = str(job_id)

    summary = client.get("/admin/summary", headers=test_context["headers"])
    assert summary.status_code == 200
    assert summary.json()["total_users"] >= 1

    users = client.get("/admin/users", headers=test_context["headers"])
    assert users.status_code == 200
    assert users.json()[0]["role"] == "owner"

    updated = client.patch(f"/admin/users/{user_id}", headers=test_context["headers"], json={"role": "owner"})
    assert updated.status_code == 200

    jobs = client.get("/admin/jobs?status=pending", headers=test_context["headers"])
    assert jobs.status_code == 200

    moderation = client.patch(
        f"/admin/jobs/{job_id}/moderation",
        headers=test_context["headers"],
        json={"moderation_status": "approved", "moderation_reason": None},
    )
    assert moderation.status_code == 200
    assert moderation.json()["moderation_status"] == "approved"


def test_admin_workspace_blocks_standard_users(test_context):
    client = test_context["client"]
    response = client.get("/admin/summary", headers=test_context["headers"])
    assert response.status_code == 403
