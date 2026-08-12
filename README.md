# VenueVerse

VenueVerse is a college venue booking and approval app for users and admins. Users can browse halls, check availability, submit booking requests, track request status, and receive in-app notifications. Admins can review requests, approve or reject bookings, manage hall records, manage users, and control user roles.

## Tech Stack

- React Native with Expo
- TypeScript
- Supabase Auth
- Supabase PostgreSQL
- Supabase Storage
- Supabase Realtime
- Supabase Edge Functions
- Expo Notifications
- React Navigation Native Stack
- Expo SecureStore
- date-fns

## Features

- Email/password authentication with secure session persistence
- Admin account creation with temporary passwords
- Role-based navigation for users and admins
- Hall browsing with search, capacity filters, facility filters, and detail screens
- Venue availability lookup by hall and date
- Booking request form with validation and database overlap checks
- User booking history with status filters and cancellation for pending requests
- Admin dashboard with booking and hall counts
- Pending request review with approval and rejection workflows
- Conflict prevention during user booking and admin approval
- Hall management with active/inactive status and Supabase Storage image uploads
- Admin user management and role changes
- In-app notifications with unread badge and realtime updates
- Expo push notifications for booking requests, approvals, and rejections
- Professional institutional UI with shared theme, buttons, inputs, cards, badges, loading, empty, and error states

## User Roles

| Role | Access |
| --- | --- |
| `user` | Browse active halls, check availability, create booking requests, view own bookings, cancel pending bookings, read notifications, edit own profile. |
| `admin` | Access admin dashboard, review all bookings, approve or reject requests, create notifications, manage halls, manage users, create accounts, and update roles. |

## Account Creation

Accounts are created only by an admin from the Users tab. Users receive a temporary password and can change it from Profile after signing in.

## Installation

1. Install Node.js LTS.
2. Install Expo tooling if needed:

```bash
npm install -g expo
```

3. Install project dependencies:

```bash
npm install
```

4. Create a Supabase project and run the SQL in `supabase/schema.sql`.
5. Copy `.env.example` to `.env` and fill in your Supabase credentials.

## Environment Variables

The app uses Expo public environment variables:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

These values are read in `src/lib/supabase.ts`.

## Running the App

Start the Expo development server:

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

Type-check the project:

```bash
npm run typecheck
```

## Screenshots

Add production screenshots here after connecting the app to a seeded Supabase project.

| Screen | Screenshot |
| --- | --- |
| Login | Placeholder |
| User Home | Placeholder |
| Hall Details | Placeholder |
| Booking Form | Placeholder |
| Admin Dashboard | Placeholder |
| Booking Review | Placeholder |

## Project Structure

```text
src/
  components/      Reusable UI components
  constants/       Theme and facility constants
  hooks/           Shared hooks
  lib/             Supabase client setup
  navigation/      Root, auth, app, and admin navigation
  screens/         Feature screens grouped by domain
  services/        Supabase data access services
  store/           Auth context and global app state
  types/           TypeScript domain types
  utils/           Shared utility functions
supabase/
  schema.sql       Database schema, RLS policies, triggers, storage setup
  functions/       Supabase Edge Functions for server-side push delivery
```

## Push Notifications

VenueVerse registers the device's Expo push token after login and stores it in Supabase `push_tokens`. Booking request, approval, and rejection flows keep the existing in-app notifications and additionally call the `send-push-notification` Supabase Edge Function, which sends messages to Expo Push API.

Expo push tokens require an EAS project ID. After creating/linking the EAS project, add it to `app.json`:

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

For reliable phone push testing, use an EAS development build or production build. Expo Go can be useful for partial checks, but final notification behavior should be verified on a real device build. Expo Go may still show Expo Go branding or skip the final Android notification icon, so treat development builds, APKs, and EAS preview builds as the source of truth for notification branding.

## Future Enhancements

- Calendar-style venue availability view
- Booking edit/reschedule workflow
- Recurring booking requests
- Advanced admin analytics and export reports
- Department-level approval chains
- Audit log for admin actions
- Attachment uploads for event documents
- Offline-friendly cache for halls and bookings
