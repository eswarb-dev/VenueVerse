# VenueVerse API Reference

## Overview

VenueVerse does not use a custom REST API server. The mobile app talks directly to Supabase through:

- Supabase Auth methods.
- Supabase table queries and mutations.
- Supabase RPC functions.
- Supabase Storage.
- Supabase Realtime.
- Supabase Edge Functions.

Public self-registration is not implemented. The app does not call `supabase.auth.signUp()` from public screens. Account creation happens through `admin-create-user` from the admin Add User screen.

## Auth Operations

| Operation | Supabase Call | Source | Purpose |
| --- | --- | --- | --- |
| Get session | `supabase.auth.getSession()` | `src/store/AuthContext.tsx` | Restore existing session on app start. |
| Listen for auth state | `supabase.auth.onAuthStateChange()` | `src/store/AuthContext.tsx` | Keep session/profile state synced. |
| Login | `supabase.auth.signInWithPassword()` | `src/store/AuthContext.tsx` | Authenticate user. |
| Forgot password send OTP | `supabase.auth.resetPasswordForEmail()` with no redirect URL | `src/services/passwordResetService.ts` | Send reset OTP through Supabase Gmail SMTP. |
| Forgot password verify OTP | `supabase.auth.verifyOtp({ type: 'recovery' })` | `src/services/passwordResetService.ts` | Verify reset code and establish a recovery session. |
| Forgot password update | `supabase.auth.updateUser({ password })` | `src/services/passwordResetService.ts` | Set new password after OTP verification. |
| Logout | `supabase.auth.signOut()` | `src/store/AuthContext.tsx` | End session. |
| Change password verify | `supabase.auth.signInWithPassword()` | `src/screens/profile/ChangePasswordScreen.tsx` | Verify current password. |
| Change password update | `supabase.auth.updateUser()` | `src/screens/profile/ChangePasswordScreen.tsx` | Set new password. |

## Profile Queries and Mutations

| Function | Operation | Supabase Access |
| --- | --- | --- |
| `fetchProfile(userId)` | Read one profile by id. | `profiles.select(...).eq('id', userId).maybeSingle()` |
| `listProfiles()` | List profiles for user management. | `profiles.select(...).order('full_name')` |
| `getProfileById(userId)` | Read one profile for user details. | `profiles.select(...).eq('id', userId).maybeSingle()` |
| `updateUserRole(userId, role)` | Update user role. | `profiles.update({ role }).eq('id', userId)` |
| `createAdminUser(input)` | Create user through secure admin Edge Function. | `functions.invoke('admin-create-user')` |
| `updateOwnProfile(userId, input)` | Update current user's profile. | `profiles.update(...).eq('id', userId).select(...).single()` |
| `getUserBookingHistory(userId)` | Read bookings for user detail/history. | `bookings.select(...halls...).eq('user_id', userId)` |

## Hall Queries and Mutations

| Function | Operation | Supabase Access |
| --- | --- | --- |
| `getActiveHalls()` | Read active halls for normal users. | `halls.select(...).eq('is_active', true).order('name')` |
| `getAllHalls()` | Read all halls for management. | `halls.select(...).order('name')` |
| `getHallById(id)` | Read a single hall. | `halls.select(...).eq('id', id).maybeSingle()` |
| `createHall(input)` | Insert hall. | `halls.insert(...)` |
| `updateHall(id, input)` | Update hall. | `halls.update(...).eq('id', id)` |
| `deleteHall(id)` | Delete hall. | `halls.delete().eq('id', id)` |
| `uploadHallImage(uri, fileName)` | Upload image and return public URL. | `storage.from('hall-images').upload(...)`, `getPublicUrl(...)` |

## Booking Queries and Mutations

| Function | Operation | Supabase Access |
| --- | --- | --- |
| `getUserBookingStats(userId)` | Count user's pending/approved/rejected bookings. | `bookings.select('status').eq('user_id', userId).in('status', ...)` |
| `getUserBookingsCount(userId)` | Count all user bookings. | `bookings.select(..., { count: 'exact', head: true }).eq('user_id', userId)` |
| `getRecentUserBookings(userId)` | Read five recent bookings. | `bookings.select(...halls...).eq('user_id', userId).order(...).limit(5)` |
| `getTodayBookedHalls()` | Read today's pending/approved bookings. | RPC `get_today_booked_halls`; falls back to `bookings.select(...halls...)` |
| `getUserBookings(userId)` | Read all bookings owned by user. | `bookings.select(...halls...).eq('user_id', userId)` |
| `getBookingDetails(bookingId)` | Read one booking with hall and approver details. | `bookings.select(...halls..., approver:approved_by(...)).eq('id', bookingId).maybeSingle()` |
| `cancelBooking(bookingId)` | Set pending booking to cancelled. | `bookings.update({ status: 'cancelled' }).eq('id', bookingId)` |
| `checkBookingOverlap(params)` | Check pending/approved overlap. | RPC `check_booking_overlap` |
| `getHallAvailabilityForDate(params)` | Read pending/approved bookings overlapping selected date. | `bookings.select(...).eq('hall_id', ...).in('status', ...).lt(...).gt(...)` |
| `getUnavailableHallIdsForSlot(params)` | Find unavailable halls for time slot. | `bookings.select('hall_id').in('status', ...).lt(...).gt(...)` |
| `getBookingsForDate(params)` | Read all bookings overlapping a day. | `bookings.select(...).in('status', ...).lt(...).gt(...)` |
| `getBookingDateKeysForRange(params)` | Get dates with bookings in range. | `bookings.select('start_time').in('status', ...).gte(...).lt(...)` |
| `createBookingRequest(input)` | Insert pending booking and notify admins. | RPC `check_booking_overlap`, `bookings.insert`, RPC `create_admin_booking_notifications` |

## Admin Queries and Mutations

| Function | Operation | Supabase Access |
| --- | --- | --- |
| `getAdminDashboardStats()` | Count pending, approved, rejected, and active halls. | `bookings` count by status, `halls` count active |
| `getPendingRequests()` | Read pending bookings. | `bookings.select(...profiles..., halls...).eq('status', 'pending')` |
| `getAllAdminBookings(status?)` | Read all bookings, optionally by status. | `bookings.select(...profiles..., halls...).order('created_at')` |
| `getAdminBookingDetails(bookingId)` | Read booking with requester, hall, approver. | `bookings.select(...requester:user_id(...), approver:approved_by(...))` |
| `approveBooking(booking, adminId, remarks)` | Approve booking after conflict check. | RPC `check_approved_booking_overlap`, `bookings.update({ status: 'approved', approved_by, admin_remarks })` |
| `rejectBooking(booking, remarks)` | Reject booking with remarks. | `bookings.update({ status: 'rejected', admin_remarks })` |

## Notification Queries and Mutations

| Function | Operation | Supabase Access |
| --- | --- | --- |
| `getUnreadNotificationCount(userId)` | Count unread notifications. | `notifications.select(..., { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false)` |
| `getUserNotifications(userId)` | Read notifications. | `notifications.select(...).eq('user_id', userId).order('is_read').order('created_at')` |
| `markNotificationRead(notificationId)` | Mark one notification read. | `notifications.update({ is_read: true }).eq('id', notificationId)` |
| `markAllNotificationsRead(userId)` | Mark all unread notifications read. | `notifications.update({ is_read: true }).eq('user_id', userId).eq('is_read', false)` |
| `createNotification(params)` | Insert notification. | `notifications.insert(...)` |
| `getNotificationBookingDetails(bookingId)` | Read booking title and hall for notification detail. | `bookings.select(...halls...).eq('id', bookingId).maybeSingle()` |
| `subscribeToNotifications(userId, onInsert)` | Subscribe to inserted notifications. | `channel(...).on('postgres_changes', { event: 'INSERT', table: 'notifications', filter })` |

## Push Notification Operations

| Function | Operation | Supabase/Expo Access |
| --- | --- | --- |
| `configurePushNotifications()` | Configure Android channel and notification handler. | Expo Notifications |
| `registerForPushNotificationsAsync()` | Request permission and get Expo push token. | Expo Notifications, Device, Constants |
| `savePushToken(userId, token)` | Upsert device token. | `push_tokens.upsert(..., { onConflict: 'user_id,expo_push_token' })` |
| `registerAndSavePushToken(userId)` | Register token after login/session. | Expo Notifications + `push_tokens` |
| `sendPushNotification(params)` | Invoke Edge Function. | `functions.invoke('send-push-notification')` |
| `subscribeToPushNotificationResponses()` | Navigate when notification is tapped. | Expo Notifications listener |

## RPC Reference

### `check_booking_overlap`

Parameters:

| Name | Type |
| --- | --- |
| `selected_hall_id` | `uuid` |
| `new_start_time` | `timestamp with time zone` |
| `new_end_time` | `timestamp with time zone` |

Returns: `boolean`.

Purpose: Returns `true` when a pending or approved booking overlaps the selected venue and time range.

### `check_approved_booking_overlap`

Parameters:

| Name | Type |
| --- | --- |
| `selected_hall_id` | `uuid` |
| `booking_to_ignore` | `uuid` |
| `new_start_time` | `timestamp with time zone` |
| `new_end_time` | `timestamp with time zone` |

Returns: `boolean`.

Purpose: Returns `true` when an approved booking conflicts with the booking under review.

### `get_today_booked_halls`

Parameters:

| Name | Type |
| --- | --- |
| `day_start` | `timestamptz` |
| `day_end` | `timestamptz` |

Returns table:

- `booking_id`
- `hall_id`
- `hall_name`
- `department`
- `venue_type`
- `location`
- `event_title`
- `start_time`
- `end_time`
- `status`
- `created_at`

### `create_admin_booking_notifications`

Parameters:

| Name | Type |
| --- | --- |
| `booking_to_notify` | `uuid` |

Returns: table of recipient `user_id` values.

Purpose: Inserts admin notifications for a newly submitted booking.

## Edge Function Reference

### `admin-create-user`

Method: `POST`

Purpose: Create a Supabase Auth user and matching profile. Caller must be an `admin`.

Body:

```json
{
  "full_name": "Example User",
  "email": "user@srec.ac.in",
  "temporary_password": "password123",
  "role": "user",
  "department": "IT"
}
```

Success response:

```json
{
  "success": true,
  "user_id": "uuid",
  "email": "user@srec.ac.in"
}
```

Validation:

- Full name required.
- Email must end with `@srec.ac.in`.
- Temporary password must be at least 6 characters.
- Role must be `user` or `admin`.
- Department must be in the allowed department list.

### `send-push-notification`

Method: `POST`

Purpose: Send Expo push notifications to all valid tokens saved for a user.

Body:

```json
{
  "user_id": "target-user-uuid",
  "title": "Booking approved",
  "body": "Your booking request has been approved.",
  "data": {
    "type": "booking_approved",
    "booking_id": "booking-uuid"
  }
}
```

Success response:

```json
{
  "ok": true,
  "sent": 1
}
```

Authorization behavior:

- Caller can notify self.
- Admin can notify users.
- Booking requester can notify admins for `new_booking_request`.
- Invalid or unregistered Expo tokens are ignored or cleaned up when Expo reports `DeviceNotRegistered`.
