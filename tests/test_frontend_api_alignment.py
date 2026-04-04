import re
from pathlib import Path

from app.main import app


def _read_frontend_api_ts() -> str:
    here = Path(__file__).resolve()
    repo_root = here.parents[1]
    api_ts = repo_root / "frontend" / "src" / "app" / "services" / "api.ts"
    return api_ts.read_text(encoding="utf-8")


def _extract_paths(ts: str) -> set[str]:
    raw = set(re.findall(r"['\"](/[^'\"]+)['\"]", ts))
    raw |= set(re.findall(r"`([^`]+)`", ts))

    out: set[str] = set()
    for s in raw:
        if not s.startswith("/"):
            continue
        s = s.split("?")[0]
        s = re.sub(r"\$\{[^}]+\}", "{id}", s)

        if s.startswith(
            (
                "/auth",
                "/health",
                "/skills",
                "/jobs",
                "/evidence",
                "/ingest",
                "/projects",
                "/dashboard",
                "/admin",
                "/roles",
                "/taxonomy",
                "/tailor",
                "/portfolio",
            )
        ):
            out.add(s)
    return out


def _normalize_to_openapi(path: str) -> str:
    path = path.replace("{id}{id}", "{id}")
    if "/admin/users/{id}" in path:
        return path.replace("{id}", "{user_id}")
    if "/admin/mlflow/experiments/{id}/runs/{id}" in path:
        return path.replace("/admin/mlflow/experiments/{id}/runs/{id}", "/admin/mlflow/experiments/{experiment_id}/runs/{run_id}")
    if "/admin/mlflow/experiments/{id}/runs" in path:
        return path.replace("{id}", "{experiment_id}")
    if "/admin/mlflow/jobs/{id}" in path:
        return path.replace("{id}", "{job_id}")
    if "/skills/{id}" in path:
        return path.replace("{id}", "{skill_id}")
    if "/jobs/{id}" in path:
        return path.replace("{id}", "{job_id}")
    if "/projects/{id}" in path:
        return path.replace("{id}", "{project_id}")
    if "/tailor/history/{id}/reanalyze" in path:
        return path.replace("{id}", "{history_id}")
    if "/tailor/history/{id}" in path:
        return path.replace("{id}", "{history_id}")
    if "/tailor/resumes/{id}" in path:
        return path.replace("{id}", "{tailored_id}")
    if "/roles/{id}" in path:
        return path.replace("{id}", "{role_id}")
    if "/tailor/{id}" in path:
        return path.replace("{id}", "{tailored_id}")
    if "/portfolio/items/{id}" in path:
        return path.replace("{id}", "{item_id}")
    if "/ingest/resume/{id}/promote" in path:
        return path.replace("{id}", "{snapshot_id}")
    if "/skills/extract/skills/{id}" in path:
        return path.replace("{id}", "{snapshot_id}")
    if "/taxonomy/aliases/{id}" in path:
        return path.replace("{id}", "{skill_id}")
    if "/taxonomy/graph/{id}" in path:
        return path.replace("{id}", "{skill_id}")
    if "/taxonomy/trajectory/path/{id}" in path:
        return path.replace("{id}", "{role_id}")
    if "/taxonomy/learning-path/skill/{id}" in path:
        return path.replace("{id}", "{skill_name}")
    return path


def test_frontend_api_ts_only_calls_known_backend_paths():
    ts = _read_frontend_api_ts()
    fe_paths = {_normalize_to_openapi(p) for p in _extract_paths(ts)}
    spec_paths = set(app.openapi()["paths"].keys())

    # Allow trailing slash variants.
    spec_paths_with_variants = (
        spec_paths
        | {p.rstrip("/") for p in spec_paths}
        | {p + "/" for p in spec_paths if not p.endswith("/")}
    )

    unknown = sorted(p for p in fe_paths if p not in spec_paths_with_variants)
    assert not unknown, f"Frontend calls unknown backend paths: {unknown}"


def test_frontend_covers_every_backend_route():
    ts = _read_frontend_api_ts()
    fe_paths = {_normalize_to_openapi(p).rstrip("/") for p in _extract_paths(ts)}
    be_paths = {p.rstrip("/") for p in app.openapi()["paths"].keys()}

    missing = sorted(p for p in be_paths if p not in fe_paths)
    assert not missing, (
        "Frontend API surface is missing backend routes. "
        "Add wrappers in frontend/src/app/services/api.ts for these paths: "
        f"{missing}"
    )
