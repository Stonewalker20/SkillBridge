# Deployment Guide

This guide covers the minimum repeatable path for staging and production SkillBridge deployments.

## 1. Prepare Environment Files

Use these files as the starting point:

- `backend/.env.staging.example`
- `backend/.env.production.example`
- `frontend/.env.staging.example`
- `frontend/.env.production.example`
- `docs/env_matrix.md`

Before deploying, verify:

- MongoDB points at a managed instance, not localhost.
- `ALLOWED_ORIGINS`, `PUBLIC_APP_URL`, and `PUBLIC_API_URL` match the final domains exactly.
- Billing price IDs are present for Starter, Pro, and Elite if checkout should be live.
- Media storage uses `MEDIA_STORAGE_MODE=s3` with real object storage credentials.

## 2. Deploy Order

Deploy backend first, then frontend.

Reason:

- frontend plan cards and gated routes depend on the backend route contract
- billing callbacks and password reset links rely on stable backend URLs

## 3. Backend Preflight

From the repo root:

```bash
cd backend
pytest backend/tests/test_auth_and_health.py backend/tests/test_api_surface.py
```

Then verify the backend starts with the target env file and does not fail runtime validation.

Runtime validation currently checks:

- non-localhost URLs outside development
- CORS origin presence
- S3 configuration completeness when `MEDIA_STORAGE_MODE=s3`

## 4. Frontend Preflight

From `frontend/`:

```bash
npm install
npm run lint
npm test
npm run build
```

Set `VITE_API_BASE` to the deployed backend origin for staging or production builds.

## 5. Billing Setup

Before enabling real subscriptions:

- create live Stripe products and prices for Starter, Pro, and Elite
- set `STRIPE_SECRET_KEY`
- set `STRIPE_WEBHOOK_SECRET`
- set `STRIPE_PRICE_ID_STARTER`
- set `STRIPE_PRICE_ID_PRO`
- set `STRIPE_PRICE_ID_ELITE`
- configure checkout success and cancel URLs
- expose `/billing/webhook` on the public backend and register it in Stripe

## 6. Media Setup

For multi-instance deploys, do not keep `MEDIA_STORAGE_MODE=local`.

Use S3 or R2-style object storage and verify:

- uploads succeed from `/auth/me/avatar`
- media URLs resolve publicly
- old avatar replacements remove stale objects

## 7. Smoke Test After Deploy

Run this exact flow against staging before promoting to production:

1. Load `/health/` and `/health/db_counts`.
2. Register a new account.
3. Request a password reset.
4. Log in and confirm `/auth/me` works.
5. Verify a locked user is blocked from `/dashboard/summary`.
6. Start checkout for one billing tier.
7. Confirm an active user can open the dashboard.
8. Add evidence.
9. Confirm skills.
10. Run Job Match.
11. Generate a tailored resume DOCX.
12. Open the admin page with an owner or team account.

## 8. Rollback Basics

If the release fails:

1. stop directing traffic to the new frontend build
2. roll the backend image or deployment back to the last known-good revision
3. restore the database only if a migration or destructive data write caused corruption
4. keep Stripe webhooks disabled during rollback if event handling changed

## 9. Known Remaining External Dependencies

The repo now includes a password reset flow, but production-grade email delivery still depends on an external email provider. Until a mailer is wired, password reset links are development-friendly rather than customer-ready.
