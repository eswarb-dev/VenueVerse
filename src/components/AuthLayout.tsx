import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { APP_NAME } from '@/constants/app';
import { colors, fontSizes, radius, shadows, spacing } from '@/constants/theme';

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.brandPanel}>
            <Text style={styles.brandSmall}>{APP_NAME}</Text>
            <Text style={styles.brandTitle}>{title}</Text>
            <Text style={styles.brandSubtitle}>{subtitle}</Text>
          </View>
          <View style={styles.formPanel}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background
  },
  flex: {
    flex: 1
  },
  content: {
    padding: spacing.md,
    gap: spacing.md
  },
  brandPanel: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.sm,
    ...shadows.card
  },
  brandSmall: {
    color: colors.onPrimaryMuted,
    fontSize: fontSizes.xs,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase'
  },
  brandTitle: {
    color: colors.surface,
    fontSize: fontSizes.title,
    fontWeight: '900'
  },
  brandSubtitle: {
    color: colors.onPrimarySubtle,
    fontSize: fontSizes.md,
    lineHeight: 23
  },
  formPanel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card
  }
});
