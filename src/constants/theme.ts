export const colors = {
  primary: '#0A3A66',
  primaryDark: '#072B4C',
  primaryLight: '#EAF2FA',
  onPrimaryMuted: '#BFD7F0',
  onPrimarySubtle: '#E4EEF8',
  background: '#F6F8FB',
  surface: '#FFFFFF',
  surfaceMuted: '#F9FAFC',
  text: '#17212B',
  textMuted: '#667085',
  border: '#D8E0EA',
  borderSoft: '#E8EDF3',
  errorSurface: '#FDECEC',
  errorBorder: '#F4B4B0',
  unreadSurface: '#F8FBFF',
  status: {
    pending: '#A16207',
    approved: '#157347',
    rejected: '#B42318',
    cancelled: '#667085',
    completed: '#1D4ED8'
  }
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 14,
  pill: 999
} as const;

export const fontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  title: 28
} as const;

export const shadows = {
  card: {
    shadowColor: '#101828',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  }
} as const;

export const theme = {
  colors,
  spacing,
  radius,
  fontSizes,
  shadows
} as const;
