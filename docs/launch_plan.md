# Launch Plan Draft

Draft only. This separates blockers to launch from work that can wait until after revenue starts.

## Launch Blockers

These should be completed before public launch:

- Replace the mocked subscription flow with real billing.
- Deploy staging and production infrastructure on separate environments.
- Move avatar and file storage to cloud object storage.
- Finalize privacy policy, terms, and data retention policy.
- Add rate limiting and session policy hardening.
- Add CI checks that gate merges on backend tests and frontend lint/test.
- Confirm error tracking and uptime monitoring.
- Run a full staging smoke test on signup, login, evidence, job match, resume generation, and subscription upgrade.

## Pre-Launch Nice To Have

These improve the launch but are not hard blockers:

- Add richer onboarding copy.
- Add more achievement tiers and reward celebrations.
- Add audit logging for admin actions.
- Add payment invoices and customer portal flows.
- Expand smoke tests and API contract coverage.

## Post-Launch Work

These can follow once users are paying and the system is stable:

- Add referral or affiliate tracking.
- Add A/B testing for pricing and onboarding.
- Add deeper admin analytics and retention reporting.
- Add additional storage providers or regional deployment support.
- Add more reward milestones and seasonal campaigns.

## Immediate Sequence

1. Ship staging.
2. Integrate real billing.
3. Harden auth and storage.
4. Publish legal pages.
5. Run a private beta.
6. Open paid production access.
