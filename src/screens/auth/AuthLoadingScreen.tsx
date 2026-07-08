import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, spacing } from '@/constants/theme';

export function AuthLoadingScreen() {
  return (
    <View style={styles.root}>
      <ActivityIndicator size="large" color={colors.surface} />
      <Text style={styles.title}>Preparing secure session</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.primary
  },
  title: {
    color: colors.surface,
    fontSize: fontSizes.md,
    fontWeight: '800'
  }
});
