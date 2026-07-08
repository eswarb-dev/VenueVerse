import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/theme';

type AppScreenProps = {
  children: ReactNode;
};

export function AppScreen({ children }: AppScreenProps) {
  return (
    <SafeAreaView style={styles.root} edges={['left', 'right', 'bottom']}>
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.md
  }
});
