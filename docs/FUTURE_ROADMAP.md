# VenueVerse Future Roadmap

## Current Limitations

- Automated test suite is not detected in the current codebase.
- Analytics/reporting is not detected in the current codebase.
- Email notification service beyond Supabase Auth password reset is not detected in the current codebase.
- Calendar sync is not detected in the current codebase.
- PDF/CSV booking export is not detected in the current codebase.
- QR check-in is not detected in the current codebase.
- Recurring bookings are not detected in the current codebase.
- Department-level multi-step approvals are not detected in the current codebase.
- Audit log table for admin actions is not detected in the current codebase.
- `register_number` and `phone` exist in the database but are not detected in the current super admin account creation payload.
- `purpose`, `audience_count`, and `additional_requirements` exist in the database but are not detected in the current booking creation payload.
- `AdminPlaceholderScreen` exists but is not detected in active navigation.

## High Priority

| Item | Reason |
| --- | --- |
| Add automated tests | Protect auth, booking, approval, and RLS-sensitive flows from regressions. |
| Add end-to-end smoke tests | Validate login, booking creation, admin approval, and notifications on real app flows. |
| Align booking form with schema | Either collect `purpose`, `audience_count`, and `additional_requirements`, or remove unused fields. |
| Align account creation form with schema | Either collect `register_number` and `phone`, or remove unused fields. |
| Add audit logging | Track role changes, approval decisions, venue edits, and user creation. |
| Validate Supabase RLS policies | Confirm every user role sees only the intended data. |
| Production push testing | Verify push behavior on EAS development/production builds. |

## Medium Priority

| Item | Reason |
| --- | --- |
| Booking export to CSV/PDF | Helps admins prepare reports and offline records. |
| Calendar sync | Allows approved bookings to sync with institutional calendars. |
| Booking edit/reschedule flow | Reduces need to cancel and recreate requests. |
| Department-level approval chains | Supports larger colleges with departmental approval requirements. |
| Admin analytics dashboard | Adds visibility into venue utilization and booking volume. |
| Push receipt tracking | Improves reliability and debugging for notification delivery. |
| Email notifications | Provides a fallback channel for booking decisions. |

## Low Priority

| Item | Reason |
| --- | --- |
| Dark mode | Improves user preference support. |
| QR check-in | Useful for attendance or venue usage verification. |
| Offline-friendly cache | Improves browsing reliability with poor connectivity. |
| Attachment uploads | Allows event documents, approvals, or circulars to be attached. |
| In-app onboarding | Helps new users understand booking policies and workflow. |
| Recurring bookings | Supports repeated classes, meetings, and seminars. |

## Suggested Release Milestones

### MVP Hardening

- Add tests for validators and service functions.
- Validate RLS policies with real test users.
- Confirm Edge Functions in a clean Supabase project.
- Verify Android device push notification flow.
- Fix schema/UI payload mismatches.

### Admin Reporting Release

- Add booking analytics.
- Add CSV/PDF export.
- Add audit logs.
- Add date range and department reports.

### Institutional Workflow Release

- Add department-level approval stages.
- Add booking reschedule requests.
- Add calendar sync.
- Add email notification channel.

### Experience Polish Release

- Add dark mode.
- Add onboarding.
- Add offline-friendly hall cache.
- Add QR check-in.
