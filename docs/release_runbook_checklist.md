# Release Runbook Checklist

Use this checklist for each staging or production release.

## Pre-Release

- Confirm the release branch is up to date with `prod`.
- Verify environment variables for frontend, backend, MongoDB, auth, billing, and media storage against `docs/env_matrix.md`.
- Confirm MongoDB backups are available and recent.
- Confirm feature flags or subscription gates are set correctly.
- Review the diff for migrations, config changes, and docs changes.

## Build And Test

- Run backend tests: `pytest backend/tests/test_auth_and_health.py backend/tests/test_api_surface.py`
- Run frontend lint and frontend tests from `frontend/`: `npm run lint` and `npm test`
- Run any required API or contract tests.
- Verify the frontend build succeeds for the target environment with `npm run build`.

## Data And Migration

- Back up the target database.
- Run migrations or seed changes in the intended order.
- Verify indexes and background jobs after deployment.

## Deployment

- Deploy backend first, then frontend.
- Confirm `GET /health/` and `GET /health/db_counts` respond.
- Confirm authentication works, including password reset request + confirm.
- Confirm subscription gating works for locked and active accounts.
- Confirm core product flows work end to end.

## Smoke Test

- Register or log in with a test account.
- Request a password reset and verify the link flow.
- Add evidence.
- Confirm a skill.
- Run a job match.
- Generate a tailored resume DOCX.
- Verify downloads and media loading.

## Post-Release

- Watch logs and error tracking.
- Verify uptime and latency.
- Confirm billing or subscription state behaves correctly.
- Roll back or disable the release if smoke tests fail.
