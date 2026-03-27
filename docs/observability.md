# Observability

This repo now emits structured backend request logs and has a simple CI workflow for launch gating.

## Backend request logs

Every HTTP request logs a JSON object with:

- `event`
- `request_id`
- `method`
- `path`
- `status_code`
- `duration_ms`
- `client_ip`
- `user_agent`

The response also returns `X-Request-ID`, which you can surface in support tickets or error reports.

Startup and shutdown emit `app_startup` and `app_shutdown` events with the active environment and deployment shape.

## Uptime checks

Use these endpoints for health monitoring:

- `GET /health/`
- `GET /health/db_counts`

The first confirms the API process is alive and the second verifies database reachability and collection access.

## Error tracking hook points

No paid vendor SDK is bundled. If you add one later, the integration points are:

- Backend: forward exception logs and request IDs from the structured request logger.
- Frontend: attach a global error boundary and capture unhandled promise rejections from the app shell.
- Support workflow: include `X-Request-ID` in any user-facing error UI or incident report.

## CI

GitHub Actions now runs backend tests plus frontend lint, tests, and build validation on push and pull request events.
