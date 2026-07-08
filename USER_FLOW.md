# User Flow

This document describes the primary application flows for students, staff, admins, and super admins.

## User Booking Flow

1. A user registers with full name, college email, password, department, register number or staff ID, and phone number.
2. Supabase Auth creates the auth user.
3. A `profiles` row is created with the default role `user`.
4. The user logs in and is routed to the normal app experience.
5. The home screen shows:
   - Greeting with the user's name
   - Pending, approved, and rejected booking counts
   - Recent booking preview
   - Notification badge
   - Quick action to book a venue
6. The user opens the hall list.
7. The app loads active halls from Supabase.
8. The user can search by hall name and filter by capacity or facilities.
9. The user opens a hall detail screen to review image, location, capacity, facilities, and availability options.
10. The user can check venue availability by selecting a hall and date.
11. The user submits a booking request with event details, date, time, audience count, coordinator, and requirements.
12. The app validates:
    - Required fields
    - Audience count greater than 0
    - Audience count not exceeding hall capacity
    - Date not in the past
    - End time after start time
13. The app calls `check_booking_overlap`.
14. The database trigger `enforce_booking_overlap_rules` also protects against direct overlapping inserts.
15. If no overlap exists, the booking is inserted with `status = pending`.
16. The user is sent to booking history and sees the request as pending.

## User Booking Management Flow

1. The user opens My Bookings.
2. The app loads only bookings owned by the current user.
3. The user can filter by:
   - All
   - Pending
   - Approved
   - Rejected
   - Cancelled
   - Completed
4. The user opens a booking detail screen.
5. If the booking is pending, the user can cancel it.
6. Cancellation updates the booking status to `cancelled`.
7. Users cannot cancel approved, rejected, completed, or already cancelled bookings.
8. RLS and triggers prevent users from updating approval status or other protected booking fields directly.

## Admin Approval Flow

1. An admin or super admin logs in.
2. The root navigator routes the account to the admin stack.
3. The dashboard shows:
   - Total pending requests
   - Total approved bookings
   - Total rejected bookings
   - Total active halls
4. The admin opens Pending Requests.
5. The app loads all bookings with `status = pending`.
6. The admin opens a booking review screen.
7. The review screen shows:
   - Complete booking details
   - Requester profile details
   - Hall details
   - Admin remarks input
8. To approve:
   - The app calls `check_approved_booking_overlap`.
   - The database trigger also prevents conflicting approved bookings.
   - If no conflict exists, the booking is updated to `approved`.
   - `approved_by` is set to the current admin profile id.
   - A notification is created for the requester.
9. To reject:
   - Admin remarks are required.
   - The booking is updated to `rejected`.
   - The rejection reason is stored in `admin_remarks`.
   - A notification is created for the requester.

## Hall Management Flow

1. Admin and super admin users open Manage Halls from the admin dashboard.
2. The screen lists all halls, including active and inactive records.
3. Admins can search halls and filter by active or inactive status.
4. Admins can add a new hall with:
   - Hall name
   - Block
   - Floor
   - Capacity
   - Facilities
   - Image
   - Active status
5. Hall images are uploaded to the `hall-images` Supabase Storage bucket.
6. Admins can edit hall details and mark halls inactive.
7. Normal users only see active halls and never see hall management routes.
8. RLS prevents normal users from inserting, updating, or deleting halls.

## Notification Flow

1. Notifications are stored in the `notifications` table.
2. Admin actions create notifications after approval or rejection.
3. User cancellation creates a notification for the same user.
4. The home screen shows an unread notification count badge.
5. The notification screen lists unread notifications first.
6. Users can mark one notification as read.
7. Users can mark all notifications as read.
8. Supabase Realtime listens for new notifications for the current user and updates the badge automatically.

## Super Admin User Management Flow

1. A super admin opens Users from the admin dashboard.
2. The user list supports search by name, email, and register number.
3. The list supports filtering by role and department.
4. The super admin opens a user detail screen.
5. The screen shows user details and booking history.
6. The super admin can change the role to:
   - `user`
   - `admin`
   - `super_admin`
7. A confirmation dialog appears before changing roles.
8. RLS and triggers prevent normal users and admins from changing roles.

