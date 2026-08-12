# Prompt: Update VenueVerse Get Started + Login screens to gradient-blob UI

Copy everything below into Codex / Claude Code as one prompt.

---

Update the visual design of `GetStartedScreen.tsx` and `LoginScreen.tsx` to a new
"gradient blob" background style. Do not change any text copy, navigation logic,
video playback logic, form validation, or auth logic — this is a styling-only change.

## Files to touch

- `src/screens/auth/GetStartedScreen.tsx`
- `src/screens/auth/LoginScreen.tsx`
- `src/components/AuthLayout.tsx` (background lives here for the Login screen)
- `src/constants/theme.ts` (add new color tokens)
- Add new dependency: `expo-linear-gradient` (already compatible with Expo/expo-av setup)

## What must NOT change

- All visible text stays exactly as-is: `VenueVerse`, `Official Venue Booking App of SREC`,
  `Campus Venue Booking`, `Get Started`, `Welcome back`, `Sign in with your VenueVerse account.`,
  `College email`, `Password`, `Sign In`, `Forgot password?`,
  `Need access? Contact your department administrator.`
- Keep the existing entrance animations (`Animated.stagger`, float loop) on GetStartedScreen.
- Keep the video intro logic (`expo-av` `Video`, `isVideoReady`, `introFinished`, `videoError`
  fallback) exactly as it is — only the surrounding background/container styling changes.
- Keep `AuthLayout`, `FormTextInput`, `PrimaryButton`, `validateLogin`, `useAuth().login`,
  and navigation to `ForgotPassword` unchanged.
- Keep `navigation.replace('Login')` behavior on Get Started button press.

## New design spec

**Brand color:** `#0A3A66` (primary navy). Add to `theme.ts` as `colors.primary` if not already
that value, plus these new tokens:

```ts
export const colors = {
  // ...existing tokens
  primary: '#0A3A66',
  gradientStart: '#071F38',
  gradientMid: '#0A3A66',
  gradientEnd: '#C9DCED',
  blobLight: '#9FBCD8',
  blobLighter: '#C9DCED',
};
```

**Background treatment (both screens):**
- Full-bleed `LinearGradient` from `expo-linear-gradient`, diagonal (`start={{x:0,y:0}} end={{x:1,y:1}}`),
  colors `[colors.gradientStart, colors.primary, colors.blobLight, colors.gradientEnd]`,
  locations roughly `[0, 0.35, 0.7, 1]`.
- 3–4 soft circular "blobs" absolutely positioned on top of the gradient, each also a small
  `LinearGradient` circle (radial look approximated with a diagonal gradient + `borderRadius: 999`),
  varying sizes (roughly 90–150px), placed at the corners/edges so they bleed off-screen on at
  least one side. Use `colors.blobLight` → `colors.primary` and `white` → `colors.blobLighter`
  for variety, and keep opacity high (0.7–1) so they read as glossy spheres, not washed out.
- On `GetStartedScreen`, blobs should span the full screen height (not just a header band) since
  there's no separate white content card below.
- On `LoginScreen`, the gradient + blobs sit behind the header/title area only; the existing
  white form card (in `AuthLayout`) overlaps the bottom of the gradient with rounded top corners
  (`borderTopLeftRadius: 24, borderTopRightRadius: 24`) so it "floats" over the blob background,
  matching the current AuthLayout structure but with the new background behind it instead of a
  flat color.

**GetStartedScreen specific:**
- Logo card (`AppLogoMark` / video container) keeps its white rounded-square background so it
  pops against the gradient.
- Title `VenueVerse` and the two subtitle lines render in white / near-white
  (`colors.blobLighter` for the subtitle lines) for contrast against the dark gradient.
- The `Get Started` button becomes a white/near-white pill button floating near the bottom of
  the gradient (not on a separate white background section) — text color `colors.primary`,
  keep the existing forward arrow icon.

**LoginScreen specific:**
- `Welcome back` title and subtitle render in white against the gradient header area.
- Form inputs, `Sign In` button, `Forgot password?` link, and helper text keep their current
  light-surface styling inside the floating white card — just confirm the `Sign In` button uses
  `colors.primary` (#0A3A66) as its fill color.

## Acceptance criteria

- No copy/text changes anywhere.
- No changes to navigation, validation, auth, or video playback logic — only JSX structure
  needed to add gradient/blob layers, plus style changes.
- Works on both iOS and Android via `expo-linear-gradient` (no web-only CSS gradients).
- Existing entrance/float animations on GetStartedScreen still run correctly with the new
  background layered behind them (background should not be part of the animated tree —
  it's static, only the card/title/subtitle/button animate as before).
- `theme.ts` exports the new gradient/blob color tokens so they can be reused by other screens
  later without hardcoding hex values in components.
