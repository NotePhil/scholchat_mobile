import React, { useEffect, useRef } from 'react';
import { Animated, DimensionValue, StyleProp, ViewStyle } from 'react-native';
import { radius, useThemeColors } from '../../styles/theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A pulsing placeholder block for skeleton-loading screens — stand-ins for
 * text lines, avatars, and media while real data is still in flight, so the
 * page's shape is visible immediately instead of a blank screen + spinner.
 */
const Skeleton = ({ width = '100%', height = 14, borderRadius = radius.sm, style }: SkeletonProps) => {
  const colors = useThemeColors();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: colors.grayLight, opacity },
        style,
      ]}
    />
  );
};

export default Skeleton;
