"""Tests that validate owner-only admin flows and access control enforcement."""

from datetime import datetime, timezone

from bson import ObjectId

def test_admin_workspace_endpoints(test_context):
    client = test_context["client"]
    db = test_context["db"]
    user_id = test_context["user_id"]
    role_id = test_context["role_id"]
    skill_python = test_context["skill_python"]

    db["users"].docs[0]["role"] = "owner"
    job_id = db["jobs"].docs[0]["_id"] if db["jobs"].docs else None
    if job_id is None:
        inserted = client.post(
            "/jobs/submit",
            headers=test_context["headers"],
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

    weighted_job = client.post(
        "/jobs/submit",
        headers=test_context["headers"],
        json={
            "title": "Data Platform Engineer",
            "company": "Acme",
            "location": "Remote",
            "source": "board",
            "description_excerpt": "Approved job should refresh role weights",
            "required_skills": ["Python"],
            "required_skill_ids": [skill_python],
            "role_ids": [role_id],
        },
    )
    assert weighted_job.status_code == 200

    weighted_job_moderation = client.patch(
        f"/admin/jobs/{weighted_job.json()['id']}/moderation",
        headers=test_context["headers"],
        json={"moderation_status": "approved", "moderation_reason": None},
    )
    assert weighted_job_moderation.status_code == 200

    role_weights = client.get(f"/roles/{role_id}/weights", headers=test_context["headers"])
    assert role_weights.status_code == 200
    weights = role_weights.json()["weights"]
    assert len(weights) == 1
    assert weights[0]["skill_name"] == "Python"

    audit_actions = {doc["action"] for doc in db["audit_events"].docs}
    assert "admin.user.role_updated" in audit_actions
    assert "admin.job.moderation_updated" in audit_actions


def test_admin_mlflow_endpoints(test_context, monkeypatch):
    client = test_context["client"]
    db = test_context["db"]

    db["users"].docs[0]["role"] = "owner"
    now = datetime.now(timezone.utc)

    monkeypatch.setattr(
        "app.routers.admin.get_mlflow_overview",
        lambda: {
            "available": True,
            "tracking_uri": "sqlite:///backend/ml_sandbox/artifacts/mlflow.db",
            "experiment_count": 1,
            "registered_model_count": 1,
            "latest_run_started_at": now,
            "experiments": [
                {
                    "id": "1",
                    "name": "skillbridge-eval",
                    "lifecycle_stage": "active",
                    "creation_time": now,
                    "last_update_time": now,
                    "run_count": 1,
                    "latest_run_started_at": now,
                    "latest_runs": [
                        {
                            "run_id": "run-1",
                            "run_name": "baseline",
                            "status": "FINISHED",
                            "experiment_id": "1",
                            "artifact_uri": "mlflow-artifacts:/1/run-1/artifacts",
                            "start_time": now,
                            "end_time": now,
                            "duration_seconds": 12.5,
                            "metrics": {"ranking.map": 0.81},
                            "params": {"inference_mode": "local-fallback"},
                            "tags": {"mlflow.runName": "baseline"},
                            "primary_metric_key": "ranking.map",
                            "primary_metric_value": 0.81,
                        }
                    ],
                }
            ],
            "registered_models": [
                {
                    "name": "skillbridge-ranker",
                    "description": "Ranking model",
                    "latest_versions": [
                        {
                            "name": "skillbridge-ranker",
                            "version": "3",
                            "current_stage": "Staging",
                            "run_id": "run-1",
                            "source": "/tmp/model",
                            "creation_timestamp": now,
                        }
                    ],
                }
            ],
            "error": None,
        },
    )
    monkeypatch.setattr(
        "app.routers.admin.get_mlflow_experiment_runs",
        lambda experiment_id, limit=25: [
            {
                "run_id": "run-1",
                "run_name": f"baseline-{experiment_id}",
                "status": "FINISHED",
                "experiment_id": experiment_id,
                "artifact_uri": "mlflow-artifacts:/1/run-1/artifacts",
                "start_time": now,
                "end_time": now,
                "duration_seconds": 12.5,
                "metrics": {"ranking.map": 0.81, "extraction.f1": 0.77},
                "params": {"limit": str(limit)},
                "tags": {"mlflow.runName": "baseline"},
                "primary_metric_key": "ranking.map",
                "primary_metric_value": 0.81,
            }
        ],
    )
    monkeypatch.setattr(
        "app.routers.admin.get_mlflow_run_detail",
        lambda experiment_id, run_id: {
            "run_id": run_id,
            "run_name": "baseline-detail",
            "status": "FINISHED",
            "experiment_id": experiment_id,
            "artifact_uri": "mlflow-artifacts:/1/run-1/artifacts",
            "start_time": now,
            "end_time": now,
            "duration_seconds": 12.5,
            "metrics": {"ranking.map": 0.81},
            "params": {"dataset": "bundled-samples"},
            "tags": {"mlflow.runName": "baseline-detail"},
            "primary_metric_key": "ranking.map",
            "primary_metric_value": 0.81,
            "parent_run_id": None,
            "child_runs": [],
            "artifacts": [{"path": "evaluations", "is_dir": True, "file_size": None}],
        },
    )
    monkeypatch.setattr(
        "app.routers.admin.list_available_eval_datasets",
        lambda: [
            {
                "id": "bundled-samples",
                "label": "Bundled sample evals",
                "kind": "sample",
                "path": "/tmp/datasets",
                "manifest_path": None,
                "extraction_dataset": "/tmp/datasets/extraction.jsonl",
                "ranking_dataset": "/tmp/datasets/ranking.jsonl",
                "rewrite_dataset": "/tmp/datasets/rewrite.jsonl",
                "created_at": now,
                "counts": {"extraction": 12},
            }
        ],
    )
    monkeypatch.setattr(
        "app.routers.admin.get_local_model_options",
        lambda: {
            "available_inference_modes": ["auto", "local-transformer", "local-fallback"],
            "embedding_models": ["sentence-transformers/all-MiniLM-L6-v2"],
            "zero_shot_models": ["MoritzLaurer/deberta-v3-base-zeroshot-v1.1-all-33"],
            "rewrite_models": ["google/flan-t5-small"],
            "default_inference_mode": "local-transformer",
            "default_embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
            "default_zero_shot_model": "MoritzLaurer/deberta-v3-base-zeroshot-v1.1-all-33",
            "default_rewrite_model": "google/flan-t5-small",
            "presets": [
                {
                    "id": "edge-candidate",
                    "label": "Edge Candidate",
                    "description": "Small local stack",
                    "inference_modes": ["local-transformer"],
                    "embedding_models": ["sentence-transformers/all-MiniLM-L6-v2"],
                    "zero_shot_models": ["MoritzLaurer/deberta-v3-base-zeroshot-v1.1-all-33"],
                    "rewrite_models": ["google/flan-t5-small"],
                }
            ],
        },
    )
    monkeypatch.setattr(
        "app.routers.admin.list_mlflow_jobs",
        lambda limit=20: [
            {
                "id": "job-1",
                "kind": "experiment_run",
                "status": "running",
                "created_at": now,
                "started_at": now,
                "finished_at": None,
                "command": ["python", "run_mlflow_experiment.py"],
                "summary": {"experiment_name": "skillbridge-eval"},
                "log_lines": ["starting"],
                "return_code": None,
                "error": None,
            }
        ],
    )
    monkeypatch.setattr(
        "app.routers.admin.get_mlflow_job",
        lambda job_id: {
            "id": job_id,
            "kind": "dataset_export",
            "status": "succeeded",
            "created_at": now,
            "started_at": now,
            "finished_at": now,
            "command": ["python", "export_eval_sets.py"],
            "summary": {"max_users": "50"},
            "log_lines": ["done"],
            "return_code": 0,
            "error": None,
        },
    )
    monkeypatch.setattr(
        "app.routers.admin.launch_eval_export_job",
        lambda payload: {
            "id": "export-1",
            "kind": "dataset_export",
            "status": "queued",
            "created_at": now,
            "started_at": None,
            "finished_at": None,
            "command": ["python", "export_eval_sets.py"],
            "summary": {"max_users": str(payload["max_users"])},
            "log_lines": [],
            "return_code": None,
            "error": None,
        },
    )
    monkeypatch.setattr(
        "app.routers.admin.launch_mlflow_experiment_job",
        lambda payload: {
            "id": "run-queue-1",
            "kind": "experiment_run",
            "status": "queued",
            "created_at": now,
            "started_at": None,
            "finished_at": None,
            "command": ["python", "run_mlflow_experiment.py"],
            "summary": {"experiment_name": payload["experiment_name"]},
            "log_lines": [],
            "return_code": None,
            "error": None,
        },
    )

    overview = client.get("/admin/mlflow/overview", headers=test_context["headers"])
    assert overview.status_code == 200
    assert overview.json()["available"] is True
    assert overview.json()["experiments"][0]["latest_runs"][0]["primary_metric_key"] == "ranking.map"

    runs = client.get("/admin/mlflow/experiments/1/runs?limit=10", headers=test_context["headers"])
    assert runs.status_code == 200
    assert runs.json()[0]["experiment_id"] == "1"
    assert runs.json()[0]["params"]["limit"] == "10"

    run_detail = client.get("/admin/mlflow/experiments/1/runs/run-1", headers=test_context["headers"])
    assert run_detail.status_code == 200
    assert run_detail.json()["artifacts"][0]["path"] == "evaluations"

    datasets = client.get("/admin/mlflow/datasets", headers=test_context["headers"])
    assert datasets.status_code == 200
    assert datasets.json()[0]["id"] == "bundled-samples"

    local_options = client.get("/admin/mlflow/local-options", headers=test_context["headers"])
    assert local_options.status_code == 200
    assert local_options.json()["default_rewrite_model"] == "google/flan-t5-small"

    jobs = client.get("/admin/mlflow/jobs?limit=5", headers=test_context["headers"])
    assert jobs.status_code == 200
    assert jobs.json()[0]["kind"] == "experiment_run"

    job = client.get("/admin/mlflow/jobs/job-1", headers=test_context["headers"])
    assert job.status_code == 200
    assert job.json()["status"] == "succeeded"

    export_job = client.post(
        "/admin/mlflow/datasets/export",
        headers=test_context["headers"],
        json={"max_users": 40, "max_per_user": 5, "negative_count": 2},
    )
    assert export_job.status_code == 200
    assert export_job.json()["summary"]["max_users"] == "40"

    run_job = client.post(
        "/admin/mlflow/experiments/run",
        headers=test_context["headers"],
        json={
            "experiment_name": "skillbridge-admin-sweep",
            "dataset_id": "bundled-samples",
            "inference_modes": ["auto"],
            "embedding_models": ["sentence-transformers/all-MiniLM-L6-v2"],
            "zero_shot_models": ["MoritzLaurer/deberta-v3-base-zeroshot-v1.1-all-33"],
            "rewrite_models": ["google/flan-t5-small"],
            "top_k": [1, 3, 5],
        },
    )
    assert run_job.status_code == 200
    assert run_job.json()["summary"]["experiment_name"] == "skillbridge-admin-sweep"

    audit_actions = [doc["action"] for doc in db["audit_events"].docs]
    assert "admin.mlflow.dataset_export_launched" in audit_actions
    assert "admin.mlflow.experiment_launched" in audit_actions


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

    assert any(doc["action"] == "admin.user.deactivated" for doc in db["audit_events"].docs)


def test_admin_workspace_blocks_standard_users(test_context):
    client = test_context["client"]
    response = client.get("/admin/summary", headers=test_context["headers"])
    assert response.status_code == 403
