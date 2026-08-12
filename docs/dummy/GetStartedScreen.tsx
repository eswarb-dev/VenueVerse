import { useCallback, useState, useEffect, useRef } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  Animated,
  Platform,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { RootStackParamList } from '@/navigation/types';

// expo-av needs native code that is NOT bundled inside Expo Go.
// We lazy-load it only in production / dev builds.
type VideoModule = typeof import('expo-av');
let ExpoAV: VideoModule | null = null;

const isExpoGo =
  Constants.executionEnvironment === 'storeClient' ||
  (Constants as any).appOwnership === 'expo';

if (!isExpoGo) {
  // Runs only in dev-builds / production — safe to require native module
  try {
    ExpoAV = require('expo-av');
  } catch {
    ExpoAV = null;
  }
}

// ─── Main screen ─────────────────────────────────────────────────────────────
type Props = NativeStackScreenProps<RootStackParamList, 'GetStarted'>;

export function GetStartedScreen({ navigation }: Props) {
  const { height } = useWindowDimensions();
  const [isVideoReady, setIsVideoReady] = useState(false);
  const illustrationHeight = height * 0.30;

  const onReadyForDisplay = useCallback(() => {
    setIsVideoReady(true);
  }, []);

  const animCard = useRef(new Animated.Value(0)).current;
  const animTitle = useRef(new Animated.Value(0)).current;
  const animSubtitle = useRef(new Animated.Value(0)).current;
  const animButton = useRef(new Animated.Value(0)).current;
  const animFloat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const entranceAnimations = [animCard, animTitle, animSubtitle, animButton].map(
      (anim) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        })
    );

    Animated.stagger(120, entranceAnimations).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(animFloat, {
            toValue: 1,
            duration: 1900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(animFloat, {
            toValue: -1,
            duration: 3800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(animFloat, {
            toValue: 0,
            duration: 1900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  }, [animCard, animTitle, animSubtitle, animButton, animFloat]);

  const getEntranceStyle = (animValue: Animated.Value) => ({
    opacity: animValue,
    transform: [
      {
        translateY: animValue.interpolate({
          inputRange: [0, 1],
          outputRange: [20, 0],
        }),
      },
    ],
  });

  const cardTranslateY = Animated.add(
    animCard.interpolate({
      inputRange: [0, 1],
      outputRange: [20, 0],
    }),
    animFloat.interpolate({
      inputRange: [-1, 1],
      outputRange: [6, -6],
    })
  );

  const cardStyle = {
    opacity: animCard,
    transform: [{ translateY: cardTranslateY }],
  };

  const renderIllustration = () => {
    const cardSize = illustrationHeight;

    if (isExpoGo || !ExpoAV) {
      return (
        <View style={[styles.card, { width: cardSize, height: cardSize }]}>
          <Image
            source={require('../../../assets/videos/logo_intro.gif')}
            style={{ width: '100%', height: '100%', resizeMode: 'contain', borderRadius: 28 }}
          />
        </View>
      );
    }

    const { Video, ResizeMode } = ExpoAV;
    return (
      <View style={[styles.card, { width: cardSize, height: cardSize }]}>
        {!isVideoReady && (
          <View style={[styles.videoPlaceholder, { width: '100%', height: '100%', borderRadius: 28 }]} />
        )}
        <Video
          source={require('../../../assets/videos/logo_intro.mp4')}
          style={[
            styles.video,
            { height: '100%', borderRadius: 28 },
            !isVideoReady && styles.hidden,
          ]}
          resizeMode={ResizeMode.CONTAIN}
          isLooping
          isMuted
          shouldPlay
          onReadyForDisplay={onReadyForDisplay}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content}>

        {/* ── Top spacer ─────────────────────────────── */}
        <View style={styles.spacerTop} />

        {/* ── Illustration ───────────────────────────── */}
        <Animated.View style={[styles.illustrationContainer, { height: illustrationHeight }, cardStyle]}>
          {renderIllustration()}
        </Animated.View>

        <View style={{ height: 40 }} />

        {/* ── Title ──────────────────────────────────── */}
        <Animated.Text style={[styles.appName, getEntranceStyle(animTitle)]}>VenueVerse</Animated.Text>
        <View style={{ height: 12 }} />
        <Animated.Text style={[styles.subtitle, getEntranceStyle(animSubtitle)]}>
          Campus Venue Booking{'\n'}Simplified.
        </Animated.Text>

        {/* ── Bottom spacer ──────────────────────────── */}
        <View style={styles.spacerBottom} />

        {/* ── Get Started Button ─────────────────────── */}
        <Animated.View style={[{ width: '100%' }, getEntranceStyle(animButton)]}>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => navigation.replace('AuthStack')}
            accessibilityRole="button"
            accessibilityLabel="Get Started"
          >
            <Text style={styles.buttonText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.primary} />
          </Pressable>
        </Animated.View>

        <View style={{ height: 40 }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  spacerTop: {
    flex: 2,
    minHeight: spacing.xl,
  },
  spacerBottom: {
    flex: 3,
    minHeight: spacing.xl,
  },
  illustrationContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Video (dev build / production) ───────────────────────────────────
  videoPlaceholder: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    position: 'absolute',
  },
  video: {
    width: '100%',
  },
  hidden: {
    opacity: 0,
  },

  // ── Text & Button ────────────────────────────────────────────────────
  appName: {
    color: colors.primary,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 1.0,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textMuted,
    ...typography.body,
    lineHeight: 24,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    shadowColor: '#1A2B4C',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: Platform.OS === 'android' ? 6 : 0,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  card: {
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A2B4C',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 30,
    elevation: Platform.OS === 'android' ? 10 : 0,
  },
});
