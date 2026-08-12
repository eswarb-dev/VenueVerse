import { Image, StyleSheet, View } from 'react-native';
import { colors, radius } from '@/constants/theme';

const logoSource = require('../../assets/logo.png');

type AppLogoMarkProps = {
  size?: number;
  contained?: boolean;
};

export function AppLogoMark({ size = 52, contained = true }: AppLogoMarkProps) {
  const imageSize = Math.round(size * (contained ? 0.7 : 1));

  if (!contained) {
    return <Image source={logoSource} resizeMode="contain" style={{ width: size, height: size }} />;
  }

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      <Image source={logoSource} resizeMode="contain" style={{ width: imageSize, height: imageSize }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  }
});
