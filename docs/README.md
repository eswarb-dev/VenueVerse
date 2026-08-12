# VenueVerse Quick Start

## Documentation Index

- [Project Documentation](./PROJECT_DOCUMENTATION.md): Complete project overview, features, roles, navigation, screens, and statistics.
- [Supabase Documentation](./SUPABASE_DOCUMENTATION.md): Database tables, RLS, RPCs, triggers, storage, auth, realtime, and setup.
- [API Reference](./API_REFERENCE.md): Supabase queries, mutations, RPCs, Edge Functions, and notification operations.
- [Changelog](./CHANGELOG.md): Inferred implementation timeline.
- [Future Roadmap](./FUTURE_ROADMAP.md): Limitations, planned features, and suggested milestones.

## Project Summary

VenueVerse is a React Native + Expo mobile application backed by Supabase for college venue booking and approval. Users can book venues, and admins can approve or reject requests, manage users, and manage venues.

Accounts are created only by an admin from the Users tab. Users receive a temporary password and can change it from Profile after signing in.

## Requirements

- Node.js LTS.
- npm.
- Expo tooling.
- Supabase project.
- Supabase schema from `supabase/schema.sql`.
- EAS project id for production-ready push notifications.

## Install

```bash
npm install
```

## Environment Variables

Create `.env` in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Do not place the Supabase service role key in the mobile app.

## Run Locally

```bash
npm start
```

Run on Android:

```bash
npm run android
```

Run on iOS:

```bash
npm run ios
```

Run on web:

```bash
npm run web
```

Type-check:

```bash
npm run typecheck
```

## Supabase Setup

1. Create a Supabase project.
2. Run the SQL in `supabase/schema.sql`.
3. Confirm RLS is enabled on all application tables.
4. Confirm the `hall-images` storage bucket exists.
5. Deploy Edge Functions:

```bash
supabase functions deploy send-push-notification
supabase functions deploy admin-create-user
```

6. Configure function environment variables in Supabase:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

## Push Notifications

Add the EAS project id in `app.json`:

```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "your-eas-project-id"
      }
    }
  }
}
```

Expo Go is useful for development, but production push notification validation should happen on an EAS development or production build.

## First Admin

The schema currently promotes `eswar.2411018@srec.ac.in` to `admin`. For any other first admin account, create or invite the first account through Supabase, then update the profile role manually to `admin`.
