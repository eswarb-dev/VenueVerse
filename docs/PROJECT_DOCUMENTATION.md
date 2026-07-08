# VenueVerse Project Documentation

## Overview

VenueVerse is a React Native + Expo application backed by Supabase for college venue booking and approval. It allows students and staff to browse venues, check availability, submit booking requests, track request status, and receive notifications. Admins review booking requests, while super admins manage venues, users, and roles.

| Item | Details |
| --- | --- |
| Project Name | VenueVerse |
| Application Type | React Native + Expo mobile app |
| Backend | Supabase |
| Database | Supabase PostgreSQL |
| Purpose | College venue booking, approval, and notification workflow |
| Status | MVP-level implementation with production hardening still required |

Related documentation:

- [Supabase Documentation](./SUPABASE_DOCUMENTATION.md)
- [API Reference](./API_REFERENCE.md)
- [Changelog](./CHANGELOG.md)
- [Future Roadmap](./FUTURE_ROADMAP.md)
- [Quick Start](./README.md)

## Target Users

| User Type | Description |
| --- | --- |
| Students/Staff | Browse venues, check availability, create booking requests, and track approval status. |
| Admin | Review pending bookings, approve or reject requests, and view booking history. |
| Super Admin | Manage venues, create users, manage roles, and access all admin functions. |

## Tech Stack

| Area | Technology |
| --- | --- |
| Frontend | React Native `0.74.5`, Expo `~51.0.39` |
| Language | TypeScript `~5.3.3` |
| Backend | Supabase |
| Database | PostgreSQL |
| Authentication | Supabase Auth |
| Realtime | Supabase Realtime for notification inserts |
| Storage | Supabase Storage bucket `hall-images` |
| Edge Functions | `admin-create-user`, `send-push-notification` |
| Notifications | In-app notifications and Expo push notifications |
| Navigation | React Navigation Native Stack |
| State Management | React Context and screen-local state |
| Calendar/Date | `react-native-calendars`, `date-fns` |
| Media | `expo-image-picker` |

## Folder Structure

```text
.
|-- App.tsx
|-- README.md
|-- PROJECT_DOCUMENTATION.md
|-- docs/
|   |-- PROJECT_DOCUMENTATION.md
|   |-- SUPABASE_DOCUMENTATION.md
|   |-- API_REFERENCE.md
|   |-- CHANGELOG.md
|   |-- FUTURE_ROADMAP.md
|   `-- README.md
|-- src/
|   |-- components/
|   |-- constants/
|   |-- hooks/
|   |-- lib/
|   |-- navigation/
|   |-- screens/
|   |-- services/
|   |-- store/
|   |-- types/
|   `-- utils/
`-- supabase/
    |-- schema.sql
    `-- functions/
```

| Path | Purpose |
| --- | --- |
| `src/components` | Reusable UI components: buttons, inputs, hall cards, badges, loading, empty, and error states. |
| `src/constants` | Theme, department, facility, time slot, and app constants. |
| `src/hooks` | Shared hooks. Currently includes notification context. |
| `src/lib` | Supabase client and notification helper integration. |
| `src/navigation` | Root, auth, app, and admin navigation stacks. |
| `src/screens` | User-facing, admin, auth, booking, hall, notification, and profile screens. |
| `src/services` | Supabase data access and business operations. |
| `src/store` | Authentication context. |
| `src/types` | TypeScript domain types. |
| `src/utils` | Validation utilities. |
| `supabase/schema.sql` | Tables, policies, RPCs, triggers, storage, realtime setup, and seed venues. |
| `supabase/functions` | Supabase Edge Functions. |

## Implemented Features

### Authentication

- [x] Email/password login.
- [x] Super admin account creation with full name, college email, temporary password, role, and department.
- [x] College email validation for `@srec.ac.in`.
- [x] Supabase Auth login and password reset.
- [x] Session restoration.
- [x] Logout.
- [x] Password change.
- [x] Role-based navigation.

### Venue Booking

- [x] Active venue browsing.
- [x] Department, venue type, capacity, and search filters.
- [x] Venue details.
- [x] Calendar/date selection.
- [x] Multiple contiguous time slot selection.
- [x] Availability checking for pending and approved bookings.
- [x] Booking request submission.
- [x] RPC-based overlap checks.
- [x] Trigger-level duplicate booking prevention.

### Dashboard and Booking Management

- [x] User home dashboard.
- [x] Pending, approved, and rejected booking counts.
- [x] Today's booked halls popup.
- [x] Recent booking list.
- [x] Notification badge.
- [x] My Bookings list and status filtering.
- [x] Booking details.
- [x] Pending booking cancellation.

### Notifications

- [x] In-app notifications.
- [x] Unread count.
- [x] Realtime notification insert listener.
- [x] Mark one/all notifications as read.
- [x] Expo push token registration.
- [x] Push token persistence.
- [x] Push notification Edge Function invocation.

### Admin and Super Admin

- [x] Admin dashboard.
- [x] Pending request review.
- [x] Approve/reject booking.
- [x] Approval conflict validation.
- [x] All bookings/history screen.
- [x] Department filtering.
- [x] Super admin venue management.
- [x] Add/edit venues and upload hall images.
- [x] Super admin user management.
- [x] Create users through Edge Function.
- [x] Update user roles.

## User Roles

| Role | Permissions |
| --- | --- |
| `user` | Browse active venues, check availability, create own booking requests, view own bookings, cancel own pending bookings, view notifications, edit profile, change password. |
| `admin` | User permissions plus admin dashboard, pending request review, all booking history, approve/reject bookings, and notification creation for booking decisions. |
| `super_admin` | Admin permissions plus venue management, hall image upload, user management, user creation, and role updates. |

## Booking Workflow

```text
User Login
  |
  v
Select Department / Venue Type / Capacity / Date
  |
  v
Select Venue and Time Slot
  |
  v
Enter Booking Details
  |
  v
Client Validation
  |
  v
RPC: check_booking_overlap()
  |
  v
Database Trigger: enforce_booking_overlap_rules
  |
  v
Booking Submitted as pending
  |
  v
Admin Notification
  |
  v
Admin Review
  |
  +-- Approve --> RPC: check_approved_booking_overlap() --> approved
  |
  `-- Reject --> admin remarks required --> rejected
  |
  v
Requester Notification and Optional Push Notification
```

## Navigation Structure

```text
RootNavigator
  +-- AuthLoading
  +-- AuthStack
  |   +-- Login
  |   `-- ForgotPassword
  `-- AppStack
      +-- Home
      +-- Halls
      +-- HallDetails
      +-- VenueAvailability
      +-- BookHall
      +-- Bookings
      +-- BookingDetails
      +-- Notifications
      +-- Profile
      +-- ChangePassword
      +-- EditProfile
      +-- Settings
      `-- AdminArea
          +-- AdminDashboard
          +-- PendingRequests
          +-- BookingReview
          +-- AllBookings
          +-- ManageHalls   (super_admin only)
          +-- AddHall       (super_admin only)
          +-- EditHall      (super_admin only)
          +-- Users         (super_admin only)
          +-- AddUser       (super_admin only)
          `-- UserDetails   (super_admin only)
```

## Screens

| Screen | Purpose |
| --- | --- |
| `AuthLoadingScreen` | Shows loading UI while auth session is restored. |
| `LoginScreen` | Logs users in through Supabase Auth. |
| `ForgotPasswordScreen` | Sends password reset email through Supabase Auth. |
| `UserHomeScreen` | Displays dashboard stats, recent bookings, today's halls, and notification badge. |
| `HallListScreen` | Lists and filters active venues with date/time slot selection. |
| `HallDetailsScreen` | Shows detailed hall information. |
| `VenueAvailabilityScreen` | Displays pending/approved bookings for selected hall/date. |
| `BookHallScreen` | Creates booking requests. |
| `MyBookingsScreen` | Lists the current user's bookings. |
| `BookingDetailsScreen` | Shows booking details and allows pending cancellation. |
| `NotificationsScreen` | Lists notifications and read actions. |
| `ProfileScreen` | Shows account details and profile actions. |
| `EditProfileScreen` | Updates full name and department. |
| `ChangePasswordScreen` | Verifies current password and sets a new password. |
| `SettingsScreen` | Settings/account screen. No Supabase query detected directly in current codebase. |
| `AdminDashboardScreen` | Shows pending/approved/rejected/active hall counts. |
| `PendingRequestsScreen` | Lists pending booking requests. |
| `BookingReviewScreen` | Approves/rejects bookings with remarks. |
| `AllBookingsScreen` | Shows booking history with filters. |
| `HallManagementScreen` | Lists all venues for super admin management. |
| `AddHallScreen` | Creates venues. |
| `EditHallScreen` | Updates venues. |
| `UserManagementScreen` | Lists and filters profiles. |
| `AddUserScreen` | Creates users through Edge Function. |
| `UserDetailsScreen` | Shows user details/history and role updates. |
| `AdminPlaceholderScreen` | Placeholder screen; not detected in active navigation. |

## Code Statistics

| Metric | Count |
| --- | ---: |
| Screens | 27 |
| Components | 13 |
| Database tables | 5 |
| RPC/database functions | 13 |
| Hooks files | 1 |
| Context/store files | 1 |
| Supabase Edge Functions | 2 |
| Approximate first-party TypeScript/SQL lines | 9,531 |
| Navigation stacks | 4 |
| Application roles | 3 |

## Project Summary

VenueVerse is approximately 75% complete for an internal college venue booking MVP. The core user booking flow, admin approval flow, super admin management flow, Supabase backend, RLS, storage, realtime notifications, and Edge Functions are implemented. The project still needs full QA, automated tests, production push notification validation, and final alignment between some database columns and UI/service payloads.
