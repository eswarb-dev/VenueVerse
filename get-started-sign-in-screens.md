# VenueVerse Get Started and Sign In Screens

This document records the current Get Started screen and Sign In page implementation for VenueVerse.

## Files

- `src/screens/auth/GetStartedScreen.tsx`
- `src/screens/auth/LoginScreen.tsx`
- `src/navigation/AuthStack.tsx`
- `src/navigation/types.ts`

## Navigation Flow

The unauthenticated app starts at `GetStarted` by default.

```tsx
<Stack.Screen name="GetStarted" component={GetStartedScreen} options={{ headerShown: false }} />
<Stack.Screen name="Login" component={LoginScreen} options={{ title: APP_NAME }} />
```

When the user taps **Get Started**, the app runs:

```tsx
navigation.replace('Login');
```

This replaces the Get Started screen with the Login screen so the user does not return to onboarding through the back action.

## Get Started Screen

Visible text:

- `VenueVerse`
- `Official Venue Booking App of SREC`
- `Campus Venue Booking`
- `Get Started`

The screen uses:

- animated logo card
- optimized intro video from `assets/videos/logo_intro_optimized.mp4`
- fallback logo/title if the video fails
- centered college ownership line
- no settings icon
- button navigation to `Login`

### Get Started Script

```tsx
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from 'react-native';
import { AppLogoMark } from '@/components/AppLogoMark';
import { colors, spacing } from '@/constants/theme';
import { AuthStackParamList } from '@/navigation/types';

const logoIntroVideo = require('../../../assets/videos/logo_intro_optimized.mp4');

type Props = NativeStackScreenProps<AuthStackParamList, 'GetStarted'>;

type EntranceItem = {
  opacity: Animated.Value;
  translateY: Animated.Value;
};

function createEntranceItem(): EntranceItem {
  return {
    opacity: new Animated.Value(0),
    translateY: new Animated.Value(20)
  };
}

export function GetStartedScreen({ navigation }: Props) {
  const { width, height } = useWindowDimensions();
  const cardSize = Math.min(width * 0.62, height * 0.3, 280);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [introFinished, setIntroFinished] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const cardAnim = useRef(createEntranceItem()).current;
  const titleAnim = useRef(createEntranceItem()).current;
  const subtitleAnim = useRef(createEntranceItem()).current;
  const buttonAnim = useRef(createEntranceItem()).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const floatLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const hasStartedAnimations = useRef(false);
  const floatTranslateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [6, -6]
  });
  const cardFloatStyle = {
    opacity: cardAnim.opacity,
    transform: [
      { translateY: Animated.add(cardAnim.translateY, floatTranslateY) }
    ]
  };

  useEffect(() => {
    if (hasStartedAnimations.current) return undefined;
    hasStartedAnimations.current = true;

    const entranceItems = [cardAnim, titleAnim, subtitleAnim, buttonAnim];
    const entranceAnimation = Animated.stagger(
      110,
      entranceItems.map((item) =>
        Animated.parallel([
          Animated.timing(item.opacity, {
            toValue: 1,
            duration: 460,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          }),
          Animated.timing(item.translateY, {
            toValue: 0,
            duration: 460,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          })
        ])
      )
    );

    entranceAnimation.start(() => {
      floatLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: 1,
            duration: 1900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 1900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true
          })
        ])
      );
      floatLoopRef.current.start();
    });

    return () => {
      entranceAnimation.stop();
      floatLoopRef.current?.stop();
    };
  }, []);

  const handleGetStarted = () => {
    navigation.replace('Login');
  };

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    if (status.didJustFinish) {
      setIntroFinished(true);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.topSpacer} />

        <Animated.View style={cardFloatStyle}>
          <View style={[styles.logoCard, { width: cardSize, height: cardSize }]}>
            {videoError ? (
              <View style={styles.videoFallback}>
                <Text style={styles.fallbackTitle}>VenueVerse</Text>
              </View>
            ) : (
              <>
                {!isVideoReady ? (
                  <View style={styles.videoPlaceholder}>
                    <AppLogoMark size={Math.round(cardSize * 0.58)} contained={false} />
                  </View>
                ) : null}
                <Video
                  source={logoIntroVideo}
                  style={[styles.video, !isVideoReady && styles.hidden]}
                  resizeMode={ResizeMode.CONTAIN}
                  isLooping={false}
                  isMuted
                  shouldPlay={isVideoReady && !introFinished && !videoError}
                  progressUpdateIntervalMillis={250}
                  onLoad={() => setIsVideoReady(true)}
                  onReadyForDisplay={() => setIsVideoReady(true)}
                  onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
                  onError={() => setVideoError(true)}
                />
              </>
            )}
          </View>
        </Animated.View>

        <View style={styles.copy}>
          <Animated.Text style={[styles.title, getEntranceStyle(titleAnim)]}>VenueVerse</Animated.Text>
          <Animated.Text style={[styles.officialLine, getEntranceStyle(subtitleAnim)]}>
            Official Venue Booking App of SREC
          </Animated.Text>
          <Animated.Text style={[styles.subtitle, getEntranceStyle(subtitleAnim)]}>
            Campus Venue Booking
          </Animated.Text>
        </View>

        <View style={styles.bottomSpacer} />

        <Animated.View style={[styles.buttonWrap, getEntranceStyle(buttonAnim)]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Get started"
            hitSlop={8}
            onPress={handleGetStarted}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed
            ]}
          >
            <Text style={styles.buttonText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.primary} />
          </Pressable>
        </Animated.View>

        <View style={styles.footerSpacer} />
      </View>
    </SafeAreaView>
  );
}
```

## Sign In Page

Visible text:

- `Welcome back`
- `Sign in with your VenueVerse account.`
- `College email`
- `Password`
- `Sign In`
- `Forgot password?`
- `Need access? Contact your department administrator.`

The screen uses:

- `AuthLayout`
- `FormTextInput`
- `PrimaryButton`
- `validateLogin`
- `useAuth().login`
- navigation to `ForgotPassword`

### Sign In Script

```tsx
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { AuthLayout } from '@/components/AuthLayout';
import { FormTextInput } from '@/components/FormTextInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, fontSizes, spacing } from '@/constants/theme';
import { AuthStackParamList } from '@/navigation/types';
import { useAuth } from '@/store/AuthContext';
import { validateLogin, ValidationErrors } from '@/utils/validators';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<ValidationErrors<'email' | 'password'>>({});

  const onSubmit = async () => {
    const nextErrors = validateLogin({ email, password });
    setErrors(nextErrors);
    setError('');

    if (Object.keys(nextErrors).length > 0) return;

    try {
      setLoading(true);
      await login(email, password);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in with your VenueVerse account."
    >
      {error ? <Text style={styles.banner}>{error}</Text> : null}
      <FormTextInput
        label="College email"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
      />
      <FormTextInput
        label="Password"
        isPassword
        value={password}
        onChangeText={setPassword}
        error={errors.password}
      />
      <PrimaryButton title="Sign In" loading={loading} onPress={onSubmit} />
      <Pressable onPress={() => navigation.navigate('ForgotPassword')}>
        <Text style={styles.link}>Forgot password?</Text>
      </Pressable>
      <Text style={styles.helper}>Need access? Contact your department administrator.</Text>
    </AuthLayout>
  );
}
```

## Auth Stack Types

```tsx
export type AuthStackParamList = {
  GetStarted: undefined;
  Login: undefined;
  ForgotPassword: undefined;
  VerifyResetOtp: { email: string };
  ResetPassword: { email: string; token: string };
};
```

## Notes

- Get Started does not show a settings icon.
- The Get Started button does not authenticate the user; it only opens the Login screen.
- Sign In authentication is handled through `useAuth().login`.
- Forgot Password is reachable from the Sign In page.
- Backend/Supabase logic is not changed by these screens directly.
