import { memo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/constants/theme';

type AuthGradientBackgroundProps = {
  style?: StyleProp<ViewStyle>;
};

export const AuthGradientBackground = memo(function AuthGradientBackground({ style }: AuthGradientBackgroundProps) {
  return (
    <View pointerEvents="none" style={[styles.root, style]}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientMid, colors.gradientSoft, colors.gradientEnd]}
        locations={[0, 0.38, 0.72, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobMid]} />
      <View style={[styles.blob, styles.blobBottom]} />
      <View style={[styles.ring, styles.ringLarge]} />
      <View style={[styles.ring, styles.ringSmall]} />
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden'
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: colors.blobLighter
  },
  blobTop: {
    width: 230,
    height: 230,
    top: -82,
    right: -54,
    opacity: 0.28
  },
  blobMid: {
    width: 190,
    height: 190,
    top: '38%',
    left: -88,
    opacity: 0.24
  },
  blobBottom: {
    width: 260,
    height: 260,
    right: -112,
    bottom: -98,
    opacity: 0.32
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.blobLight
  },
  ringLarge: {
    width: 320,
    height: 320,
    left: -128,
    top: 92,
    opacity: 0.28
  },
  ringSmall: {
    width: 148,
    height: 148,
    right: 28,
    top: '28%',
    opacity: 0.36
  }
});
