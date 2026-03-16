"""Tests that validate owner-only admin flows and access control enforcement."""

from bson import ObjectId

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
    assert updated.json()["is_active"] is True

    jobs = client.get("/admin/jobs?status=pending", headers=test_context["headers"])
    assert jobs.status_code == 200

    moderation = client.patch(
        f"/admin/jobs/{job_id}/moderation",
        headers=test_context["headers"],
        json={"moderation_status": "approved", "moderation_reason": None},
    )
    assert moderation.status_code == 200
    assert moderation.json()["moderation_status"] == "approved"


def test_admin_can_deactivate_user_without_deleting_row(test_context):
    client = test_context["client"]
    db = test_context["db"]
    user_id = test_context["user_id"]

    db["users"].docs[0]["role"] = "owner"

    response = client.delete(f"/admin/users/{user_id}", headers=test_context["headers"])
    assert response.status_code == 400

    other_user_id = ObjectId()
    password_parts = {
        "salt": db["users"].docs[0]["password_salt"],
        "hash": db["users"].docs[0]["password_hash"],
    }
    db["users"].docs.append(
        {
            "_id": other_user_id,
            "email": "inactive-me@example.com",
            "username": "inactive-me",
            "password_salt": password_parts["salt"],
            "password_hash": password_parts["hash"],
            "role": "user",
            "is_active": True,
            "created_at": db["users"].docs[0]["created_at"],
        }
    )
    db["sessions"].docs.append(
        {
            "_id": ObjectId(),
            "user_id": other_user_id,
            "token": "other-token",
            "created_at": db["sessions"].docs[0]["created_at"],
            "expires_at": db["sessions"].docs[0]["expires_at"],
        }
    )

    deactivated = client.delete(f"/admin/users/{other_user_id}", headers=test_context["headers"])
    assert deactivated.status_code == 200
    assert deactivated.json() == {"ok": True}

    stored = next(doc for doc in db["users"].docs if doc["_id"] == other_user_id)
    assert stored["is_active"] is False
    assert stored.get("deactivated_at") is not None
    assert any(doc["_id"] == other_user_id for doc in db["users"].docs)
    assert all(sess["user_id"] != other_user_id for sess in db["sessions"].docs)

    users = client.get("/admin/users", headers=test_context["headers"])
    assert users.status_code == 200
    listed = next(item for item in users.json() if item["id"] == str(other_user_id))
    assert listed["is_active"] is False


def test_admin_workspace_blocks_standard_users(test_context):
    client = test_context["client"]
    response = client.get("/admin/summary", headers=test_context["headers"])
    assert response.status_code == 403
