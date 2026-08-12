# VenueVerse Architecture

## Client

- React Native + Expo + TypeScript
- Navigation: React Navigation native stack and bottom tabs
- Auth/session: Supabase Auth through `src/store/AuthContext.tsx`
- Theme tokens: `src/constants/theme.ts`
- Notifications: `src/lib/notifications.ts`, `src/hooks/useNotifications.tsx`
- Booking services: `src/services/bookingService.ts`, `src/services/bookingApprovalService.ts`, `src/services/adminService.ts`
- Receipt services: `src/services/receiptService.ts`

## Backend

- Supabase Postgres
- Supabase Auth
- Supabase Storage for generated receipt PDFs
- Supabase Realtime for visible app updates
- Supabase Edge Functions for privileged workflows

## Important Tables

- `profiles`
- `halls`
- `bookings`
- `notifications`
- `push_tokens`
- `booking_receipts`
- `receipt_email_jobs`
- `app_healthcheck`

## Realtime

Realtime is used for open-screen updates:

- `notifications`: insert/update for user notification cards and unread count
- `bookings`: booking status/list updates for Home, My Bookings, and Booking Details

Realtime is not used to create native OS notifications. Native notifications are sent through the backend push path.

## Push Notifications

Android remote push flow:

```text
Release APK registers ExpoPushToken
-> token saved in public.push_tokens.expo_push_token
-> backend Edge Function loads active tokens
-> Expo Push Service
-> FCM
-> Android notification tray
```

Local notification flow:

```text
Settings test button
-> scheduleVenueVerseLocalNotification()
-> Android local notification
```

## Receipt Pipeline

Receipt flow:

```text
booking approved/rejected
-> generate-booking-receipt Edge Function
-> PDF generated
-> stored in Supabase Storage
-> receipt metadata stored in booking_receipts
-> optional email queue / manual PDF copy
```

Email queue:

```text
receipt_email_jobs
-> process-receipt-email-queue
-> Gmail SMTP
-> PDF attachment
-> notification/push after successful send
```

## Native Build Notes

Because the project has an `android/` folder, native config changes require a rebuild. Metro cache alone is not enough for native module or app icon changes.

