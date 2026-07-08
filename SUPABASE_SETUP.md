# Supabase Setup

This guide explains how to configure Supabase for VenueVerse.

## 1. Create a Supabase Project

1. Sign in to Supabase.
2. Create a new project.
3. Choose an organization, project name, database password, and region.
4. Wait for the project to finish provisioning.
5. Open Project Settings and copy:
   - Project URL
   - Anon public key

## 2. Run the SQL Schema

1. Open the Supabase SQL Editor.
2. Create a new query.
3. Paste the full contents of `supabase/schema.sql`.
4. Run the query.

The schema creates:

- `profiles`
- `halls`
- `bookings`
- `notifications`
- `push_tokens`
- indexes
- RPC functions
- triggers
- RLS policies
- `hall-images` storage bucket
- storage policies
- realtime publication entry for notifications

## 3. Confirm Extensions

The schema enables:

```sql
create extension if not exists pgcrypto;
```

This is required for `gen_random_uuid()`.

## 4. Enable Row Level Security

The SQL script enables RLS on:

- `profiles`
- `halls`
- `bookings`
- `notifications`
- `push_tokens`

Confirm this in Supabase:

1. Open Table Editor.
2. Select each table.
3. Verify Row Level Security is enabled.

## 5. Policies Added by the Schema

### Profiles

- Users can read their own profile.
- Admin and super admin users can read all profiles.
- Users can update their own profile.
- Users can insert their own profile with role `user`.
- Only super admin users can update roles.
- A trigger prevents non-super-admin role changes.

### Halls

- Authenticated users can read active halls.
- Admin and super admin users can read all halls.
- Admin and super admin users can insert and update halls.
- Only super admin users can delete halls.

### Bookings

- Users can create bookings only for themselves.
- Users can read only their own bookings.
- Admin and super admin users can read all bookings.
- Users can cancel only their own pending bookings.
- Admin and super admin users can approve or reject bookings.
- Triggers restrict protected booking field updates.
- Triggers enforce booking overlap protection.

### Notifications

- Users can read their own notifications.
- Users can update their own notifications for read-state changes.
- Users can insert notifications only for themselves.
- Admin and super admin users can insert notifications.

### Push Tokens

- Users can insert, update, read, and delete only their own Expo push tokens.
- Admin and super admin users can read push tokens for server-side notification delivery.

## 6. Storage Bucket Setup

The SQL script creates a public Supabase Storage bucket:

```text
hall-images
```

Storage policies allow:

- Authenticated users to read hall images.
- Admin and super admin users to upload hall images.
- Admin and super admin users to update hall images.
- Admin and super admin users to delete hall images.

If the bucket does not appear after running the SQL:

1. Open Storage.
2. Create a bucket named `hall-images`.
3. Set it to public.
4. Re-run the storage policy section from `supabase/schema.sql`.

## 7. Realtime Setup

The schema adds `notifications` to the `supabase_realtime` publication if it is not already present.

Confirm realtime behavior:

1. Open Database.
2. Open Replication or Realtime settings.
3. Confirm `public.notifications` is enabled.

The app uses realtime to update unread notification counts when a new notification is inserted for the current user.

## 8. Environment Variables

Create `.env` in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Do not use the service role key in the mobile app.

## 9. Deploy Push Notification Edge Function

The app calls the `send-push-notification` Supabase Edge Function when booking requests, approvals, and rejections happen.

Deploy it with the Supabase CLI:

```bash
supabase functions deploy send-push-notification
```

The function requires these Supabase-managed environment variables:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Do not add the service role key to `.env` or any mobile app file.

## 10. Expo Push Testing

The app uses:

- `expo-notifications`
- `expo-device`
- `expo-constants`

Expo push token registration requires an EAS project ID. After linking the app with EAS, add the project ID to `app.json`:

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

If `projectId` is missing, the app skips push token registration instead of calling the deprecated Expo token API path.

For reliable background and closed-app push testing, use an EAS development build or production build on a physical phone. Expo Go is not the final test target for production push behavior.

## 11. Create Initial Admin Users

New users are created with role `user`. To create the first super admin:

1. Register normally in the app.
2. Open Supabase Table Editor.
3. Go to `profiles`.
4. Find the registered profile.
5. Change `role` to `super_admin`.

After the first super admin exists, role changes can be managed inside the app.

## 12. Seed Example Halls

Use the Table Editor or SQL Editor to add initial halls:

```sql
insert into public.halls (name, block, floor, capacity, facilities, is_active)
values
  ('Main Seminar Hall', 'Academic Block A', 'Ground Floor', 250, array['Projector', 'Microphone', 'Speakers', 'AC'], true),
  ('Conference Room 1', 'Admin Block', 'First Floor', 60, array['Projector', 'Wi-Fi', 'Whiteboard'], true);
```

## 13. Connect the App

1. Install dependencies with `npm install`.
2. Add `.env`.
3. Start Expo:

```bash
npm start
```

4. Register a user and confirm the profile appears in Supabase.
