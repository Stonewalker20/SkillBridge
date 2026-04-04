# Data Retention Policy Draft

Draft only. Not legal advice. Update this after legal review and operational validation.

## Goal

Define how long SkillBridge keeps user and operational data, and when it is deleted or anonymized.

## Suggested Retention Rules

- Account records: keep while the account is active, then delete or anonymize after a defined grace period.
- User content: keep until the user deletes it or deletes the account, unless legal retention requires longer storage.
- Resume snapshots and evidence: keep while needed for the product experience and any agreed retention period.
- Job match history and tailored resumes: keep until deleted by the user or until account deletion.
- Authentication sessions: expire automatically and purge on expiry.
- Logs and diagnostics: keep for a short operational window only.
- Analytics and aggregated metrics: keep in anonymized or aggregated form where possible.

## Suggested Starting Windows

- Auth/session records: session lifetime plus cleanup window.
- Product logs: 30 to 90 days.
- Error traces: 30 to 90 days.
- Deleted-account soft retention: 7 to 30 days before permanent purge.
- Backups: follow the backup retention policy of the hosting provider.

## Deletion Workflow

1. Mark the account for deletion or deactivation.
2. Remove or anonymize primary user records.
3. Delete or detach user-generated content.
4. Purge derived artifacts where practical.
5. Let backups age out on the normal backup schedule.

## Exceptions

Keep data longer only when required for:

- Legal compliance.
- Fraud or abuse investigation.
- Payment disputes.
- Security incident response.

## Operational Notes

- Retention rules should be enforced in application jobs or database cleanup jobs.
- Any exception must be documented and reviewable.
- Final production values should be set by counsel and operations, not guessed.
