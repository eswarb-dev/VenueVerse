# Testing Checklist

Use this checklist before demo, deployment, or handoff.

## Authentication Tests

- [ ] New user can register with valid full name, email, password, department, register number or staff ID, and phone number.
- [ ] Registration rejects missing full name.
- [ ] Registration rejects missing email.
- [ ] Registration rejects invalid email format.
- [ ] Registration rejects passwords shorter than 6 characters.
- [ ] Registration rejects mismatched confirm password.
- [ ] Registration creates a `profiles` row with role `user`.
- [ ] User can log in with valid email and password.
- [ ] Login shows a clear error for wrong password.
- [ ] Login shows a clear error for invalid email.
- [ ] Session persists after app reload.
- [ ] Logout asks for confirmation.
- [ ] Logout clears session and returns to login.
- [ ] Forgot password sends reset email through Supabase Auth.

## User Booking Tests

- [ ] User can view active halls.
- [ ] Inactive halls are hidden from normal users.
- [ ] Hall search filters by hall name.
- [ ] Capacity filter returns only halls meeting the selected capacity.
- [ ] Facility filter returns halls with the selected facility.
- [ ] Hall detail screen displays image, location, capacity, and facilities.
- [ ] User can open venue availability for a hall.
- [ ] Availability screen shows pending and approved bookings for selected date.
- [ ] Availability screen shows empty state when no bookings exist.
- [ ] User can submit a valid booking request.
- [ ] Booking request is inserted with `status = pending`.
- [ ] User cannot submit a booking for a past date.
- [ ] User cannot submit booking with missing start time.
- [ ] User cannot submit booking with missing end time.
- [ ] User cannot submit booking when end time is before or equal to start time.
- [ ] User cannot submit audience count less than or equal to 0.
- [ ] User cannot submit audience count beyond hall capacity.
- [ ] User cannot submit an overlapping booking.
- [ ] Database trigger blocks overlapping direct inserts.
- [ ] User can view only own bookings.
- [ ] User can filter bookings by status.
- [ ] User can view booking details.
- [ ] User can cancel a pending booking.
- [ ] User cannot cancel an approved booking.
- [ ] User cannot edit approved or rejected bookings.

## Admin Tests

- [ ] Admin user is routed to the admin stack after login.
- [ ] Admin dashboard loads pending, approved, rejected, and active hall counts.
- [ ] Admin can view pending requests.
- [ ] Pending request card shows event title, requester, department, hall, date, time, and audience count.
- [ ] Admin can open booking review details.
- [ ] Booking review shows requester profile details.
- [ ] Booking review shows hall details.
- [ ] Admin can approve a valid pending booking.
- [ ] Approval sets `status = approved`.
- [ ] Approval sets `approved_by` to the current admin.
- [ ] Admin cannot approve a booking that conflicts with another approved booking.
- [ ] Database trigger blocks conflicting approved updates.
- [ ] Admin can reject a pending booking with remarks.
- [ ] Rejection requires admin remarks.
- [ ] Rejection sets `status = rejected`.
- [ ] Rejection stores `admin_remarks`.
- [ ] Approval creates a notification for the requester.
- [ ] Rejection creates a notification for the requester.
- [ ] Admin can view all bookings.
- [ ] Admin can manage halls.
- [ ] Admin can add a hall.
- [ ] Admin can upload a hall image.
- [ ] Admin can edit hall details.
- [ ] Admin can mark a hall inactive.

## Super Admin Tests

- [ ] Super admin can open user management.
- [ ] User management lists profiles.
- [ ] User search works by name, email, and register number.
- [ ] Role filter works.
- [ ] Department filter works.
- [ ] Super admin can open user details.
- [ ] User details show booking history.
- [ ] Super admin can change role to `user`.
- [ ] Super admin can change role to `admin`.
- [ ] Super admin can change role to `super_admin`.
- [ ] Role change shows confirmation dialog.
- [ ] Current super admin profile refreshes after changing own role.

## Security Tests

- [ ] Normal user cannot access admin stack.
- [ ] Normal user cannot access hall management screens.
- [ ] Normal user cannot access user management screens.
- [ ] Normal user cannot read another user's bookings through Supabase client.
- [ ] Normal user cannot update another user's booking.
- [ ] Normal user cannot directly update booking status to approved or rejected.
- [ ] Normal user cannot set `approved_by`.
- [ ] Normal user cannot edit halls.
- [ ] Normal user cannot delete halls.
- [ ] Admin cannot change user roles.
- [ ] Normal user cannot change own role.
- [ ] Normal user cannot read another user's notifications.
- [ ] Normal user cannot mark another user's notifications as read.
- [ ] Mobile app uses only the Supabase anon key.
- [ ] Service role key is not present in `.env`, source files, or committed docs.

## Notification Tests

- [ ] Unread count appears on user home screen.
- [ ] Notifications screen lists unread items first.
- [ ] User can mark a single notification as read.
- [ ] User can mark all notifications as read.
- [ ] New approval notification appears after admin approval.
- [ ] New rejection notification appears after admin rejection.
- [ ] Cancellation notification is created after pending booking cancellation.
- [ ] Realtime subscription updates unread count without manual refresh.

## UI Tests

- [ ] Login screen is readable and professionally spaced.
- [ ] Register screen validation messages are clear.
- [ ] Loading states appear for Supabase calls.
- [ ] Empty states appear for no halls, no bookings, no notifications, and no users.
- [ ] Error states show useful retry options.
- [ ] Buttons have consistent hierarchy and disabled/loading states.
- [ ] Inputs have consistent labels, spacing, and validation styling.
- [ ] Status badges are visually distinct for pending, approved, rejected, cancelled, and completed.
- [ ] Cards are readable on small screens.
- [ ] Text does not overflow buttons, cards, or headers.
- [ ] Admin dashboard is uncluttered and serious.
- [ ] Navigation headers are consistent across user and admin stacks.

