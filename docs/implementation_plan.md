# Refactoring VenueVerse to Institutional Operations Dashboard UI

This plan details the transition from the current stack-only navigation model to a bottom-tab-based design system, tailored specifically for institutional/college operations. The visual style will be updated to a dense, readable dashboard feel (similar to Notion or Supabase interfaces) with minimal decoration and status-first layouts.

## User Review Required

> [!IMPORTANT]
> **Dependency Addition**: We will install `@react-navigation/bottom-tabs` to support tab-bar layouts.
> **Navigation Restructuring**: Both the User Portal and Admin Portal will use nested bottom-tab navigators. Detail screens (e.g., booking details, review screens, and forms) will continue to slide in on top of the tab bar for maximum focus.

## Proposed Changes

We will restructure navigation and style cards, layout headers, and availability filters to follow a professional, institutional aesthetic.

---

### Navigation Layer

#### [MODIFY] [types.ts](file:///d:/vv_repo/VenueVerse/src/navigation/types.ts)
- Add `UserTabParamList` and `AdminTabParamList` types.
- Update `AppStackParamList` and `AdminStackParamList` to support nested navigator parameters (`UserTabs` and `AdminTabs`), while maintaining backwards-compatible properties for direct typing of screen components.

#### [MODIFY] [AppStack.tsx](file:///d:/vv_repo/VenueVerse/src/navigation/AppStack.tsx)
- Install and import `createBottomTabNavigator` from `@react-navigation/bottom-tabs`.
- Create a `UserTabNavigator` screen nesting the top-level screens:
  - **Home**: `UserHomeScreen`
  - **Book**: `HallListScreen`
  - **Bookings**: `MyBookingsScreen`
  - **Notifications**: `NotificationsScreen`
  - **Profile**: `ProfileScreen`
- Embed the `UserTabNavigator` as the root screen in `AppStack` (`UserTabs`).
- Retain the stack-based detail screens (`HallDetails`, `VenueAvailability`, `BookHall`, `BookingDetails`, `ChangePassword`, `EditProfile`, `Settings`, `AdminArea`) in the parent navigator so they slide over the tab bar when pushed.

#### [MODIFY] [AdminStack.tsx](file:///d:/vv_repo/VenueVerse/src/navigation/AdminStack.tsx)
- Create an `AdminTabNavigator` screen nesting:
  - **Dashboard**: `AdminDashboardScreen`
  - **Requests**: `PendingRequestsScreen`
  - **Bookings**: `AllBookingsScreen`
  - **Users**: `UserManagementScreen`
  - **Venues**: `HallManagementScreen`
- Embed `AdminTabNavigator` as the root screen of the `AdminStack` (`AdminTabs`).
- Retain the other screens (`BookingReview`, `AddHall`, `EditHall`, `AddUser`, `UserDetails`) in the stack so they are pushed over the bottom-tab bar.

---

### Screen Enhancements

#### [MODIFY] [UserHomeScreen.tsx](file:///d:/vv_repo/VenueVerse/src/screens/home/UserHomeScreen.tsx)
- Redesign the greeting panel: change from a rounded, heavy-gradient card to a sleek institutional flat header with professional blue accents (`#0A3A66`).
- Refine the **Booking Status Summary**: style `StatCard` items as border-soft, status-colored outlines with dense metrics.
- Refine **Today's Booked Halls Summary Card**: style it as a clean calendar indicator status card.
- Clean up **Recent Bookings**: structure them as a dense list of border-only booking summary cards.
- Remove redundant administrative actions if they overlap with the profile controls, or keep a professional, low-friction button to switch to the admin view.

#### [MODIFY] [MyBookingsScreen.tsx](file:///d:/vv_repo/VenueVerse/src/screens/bookings/MyBookingsScreen.tsx)
- Refine the status selector header: convert the horizontal filter list to a clean, Notion-like segmented control or dense tab row.
- Style `BookingCard`s to be compact, border-soft cards emphasizing date, time, and status first.

#### [MODIFY] [HallListScreen.tsx](file:///d:/vv_repo/VenueVerse/src/screens/halls/HallListScreen.tsx)
- Optimize the layout of filters (Department, Venue Type, Date) to look dense and professional.
- Design the venue availability cards to look like clean institutional records showing seating, facilities, and active booking buttons.

#### [MODIFY] [AdminDashboardScreen.tsx](file:///d:/vv_repo/VenueVerse/src/screens/admin/AdminDashboardScreen.tsx)
- Clean up the stats overview cards (Notion/Supabase style).
- Update the quick actions to navigate directly to tab screens (`Requests`, `Bookings`, `Users`, `Venues`).
- Keep the log out button at the bottom for easy operations access.

---

## Verification Plan

### Automated Tests
- Propose running `npm run typecheck` (`tsc --noEmit`) to verify there are no TypeScript compile or navigation configuration errors.

### Manual Verification
- Verify that standard users see the 5-tab bottom navigation (`Home`, `Book`, `Bookings`, `Notifications`, `Profile`).
- Verify that administrators see the "Open Admin Area" action on the User Home, navigating them to the 5-tab admin interface (`Dashboard`, `Requests`, `Bookings`, `Users`, `Venues`).
- Verify that clicking "Book Venue", "View bookings", or notification badges redirects smoothly to the corresponding tabs.
- Ensure detail screens hide the bottom tab bar by sliding over them.
