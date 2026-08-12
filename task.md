# VenueVerse Task List

## Current Priorities

- Verify release APK push token row appears after login and notification toggle ON.
- Test direct Expo push to release APK token.
- Test booking request push to department admin.
- Test approval/rejection push to requester from Home and Admin Area.
- Test receipt email push after Gmail SMTP success.
- Rebuild preview APK after native/config changes.

## Verification Checklist

### TypeScript

```powershell
npm run typecheck
```

### Realtime

- Notifications insert appears without refresh.
- Notifications update read state without refresh.
- Admin Home pending list refreshes after new request.
- My Bookings updates after approval/rejection.
- Booking Details updates after approval/rejection.

### Push

- `push_tokens` has active release APK token.
- Token has `application_id = com.srec.venueverse` where available.
- Backend sends to all active tokens.
- Expo ticket is returned.
- Expo receipt is checked.
- `DeviceNotRegistered` tokens are disabled.

### Receipt

- Receipt PDF preview fallback does not crash unsupported runtimes.
- Download works.
- Share works.
- Email PDF copy sends attachment.
- Queue jobs are not duplicated.

## Build Commands

Preview APK:

```powershell
npx eas build -p android --profile preview
```

Production AAB:

```powershell
npx eas build -p android --profile production
```

Before installing a new APK:

```powershell
adb uninstall com.srec.venueverse
```

