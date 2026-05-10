import React from 'react';
import { DimensionValue, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';

type Props = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

export default function GTLoadingSkeleton({ width = '100%', height = 16, radius = 12, style }: Props) {
  const pulse = useSharedValue(0.45);

  React.useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 950 }), -1, true);
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0.45, 1], [0.55, 1]),
  }));

  return <Animated.View style={[styles.skeleton, animatedStyle, { width, height, borderRadius: radius }, style]} />;
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.backgroundAccent,
  },
});
