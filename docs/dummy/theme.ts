// ---------------------------------------------------------------------------
// VenueVerse Design System Tokens
// ---------------------------------------------------------------------------
// Every color, size, and shadow used in the app should originate from this
// file.  When dark-mode support is added, swap this export for an alternate
// palette — no other file should contain raw color literals.
// ---------------------------------------------------------------------------

export const colors = {
  // Brand
  primary: '#0A3A66',
  primaryDark: '#072B4C',
  primaryLight: '#EAF2FA',
  onPrimaryMuted: '#BFD7F0',
  onPrimarySubtle: '#E4EEF8',

  // Secondary / accent
  secondary: '#2563EB',
  secondaryLight: '#EFF6FF',

  // Surfaces
  background: '#F7F8FC',
  surface: '#FFFFFF',
  surfaceMuted: '#F9FAFC',

  // Text
  text: '#17212B',
  textMuted: '#667085',
  textOnPrimary: '#FFFFFF',

  // Borders
  border: '#D8E0EA',
  borderSoft: '#E8EDF3',

  // Destructive
  destructive: '#DC2626',
  destructiveLight: '#FEF2F2',
  destructiveBorder: '#FECACA',

  // Error (alias of destructive for backwards compat)
  errorSurface: '#FEF2F2',
  errorBorder: '#FECACA',

  // Notifications
  unreadSurface: '#F8FBFF',

  // Admin accent — slightly warmer primary for admin header differentiation
  admin: '#1E3A5F',
  adminLight: '#F0F4FA',

  // Booking-status semantic colors
  status: {
    pending: '#A16207',
    approved: '#157347',
    rejected: '#B42318',
    cancelled: '#667085',
    completed: '#1D4ED8',
  },

  // Light tint backgrounds for each status (badges, stat cards)
  statusSurface: {
    pending: '#FEF3C7',
    approved: '#D1FAE5',
    rejected: '#FEE2E2',
    cancelled: '#F3F4F6',
    completed: '#DBEAFE',
  },
} as const;

// ---------------------------------------------------------------------------
// Spacing — 4-point grid
// ---------------------------------------------------------------------------
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;

// ---------------------------------------------------------------------------
// Border radii
// ---------------------------------------------------------------------------
export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

// ---------------------------------------------------------------------------
// Typography scale — fontSize + fontWeight + lineHeight presets
// ---------------------------------------------------------------------------
export const fontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  title: 28,
} as const;

export const typography = {
  heading: {
    fontSize: fontSizes.xl,
    fontWeight: '900' as const,
    lineHeight: 30,
  },
  subheading: {
    fontSize: fontSizes.lg,
    fontWeight: '800' as const,
    lineHeight: 26,
  },
  body: {
    fontSize: fontSizes.sm,
    fontWeight: '600' as const,
    lineHeight: 20,
  },
  bodyBold: {
    fontSize: fontSizes.sm,
    fontWeight: '800' as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: fontSizes.xs,
    fontWeight: '700' as const,
    lineHeight: 16,
  },
  captionBold: {
    fontSize: fontSizes.xs,
    fontWeight: '900' as const,
    lineHeight: 16,
  },
} as const;

// ---------------------------------------------------------------------------
// Shadows / elevation
// ---------------------------------------------------------------------------
export const shadows = {
  card: {
    shadowColor: '#101828',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  subtle: {
    shadowColor: '#101828',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
} as const;

// ---------------------------------------------------------------------------
// Convenience re-export
// ---------------------------------------------------------------------------
export const theme = {
  colors,
  spacing,
  radius,
  fontSizes,
  typography,
  shadows,
} as const;
