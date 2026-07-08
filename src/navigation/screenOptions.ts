import { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { colors, fontSizes } from '@/constants/theme';

export const defaultScreenOptions: NativeStackNavigationOptions = {
  headerStyle: {
    backgroundColor: colors.surface
  },
  headerTintColor: colors.primary,
  headerTitleStyle: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '900'
  },
  headerShadowVisible: false,
  contentStyle: {
    backgroundColor: colors.background
  }
};
