def test_jobs_roles_projects_and_portfolio_endpoints(test_context):
    client = test_context["client"]
    user_id = test_context["user_id"]

    project = client.post("/projects/", json={"user_id": user_id, "title": "Capstone", "description": "ML project", "tags": ["ml"]})
    assert project.status_code == 200
    project_id = project.json()["id"]

    listed_projects = client.get("/projects/", params={"user_id": user_id})
    assert listed_projects.status_code == 200
    assert any(item["id"] == project_id for item in listed_projects.json())

    linked = client.post(f"/projects/{project_id}/skills", json={"skill_id": test_context["skill_python"]})
    assert linked.status_code == 200

    project_skills = client.get(f"/projects/{project_id}/skills")
    assert project_skills.status_code == 200
    assert len(project_skills.json()) == 1

    portfolio = client.post(
        "/portfolio/items",
        json={
            "user_id": user_id,
            "type": "project",
            "title": "Portfolio Item",
            "summary": "Used Python for analytics",
            "skill_ids": [test_context["skill_python"]],
            "visibility": "private",
            "priority": 2,
        },
    )
    assert portfolio.status_code == 200
    portfolio_id = portfolio.json()["id"]

    portfolio_list = client.get("/portfolio/items", params={"user_id": user_id})
    assert portfolio_list.status_code == 200
    assert any(item["id"] == portfolio_id for item in portfolio_list.json())

    portfolio_patch = client.patch(f"/portfolio/items/{portfolio_id}", json={"title": "Updated Portfolio Item"})
    assert portfolio_patch.status_code == 200
    assert portfolio_patch.json()["title"] == "Updated Portfolio Item"

    role_list = client.get("/roles/")
    assert role_list.status_code == 200
    assert role_list.json()

    new_role = client.post("/roles/", json={"name": "Backend Engineer", "description": "APIs"})
    assert new_role.status_code == 200
    role_id = new_role.json()["id"]

    job_submit = client.post(
        "/jobs/submit",
        json={
            "title": "ML Engineer",
            "company": "Acme",
            "location": "Remote",
            "source": "board",
            "description_excerpt": "Python ML role",
            "required_skills": ["Python", "ML"],
            "required_skill_ids": [test_context["skill_python"], test_context["skill_ml"]],
            "role_ids": [],
        },
    )
    assert job_submit.status_code == 200
    job_id = job_submit.json()["id"]

    moderated = client.patch(f"/jobs/{job_id}/moderate", json={"moderation_status": "approved", "moderation_reason": None})
    assert moderated.status_code == 200

    tagged = client.post(f"/jobs/{job_id}/roles", json={"role_id": role_id})
    assert tagged.status_code == 200

    weights = client.post(f"/roles/{role_id}/compute_weights")
    assert weights.status_code == 200

    role_weights = client.get(f"/roles/{role_id}/weights")
    assert role_weights.status_code == 200

    portfolio_delete = client.delete(f"/portfolio/items/{portfolio_id}")
    assert portfolio_delete.status_code == 200
