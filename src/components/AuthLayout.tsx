import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthGradientBackground } from '@/components/AuthGradientBackground';
import { AppLogoMark } from '@/components/AppLogoMark';
import { APP_NAME } from '@/constants/app';
import { colors, fontSizes, radius, shadows, spacing } from '@/constants/theme';

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  variant?: 'default' | 'venueverseGradient';
};

export function AuthLayout({ title, subtitle, children, variant = 'default' }: AuthLayoutProps) {
  const { height } = useWindowDimensions();
  if (variant === 'venueverseGradient') {
    return (
      <SafeAreaView style={styles.gradientRoot} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.gradientContent}
            bounces={false}
          >
            <View style={[styles.gradientHeader, { minHeight: Math.max(250, Math.round(height * 0.34)) }]}>
              <AuthGradientBackground />
              <View style={styles.gradientBrandHeader}>
                <AppLogoMark size={48} contained={false} />
                <Text style={styles.gradientBrandSmall}>{APP_NAME}</Text>
              </View>
              <Text style={styles.gradientTitle}>{title}</Text>
              <Text style={styles.gradientSubtitle}>{subtitle}</Text>
            </View>
            <View style={styles.gradientFormPanel}>{children}</View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.brandPanel}>
            <View style={styles.brandHeader}>
              <AppLogoMark size={46} contained={false} />
              <Text style={styles.brandSmall}>{APP_NAME}</Text>
            </View>
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
  gradientRoot: {
    flex: 1,
    backgroundColor: colors.gradientStart
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
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
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
  },
  gradientContent: {
    flexGrow: 1,
    backgroundColor: colors.authSurface
  },
  gradientHeader: {
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    overflow: 'hidden'
  },
  gradientBrandHeader: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg
  },
  gradientBrandSmall: {
    color: colors.authMutedOnDark,
    fontSize: fontSizes.xs,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase'
  },
  gradientTitle: {
    color: colors.authTextOnDark,
    fontSize: fontSizes.title,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 34
  },
  gradientSubtitle: {
    color: colors.authMutedOnDark,
    fontSize: fontSizes.md,
    fontWeight: '700',
    lineHeight: 23,
    marginTop: spacing.sm
  },
  gradientFormPanel: {
    flex: 1,
    backgroundColor: colors.authSurface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: spacing.md,
    marginTop: -spacing.lg,
    padding: spacing.lg,
    paddingTop: spacing.xl
  }
});
