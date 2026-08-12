# VenueVerse Decisions

## D1: Supabase Remains Primary Backend

Firebase is used only for Android FCM transport through Expo push notifications. Supabase remains the source of truth for auth, bookings, notifications, storage, receipts, and Edge Functions.

## D2: Push Token Column

The actual push token column is:

```text
public.push_tokens.expo_push_token
```

Queries must not use a nonexistent `token` column.

## D3: Multiple Device Tokens

Push tokens are unique by:

```text
(user_id, expo_push_token)
```

This allows Expo Go, preview APK, production AAB, and multiple devices to coexist.

## D4: Local vs Remote Notifications

Local notifications are used only for Settings test/local device events.

Remote push notifications are used for:

- new booking request
- booking approved
- booking rejected
- receipt PDF email sent

## D5: Realtime Does Not Replace Push

Supabase Realtime updates visible screens while the app is open. It does not deliver Android tray notifications when the app is backgrounded or terminated.

## D6: Receipt Email PDF Attachment

Receipt email success requires valid PDF bytes and a real attachment. Signed links may be included as convenience, but they do not replace the attachment.

## D7: Auth UI Scope

Get Started and Login visual changes must not modify auth logic, validation, navigation behavior, or backend calls.

## D8: Native Rebuild Requirement

Changes to native modules, notification icons, app icons, Firebase config, or Android resources require APK/AAB rebuild.

