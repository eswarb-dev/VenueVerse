# Get Started Screen Documentation

**File:** `src/screens/auth/GetStartedScreen.tsx`

The `GetStartedScreen` is the initial onboarding screen that users see when they open the VenueVerse app (if they are unauthenticated). It features a highly polished UI with entrance animations, a continuous floating effect, and an embedded video or GIF logo.

## Overview

The screen is built using React Native and `@react-navigation/native-stack`. Its primary purpose is to introduce the app and provide a clear call-to-action ("Get Started") to route the user to the Authentication flow (`AuthStack`).

### Key Features
- **Responsive Layout:** Uses `useWindowDimensions` to dynamically scale the illustration to 30% of the screen height.
- **Dynamic Media Rendering:** Gracefully falls back to a GIF when running in Expo Go, while using `expo-av` for high-quality MP4 video playback in production/development builds.
- **Staggered Entrance Animations:** Smoothly slides and fades in the logo, title, subtitle, and button sequentially when the screen mounts.
- **Continuous Floating Animation:** The main illustration gently bobs up and down on a continuous loop to make the UI feel alive.

---

## Technical Implementation Details

### 1. Conditional Video Loading (`expo-av`)
Because the `expo-av` module requires native code that isn't bundled in the standard Expo Go app, the script conditionally requires it.

```typescript
const isExpoGo =
  Constants.executionEnvironment === 'storeClient' ||
  (Constants as any).appOwnership === 'expo';

if (!isExpoGo) {
  try {
    ExpoAV = require('expo-av');
  } catch {
    ExpoAV = null;
  }
}
```
If the app is running in Expo Go, it renders a fallback `.gif`. Otherwise, it uses `Video` from `expo-av` to render `.mp4`.

### 2. Animations
The screen relies heavily on the React Native `Animated` API to handle its micro-interactions. It sets up 5 different `Animated.Value` instances:
- `animCard`: Controls the entrance of the illustration.
- `animTitle`: Controls the entrance of the "VenueVerse" text.
- `animSubtitle`: Controls the entrance of the subtitle text.
- `animButton`: Controls the entrance of the "Get Started" button.
- `animFloat`: A continuous loop value (-1 to 1) that controls the hovering effect of the illustration.

**Entrance Sequence:**
`Animated.stagger(120, ...)` is used to delay the start of each subsequent animation by 120ms, creating a cascading fade-and-slide-up effect.

**Floating Loop:**
Once the entrance animation finishes, an `Animated.loop` begins:
1. Moves the illustration slightly up (`toValue: 1`).
2. Moves it down (`toValue: -1`) over a longer duration (3800ms).
3. Returns to center (`toValue: 0`).
This is powered by `Animated.add` to combine both the initial entrance translation and the continuous floating translation.

### 3. Styling and Theming
The screen leverages the global design system from `@/constants/theme`, specifically:
- `colors.primary`, `colors.background`, `colors.textMuted`
- `typography.body`
- `spacing.xl` for padding.
- Hardcoded styles are used for shadows (`elevation` on Android and `shadowColor`/`shadowOpacity` on iOS) to create deep, premium card effects.

### 4. Navigation
The screen receives the `navigation` prop from `@react-navigation/native-stack`. When the user taps the primary button:
```typescript
onPress={() => navigation.replace('AuthStack')}
```
It uses `.replace()` instead of `.navigate()` to prevent the user from swiping back to the Get Started screen once they enter the Authentication flow.

---

## Dependencies
- `react-native`: Core UI components (`View`, `Text`, `Animated`, `StyleSheet`).
- `expo-av`: Video playback (lazy-loaded).
- `expo-constants`: Execution environment checking.
- `@expo/vector-icons`: Arrow icon in the button (`Ionicons`).
- `react-native-safe-area-context`: `SafeAreaView` to avoid notches and system navigation bars.
