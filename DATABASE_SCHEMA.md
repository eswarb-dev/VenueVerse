# Database Schema

This project uses Supabase PostgreSQL with Row Level Security enabled on all application tables. The full database setup is maintained in `supabase/schema.sql`.

## Tables

## `profiles`

Stores application profile data for authenticated Supabase users.

| Column | Type | Details |
| --- | --- | --- |
| `id` | `uuid` | Primary key. References `auth.users(id)` with cascade delete. |
| `full_name` | `text` | Required display name. |
| `email` | `text` | Required and unique. |
| `department` | `text` | Optional department name. |
| `role` | `text` | Required. Defaults to `user`. |
| `register_number` | `text` | Student register number or staff ID. |
| `phone` | `text` | Optional contact number. |
| `created_at` | `timestamp with time zone` | Defaults to `now()`. |

Allowed roles:

- `user`
- `admin`
- `super_admin`

## `halls`

Stores seminar halls and bookable venues.

| Column | Type | Details |
| --- | --- | --- |
| `id` | `uuid` | Primary key. Defaults to `gen_random_uuid()`. |
| `name` | `text` | Required hall name. |
| `block` | `text` | Optional block or building. |
| `floor` | `text` | Optional floor. |
| `capacity` | `integer` | Required. Must be greater than 0. |
| `facilities` | `text[]` | Facility list such as Projector, AC, Wi-Fi, Stage. |
| `image_url` | `text` | Public Supabase Storage URL for the hall image. |
| `is_active` | `boolean` | Defaults to `true`. Inactive halls are hidden from normal users. |
| `created_at` | `timestamp with time zone` | Defaults to `now()`. |

## `bookings`

Stores booking requests and approval state.

| Column | Type | Details |
| --- | --- | --- |
| `id` | `uuid` | Primary key. Defaults to `gen_random_uuid()`. |
| `hall_id` | `uuid` | References `halls(id)` with cascade delete. |
| `user_id` | `uuid` | References `profiles(id)` with cascade delete. |
| `event_title` | `text` | Required event title. |
| `event_type` | `text` | Optional event category. |
| `purpose` | `text` | Optional purpose or description. |
| `department` | `text` | Optional requesting department. |
| `audience_count` | `integer` | Optional, but if provided must be greater than 0. |
| `faculty_coordinator` | `text` | Optional coordinator name. |
| `additional_requirements` | `text` | Optional extra setup needs. |
| `start_time` | `timestamp with time zone` | Required booking start. |
| `end_time` | `timestamp with time zone` | Required booking end. Must be after start. |
| `status` | `text` | Required. Defaults to `pending`. |
| `admin_remarks` | `text` | Optional rejection or approval remarks. |
| `approved_by` | `uuid` | References `profiles(id)`. |
| `created_at` | `timestamp with time zone` | Defaults to `now()`. |
| `updated_at` | `timestamp with time zone` | Automatically updated on booking changes. |

Allowed statuses:

- `pending`
- `approved`
- `rejected`
- `cancelled`
- `completed`

## `notifications`

Stores in-app notifications for users.

| Column | Type | Details |
| --- | --- | --- |
| `id` | `uuid` | Primary key. Defaults to `gen_random_uuid()`. |
| `user_id` | `uuid` | References `profiles(id)` with cascade delete. |
| `title` | `text` | Required notification title. |
| `message` | `text` | Required notification body. |
| `is_read` | `boolean` | Defaults to `false`. |
| `booking_id` | `uuid` | Optional booking link. References `bookings(id)` with `on delete set null`. |
| `created_at` | `timestamp with time zone` | Defaults to `now()`. |

## `push_tokens`

Stores Expo push tokens for logged-in devices.

| Column | Type | Details |
| --- | --- | --- |
| `id` | `uuid` | Primary key. Defaults to `gen_random_uuid()`. |
| `user_id` | `uuid` | References `profiles(id)` with cascade delete. |
| `expo_push_token` | `text` | Expo push token returned by `expo-notifications`. |
| `platform` | `text` | Device platform such as `android` or `ios`. |
| `device_name` | `text` | Optional device name from Expo Device. |
| `created_at` | `timestamp with time zone` | Defaults to `now()`. |
| `updated_at` | `timestamp with time zone` | Automatically updated on token changes. |

Unique constraint:

- `(user_id, expo_push_token)`

## Relationships

- `profiles.id` maps one-to-one with `auth.users.id`.
- `bookings.hall_id` references `halls.id`.
- `bookings.user_id` references `profiles.id`.
- `bookings.approved_by` references `profiles.id`.
- `notifications.user_id` references `profiles.id`.
- `notifications.booking_id` references `bookings.id`.
- `push_tokens.user_id` references `profiles.id`.

## Constraints

- `profiles.role` must be `user`, `admin`, or `super_admin`.
- `halls.capacity` must be greater than 0.
- `bookings.end_time` must be greater than `bookings.start_time`.
- `bookings.audience_count` must be null or greater than 0.
- `bookings.status` must be `pending`, `approved`, `rejected`, `cancelled`, or `completed`.

## Indexes

| Index | Columns | Purpose |
| --- | --- | --- |
| `bookings_hall_id_idx` | `bookings(hall_id)` | Hall booking lookup and conflict checks. |
| `bookings_user_id_idx` | `bookings(user_id)` | User booking history. |
| `bookings_status_idx` | `bookings(status)` | Pending, approved, rejected filtering. |
| `bookings_start_time_idx` | `bookings(start_time)` | Date and availability queries. |
| `bookings_end_time_idx` | `bookings(end_time)` | Date and availability queries. |
| `notifications_user_id_idx` | `notifications(user_id)` | User notification lists and unread counts. |
| `push_tokens_user_id_idx` | `push_tokens(user_id)` | Expo push token lookup for notification delivery. |

## RPC Functions

### `check_booking_overlap(selected_hall_id, new_start_time, new_end_time)`

Returns `true` when a pending or approved booking already overlaps the selected hall and time range.

Overlap logic:

```sql
existing.start_time < new_end_time
and existing.end_time > new_start_time
```

Used before a user submits a booking request.

### `check_approved_booking_overlap(selected_hall_id, booking_to_ignore, new_start_time, new_end_time)`

Returns `true` when an approved booking overlaps the selected hall and time range, excluding the booking currently under review.

Used before an admin approves a pending request.

### `is_admin()`, `is_super_admin()`, `is_admin_or_super_admin()`

Security helper functions used by RLS policies to determine role-based access.

### `create_admin_booking_notifications(booking_to_notify)`

Creates in-app notifications for admin and super admin users when a new booking request is submitted, then returns the recipient user IDs used by the app to call the push notification Edge Function.

## Triggers

| Trigger | Table | Purpose |
| --- | --- | --- |
| `set_booking_updated_at` | `bookings` | Updates `updated_at` before each booking update. |
| `set_push_token_updated_at` | `push_tokens` | Updates `updated_at` before each push token update. |
| `enforce_booking_overlap_rules` | `bookings` | Blocks overlapping pending/approved inserts and conflicting approved updates. |
| `prevent_profile_role_update` | `profiles` | Prevents non-super-admin users from changing profile roles. |
| `handle_new_user_profile` | `auth.users` | Creates a default `profiles` row when a Supabase Auth user is created. |
| `enforce_booking_update_rules` | `bookings` | Restricts users to cancelling own pending bookings and admins to review metadata updates. |
| `enforce_notification_update_rules` | `notifications` | Restricts notification updates to read-state changes for the owning user. |
