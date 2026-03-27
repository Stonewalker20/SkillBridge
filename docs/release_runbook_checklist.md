# Release Runbook Checklist

Use this checklist for each staging or production release.

## Pre-Release

- Confirm the release branch is up to date with `prod`.
- Verify environment variables for frontend, backend, MongoDB, auth, and billing.
- Confirm MongoDB backups are available and recent.
- Confirm feature flags or subscription gates are set correctly.
- Review the diff for migrations, config changes, and docs changes.

## Build And Test

- Run backend tests.
- Run frontend lint and frontend tests.
- Run any required API or contract tests.
- Verify the frontend build succeeds for the target environment.

## Data And Migration

- Back up the target database.
- Run migrations or seed changes in the intended order.
- Verify indexes and background jobs after deployment.

## Deployment

- Deploy backend first, then frontend.
- Confirm health endpoints respond.
- Confirm authentication works.
- Confirm subscription gating works for locked and active accounts.
- Confirm core product flows work end to end.

## Smoke Test

- Register or log in with a test account.
- Add evidence.
- Confirm a skill.
- Run a job match.
- Generate a tailored resume.
- Verify downloads and media loading.

## Post-Release

- Watch logs and error tracking.
- Verify uptime and latency.
- Confirm billing or subscription state behaves correctly.
- Roll back or disable the release if smoke tests fail.
