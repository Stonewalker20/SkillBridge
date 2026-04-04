from app.main import app


def _assert_path(openapi: dict, path: str, methods: set[str]):
    assert path in openapi["paths"], f"Missing path: {path}"
    got = set(openapi["paths"][path].keys())
    missing = {m.lower() for m in methods} - got
    assert not missing, f"Missing methods for {path}: {sorted(missing)} (have {sorted(got)})"


def test_openapi_includes_all_routes():
    spec = app.openapi()

    # Health
    _assert_path(spec, "/health/", {"GET"})
    _assert_path(spec, "/health/db_counts", {"GET"})

    # Auth
    _assert_path(spec, "/auth/register", {"POST"})
    _assert_path(spec, "/auth/login", {"POST"})
    _assert_path(spec, "/auth/me", {"GET", "PATCH", "DELETE"})
    _assert_path(spec, "/auth/logout", {"POST"})

    # Resume ingest
    _assert_path(spec, "/ingest/resume/text", {"POST"})
    _assert_path(spec, "/ingest/resume/pdf", {"POST"})
    _assert_path(spec, "/ingest/resume/{snapshot_id}/promote", {"POST"})

    # Skills
    _assert_path(spec, "/skills/", {"GET", "POST"})
    _assert_path(spec, "/skills/{skill_id}", {"DELETE", "PATCH"})
    _assert_path(spec, "/skills/extract/skills/{snapshot_id}", {"POST"})
    _assert_path(spec, "/skills/gaps", {"GET"})
    _assert_path(spec, "/skills/gaps/confirmed", {"GET"})

    # Confirmations
    _assert_path(spec, "/skills/confirmations/", {"POST", "GET"})

    # Jobs
    _assert_path(spec, "/jobs/", {"GET", "POST"})
    _assert_path(spec, "/jobs/submit", {"POST"})
    _assert_path(spec, "/jobs/{job_id}/moderate", {"PATCH"})
    _assert_path(spec, "/jobs/{job_id}/roles", {"POST"})

    # Evidence
    _assert_path(spec, "/evidence/", {"GET", "POST"})

    # Projects
    _assert_path(spec, "/projects/", {"GET", "POST"})
    _assert_path(spec, "/projects/{project_id}", {"GET"})
    _assert_path(spec, "/projects/{project_id}/skills", {"POST", "GET"})

    # Dashboard
    _assert_path(spec, "/dashboard/summary", {"GET"})

    # Roles
    _assert_path(spec, "/roles/", {"GET", "POST"})
    _assert_path(spec, "/roles/{role_id}/compute_weights", {"POST"})
    _assert_path(spec, "/roles/{role_id}/weights", {"GET"})

    # Taxonomy
    _assert_path(spec, "/taxonomy/aliases/{skill_id}", {"PUT"})
    _assert_path(spec, "/taxonomy/relations", {"POST", "GET"})

    # Tailor
    _assert_path(spec, "/tailor/job/ingest", {"POST"})
    _assert_path(spec, "/tailor/match", {"POST"})
    _assert_path(spec, "/tailor/preview", {"POST"})
    _assert_path(spec, "/tailor/{tailored_id}/export/docx", {"GET"})
    _assert_path(spec, "/tailor/{tailored_id}/export/pdf", {"GET"})

    # Portfolio
    _assert_path(spec, "/portfolio/items", {"POST", "GET"})
    _assert_path(spec, "/portfolio/items/{item_id}", {"PATCH", "DELETE"})
