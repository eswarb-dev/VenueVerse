# VenueVerse Changelog

Git history was not available from the current sandboxed working directory during the audit. This changelog is therefore an inferred development timeline based on the current source tree, Supabase schema, and existing documentation.

## Phase 1: Project Scaffold

- Created Expo + React Native + TypeScript application.
- Added app entry point in `App.tsx`.
- Added theme constants and shared UI components.
- Configured TypeScript path aliases and Metro.
- Added React Navigation native stack setup.

## Phase 2: Authentication and Profiles

- Added Supabase client setup.
- Implemented `AuthProvider`.
- Added session restoration with Supabase Auth.
- Implemented login, logout, forgot password, password change, and admin-created accounts.
- Added profile creation and profile fetching services.
- Added college email validation for `@srec.ac.in`.

## Phase 3: Venue Browsing

- Added hall domain types and hall service.
- Implemented active hall listing.
- Added hall detail screen.
- Added department, venue type, capacity, and search filters.
- Added reusable hall card and hall form components.

## Phase 4: Booking Flow

- Added booking domain types.
- Implemented time slot constants and calendar/date selection.
- Added venue availability queries.
- Implemented booking request creation.
- Added overlap checking with `check_booking_overlap`.
- Added user booking history and booking details.
- Added pending booking cancellation.

## Phase 5: Admin Approval Workflow

- Added admin stack and admin dashboard.
- Implemented pending request list.
- Implemented booking review screen.
- Added approve and reject flows.
- Added approval conflict detection with `check_approved_booking_overlap`.
- Added all bookings/history screen with filters.
- Added requester notifications after approval/rejection.

## Phase 6: Super Admin Management

- Added super-admin-gated venue management screens.
- Implemented add/edit venue flows.
- Added hall image upload to Supabase Storage.
- Added user management and user detail screens.
- Added role update flow.
- Added `admin-create-user` Edge Function.

## Phase 7: Notifications

- Added `notifications` table.
- Implemented notification service.
- Added notification context/provider.
- Added unread count badge.
- Added notification inbox.
- Added mark-one and mark-all read actions.
- Enabled Supabase Realtime for notification inserts.

## Phase 8: Push Notifications

- Added Expo push notification helpers.
- Added `push_tokens` table.
- Registered device push tokens after login/session.
- Added `send-push-notification` Edge Function.
- Integrated push sending for booking requests, approvals, and rejections.
- Added notification tap response navigation.

## Phase 9: Supabase Hardening

- Added RLS policies across application tables.
- Added trigger-level booking update restrictions.
- Added trigger-level overlap prevention.
- Added role-update protections.
- Added storage bucket and storage policies.
- Added initial seeded venues.
- Added setup, database, user flow, and testing documentation.

## Current Status

- MVP functionality is implemented.
- Production readiness requires QA, automated tests, final environment validation, and cleanup of unused or partially wired schema fields.
