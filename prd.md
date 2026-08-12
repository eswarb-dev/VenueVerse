# VenueVerse PRD

## Product

VenueVerse is a mobile-first college venue booking app for Sri Ramakrishna Engineering College. It helps students and staff request auditoriums, seminar halls, labs, and other campus venues, while department admins review approvals and users receive booking receipts and QR verification support.

## Goals

- Let authenticated users browse venues and submit booking requests.
- Let department admins approve or reject requests for venues in their department.
- Keep super admin access read-only for global audit where applicable.
- Provide in-app notification history and native Android push notifications.
- Generate official booking receipts with PDF download/share/email support.
- Support QR-based receipt verification.
- Keep workflows simple, role-scoped, and reliable on release APK builds.

## Users

- Students / campus users: create bookings, track status, view receipts.
- Department admins: review pending requests for their department.
- Super admin: audit global booking activity.

## Core Flows

1. User signs in with VenueVerse account.
2. User browses venues and checks availability.
3. User submits a booking request.
4. Department admin receives a new request notification.
5. Admin approves or rejects with remarks when needed.
6. User receives status update through in-app notification and remote push.
7. Receipt is generated for approved/rejected decisions.
8. User can view, download, share, or email receipt PDF.
9. QR verification confirms receipt authenticity.

## Non-Goals

- Public sign-up.
- Social login.
- Firebase database/auth usage.
- Changing existing booking permission rules.
- Replacing Supabase as the app backend.

## Success Criteria

- No manual refresh needed for visible booking and notification updates.
- Release APK receives push notifications, not only Expo Go.
- Receipt PDF remains downloadable/shareable in-app.
- Email receipt copy includes generated PDF attachment.
- Role restrictions are preserved.

