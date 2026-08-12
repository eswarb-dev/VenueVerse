import { ReactNode } from 'react';
import {
  ScrollView,
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle
} from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EXTRA_TAB_PADDING, TOP_SAFE_AREA_PADDING } from '@/constants/layout';
import { colors, spacing } from '@/constants/theme';

type ScreenContainerProps = {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  includeBottomTabPadding?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  scrollProps?: Omit<ScrollViewProps, 'contentContainerStyle' | 'style'>;
};

export function ScreenContainer({
  children,
  scroll = false,
  padded = true,
  includeBottomTabPadding = true,
  contentStyle,
  style,
  scrollProps
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const horizontalPadding = padded ? spacing.md : 0;
  const bottomPadding = includeBottomTabPadding
    ? tabBarHeight + EXTRA_TAB_PADDING
    : insets.bottom + EXTRA_TAB_PADDING;
  const resolvedContentStyle = [
    styles.content,
    {
      paddingTop: insets.top + TOP_SAFE_AREA_PADDING,
      paddingBottom: bottomPadding,
      paddingHorizontal: horizontalPadding
    },
    contentStyle
  ];

  if (scroll) {
    return (
      <ScrollView
        style={[styles.root, style]}
        contentContainerStyle={resolvedContentStyle}
        showsVerticalScrollIndicator={false}
        {...scrollProps}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.root, style]}>
      <View style={resolvedContentStyle}>{children}</View>
    </View>
  );
}

export default ScreenContainer;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    flexGrow: 1
  }
});
