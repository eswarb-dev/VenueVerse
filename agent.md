# VenueVerse Agent Guide

## Role

The coding agent should make scoped, production-safe changes to VenueVerse while preserving booking, auth, notification, role, receipt, and QR workflows unless explicitly asked.

## Working Rules

- Inspect actual files before editing.
- Prefer existing project patterns.
- Keep changes narrow.
- Do not weaken RLS or role checks.
- Do not expose secrets.
- Do not log service role keys, Firebase private keys, SMTP credentials, JWTs, QR tokens, signed URLs, or full push tokens.
- Mask push tokens in diagnostics.
- Run `npm run typecheck` after TypeScript changes.

## Common Commands

```powershell
npm run typecheck
npx expo start -c
npx supabase db push
npx supabase functions deploy send-push-notification
npx eas build -p android --profile preview
npx eas build -p android --profile production
```

## Sensitive Areas

- `src/store/AuthContext.tsx`
- `src/lib/notifications.ts`
- `src/services/bookingService.ts`
- `src/services/bookingApprovalService.ts`
- `src/services/adminService.ts`
- `src/services/receiptService.ts`
- `supabase/functions/*`
- `supabase/migrations/*`
- `app.json`
- `android/`

## Push Notification Principles

- Settings test is local-only.
- Server booking events must use remote push.
- Realtime updates in-app state only.
- Do not schedule local OS notifications for server-created notification rows.
- Backend sends to all active tokens for a target user.
- Token column is `expo_push_token`.

## Receipt Principles

- PDF attachment is mandatory for receipt email success.
- Email can be marked sent only after Gmail SMTP succeeds with attachment.
- Signed link is fallback/convenience, not a replacement for attachment.
- Do not change receipt design unless explicitly requested.

