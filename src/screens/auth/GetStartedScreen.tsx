import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from 'react-native';
import LottieView from 'lottie-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthGradientBackground } from '@/components/AuthGradientBackground';
import { colors, spacing } from '@/constants/theme';
import { AuthStackParamList } from '@/navigation/types';

const floatingLogoSource = require('../../../assets/animations/floating_logo.json');
const logoFallbackSource = require('../../../assets/animations/images/venueverse_logo.png');

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
  const logoSize = Math.min(width * 0.74, height * 0.34, 320);
  const [useLogoFallback, setUseLogoFallback] = useState(false);
  const cardAnim = useRef(createEntranceItem()).current;
  const logoScale = useRef(new Animated.Value(0.86)).current;
  const logoRotate = useRef(new Animated.Value(-1)).current;
  const titleAnim = useRef(createEntranceItem()).current;
  const subtitleAnim = useRef(createEntranceItem()).current;
  const buttonAnim = useRef(createEntranceItem()).current;
  const hasStartedAnimations = useRef(false);
  const logoEntranceStyle = {
    opacity: cardAnim.opacity,
    transform: [
      { translateY: cardAnim.translateY },
      { scale: logoScale },
      {
        rotate: logoRotate.interpolate({
          inputRange: [-1, 0],
          outputRange: ['-1deg', '0deg']
        })
      }
    ]
  };

  useEffect(() => {
    if (hasStartedAnimations.current) return undefined;
    hasStartedAnimations.current = true;

    const logoEntranceAnimation = Animated.parallel([
      Animated.timing(cardAnim.opacity, {
        toValue: 1,
        duration: 550,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 7,
        tension: 55,
        useNativeDriver: true
      }),
      Animated.timing(cardAnim.translateY, {
        toValue: 0,
        duration: 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(logoRotate, {
        toValue: 0,
        duration: 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]);
    const entranceItems = [titleAnim, subtitleAnim, buttonAnim];
    const entranceAnimation = Animated.stagger(
      110,
      [
        logoEntranceAnimation,
        ...entranceItems.map((item) =>
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
      ]
    );

    entranceAnimation.start();

    return () => {
      entranceAnimation.stop();
    };
  }, []);

  const handleGetStarted = () => {
    navigation.replace('Login');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <AuthGradientBackground />
      <View style={styles.container}>
        <View style={styles.topSpacer} />

        <Animated.View style={[styles.logoWrap, { width: logoSize, height: logoSize }, logoEntranceStyle]}>
          {useLogoFallback ? (
            <Image source={logoFallbackSource} resizeMode="contain" style={styles.logoImage} />
          ) : (
            <LottieView
              source={floatingLogoSource}
              autoPlay
              loop
              imageAssetsFolder="images"
              onAnimationFailure={() => setUseLogoFallback(true)}
              style={styles.logoImage}
            />
          )}
        </Animated.View>

        <View style={styles.copy}>
          <Animated.Text style={[styles.title, getEntranceStyle(titleAnim)]}>VenueVerse</Animated.Text>
          <Animated.Text style={[styles.officialLine, getEntranceStyle(subtitleAnim)]}>
            Official Venue Booking App of SREC
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

function getEntranceStyle(item: EntranceItem) {
  return {
    opacity: item.opacity,
    transform: [{ translateY: item.translateY }]
  };
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.gradientStart
  },
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl
  },
  topSpacer: {
    flex: 2,
    minHeight: spacing.xxl
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible'
  },
  logoImage: {
    width: '100%',
    height: '100%'
  },
  copy: {
    alignItems: 'center',
    marginTop: spacing.xxl
  },
  title: {
    color: colors.authTextOnDark,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 40,
    textAlign: 'center'
  },
  officialLine: {
    color: colors.authMutedOnDark,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 6,
    textAlign: 'center'
  },
  subtitle: {
    color: colors.authTextOnDark,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 26,
    marginTop: 8,
    textAlign: 'center'
  },
  bottomSpacer: {
    flex: 3,
    minHeight: spacing.xxl
  },
  buttonWrap: {
    width: '100%'
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    flexDirection: 'row',
    gap: spacing.sm,
    height: 56,
    justifyContent: 'center',
    shadowColor: '#1A2B4C',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 6,
    width: '100%'
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }]
  },
  buttonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
    textAlign: 'center'
  },
  footerSpacer: {
    height: spacing.xxl
  },
  pressed: {
    opacity: 0.75
  }
});
