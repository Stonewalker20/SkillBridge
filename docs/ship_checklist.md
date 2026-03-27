# SkillBridge Ship Checklist

This checklist is the current path from local project to a production-ready release. Items are grouped by ship priority, not by team ownership.

## 1. Production Environment

- [x] Create explicit `development`, `staging`, and `production` environment templates.
- [x] Add runtime validation so staging/production cannot start with localhost Mongo or localhost origins.
- [ ] Provision a cloud MongoDB cluster for staging.
- [ ] Provision a separate cloud MongoDB cluster or database for production.
- [ ] Move secrets into a managed secret store or deployment platform environment settings.
- [ ] Point frontend and backend to stable public domains.

## 2. Deployments

- [ ] Pick the production hosts for frontend and backend.
- [ ] Create a staging deployment for frontend and backend.
- [ ] Add one-command backend startup and frontend build instructions for staging.
- [ ] Add a release checklist for database migrations, seed data, and rollback.

## 3. Storage And Media

- [x] Abstract avatar/file storage behind a provider interface.
- [x] Add an S3/R2-compatible storage path behind environment variables.
- [x] Keep local storage working for development.
- [ ] Provision a real cloud bucket and public media URL for staging and production.
- [ ] Verify uploaded media caching and invalidation behavior in production.

## 4. Security

- [ ] Add rate limiting for auth routes and expensive AI routes.
- [ ] Review admin-only endpoints and confirm role checks.
- [ ] Add audit logging for admin actions.
- [ ] Finalize token/session expiry policy.
- [ ] Add password reset and email verification if public signup stays enabled.

## 5. Observability

- [x] Add structured backend request logging.
- [ ] Add error tracking for backend and frontend.
- [ ] Add uptime checks for frontend and backend.
- [ ] Add latency monitoring for job match, resume tailoring, and auth flows.

## 6. Quality Gates

- [x] Make backend tests, frontend lint/test/build, and API contract tests run in CI on every push.
- [ ] Add a staging smoke test covering signup, login, evidence, job match, and tailored resume generation.
- [ ] Add a release gate for MLflow results using frozen eval sets and target score thresholds.

## 7. Product Readiness

- [ ] Finish privacy policy, terms, and retention policy.
- [ ] Verify deactivate-account behavior and any user-facing account deletion copy.
- [ ] Run a small private beta and collect failure cases.
- [ ] Use beta findings to tighten onboarding, clarity, and model output quality.

## Draft Launch Artifacts

- [Privacy Policy Draft](./privacy_policy_draft.md)
- [Terms Draft](./terms_draft.md)
- [Data Retention Policy Draft](./data_retention_policy_draft.md)
- [Release Runbook Checklist](./release_runbook_checklist.md)
- [Launch Plan Draft](./launch_plan.md)

## In Progress Right Now

The first ship item is underway:

- `APP_ENV`, `ALLOWED_ORIGINS`, `PUBLIC_APP_URL`, and `PUBLIC_API_URL` are now part of the environment contract.
- Example env files now exist for root development use plus backend staging and production.
- Backend startup now fails fast when staging or production still points at localhost.
- Backend request logging is now structured and includes request IDs.
- GitHub Actions now runs backend tests plus frontend lint, tests, and build validation.

## Recommended Next Action

Provision the staging environment next:

1. Create MongoDB Atlas staging cluster.
2. Deploy backend with `backend/.env.staging.example` values adapted to real domains.
3. Deploy frontend pointing `VITE_API_BASE` to the staging backend.
4. Run a full smoke pass against staging before touching production.
