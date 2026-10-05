import React, { useId } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Polygon, Rect, Stop } from 'react-native-svg';
import { brand } from './tokens';
import { ff } from './fonts';

/**
 * ScholChat logo: rounded square with a small speech-bubble tail at the bottom-left, holding a
 * graduation cap with its tassel. Same geometry as the raster generator used for the native
 * icons (viewBox 0 0 100 108).
 *  - variant "gradient": indigo→purple gradient square, white cap (for light/dark surfaces)
 *  - variant "white": white square, gradient cap (for purple / gradient backgrounds)
 */
export type LogoVariant = 'gradient' | 'white';

export const LOGO_SIZES = { xs: 28, sm: 40, md: 56, lg: 72, xl: 96, xxl: 120 } as const;
export type LogoSize = keyof typeof LOGO_SIZES | number;

const resolveSize = (size: LogoSize) => (typeof size === 'number' ? size : LOGO_SIZES[size]);

interface LogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  style?: StyleProp<ViewStyle>;
}

export const Logo = ({ variant = 'gradient', size = 'md', style }: LogoProps) => {
  const width = resolveSize(size);
  const height = width * 1.08;
  const gradId = `scg${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const grad = `url(#${gradId})`;
  const squareFill = variant === 'gradient' ? grad : brand.white;
  const glyphFill = variant === 'gradient' ? brand.white : grad;

  return (
    <View style={[{ width, height }, style]} accessibilityRole="image" accessibilityLabel="ScholChat">
      <Svg width={width} height={height} viewBox="0 0 100 108">
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={brand.gradientStart} />
            <Stop offset="1" stopColor={brand.gradientEnd} />
          </LinearGradient>
        </Defs>
        {/* Bubble: rounded square + tail */}
        <Rect x={4} y={4} width={92} height={88} rx={24} ry={24} fill={squareFill} />
        <Polygon points="25,86 26.5,101 42,89" fill={squareFill} strokeLinejoin="round" />
        {/* Cap */}
        <Polygon points="16,39 50,23 84,39 50,55" fill={glyphFill} />
        <Polygon points="30,48 50,58 70,48 70,63 50,71 30,63" fill={glyphFill} />
        {/* Tassel: cord across the board (cut-out), then hanging down with a drop */}
        <Line x1={51} y1={39} x2={75} y2={47} stroke={squareFill} strokeWidth={3.2} />
        <Line x1={75} y1={47} x2={75} y2={66} stroke={glyphFill} strokeWidth={3} strokeLinecap="round" />
        <Circle cx={75} cy={47} r={1.8} fill={glyphFill} />
        <Circle cx={75} cy={68.5} r={3} fill={glyphFill} />
      </Svg>
    </View>
  );
};

interface WordmarkProps {
  color?: string;
  size?: number;
  style?: StyleProp<TextStyle>;
}

/** "ScholChat" in Poppins Bold. */
export const Wordmark = ({ color = '#0F172A', size = 28, style }: WordmarkProps) => (
  <Text
    style={[ff('bold'), { color, fontSize: size, letterSpacing: -0.3, lineHeight: Math.round(size * 1.25) }, style]}
    accessibilityRole="header"
  >
    ScholChat
  </Text>
);

interface LockupProps {
  variant?: LogoVariant;
  logoSize?: LogoSize;
  wordmarkSize?: number;
  wordmarkColor?: string;
  tagline?: string;
  taglineColor?: string;
  direction?: 'column' | 'row';
  style?: StyleProp<ViewStyle>;
}

/** Logo + wordmark (+ optional tagline), stacked or side by side. */
export const LogoLockup = ({
  variant = 'gradient',
  logoSize = 'lg',
  wordmarkSize = 28,
  wordmarkColor = '#0F172A',
  tagline,
  taglineColor = '#64748B',
  direction = 'column',
  style,
}: LockupProps) => {
  const row = direction === 'row';
  return (
    <View style={[row ? styles.row : styles.column, style]}>
      <Logo variant={variant} size={logoSize} />
      <View style={row ? styles.rowText : styles.columnText}>
        <Wordmark color={wordmarkColor} size={wordmarkSize} />
        {tagline ? (
          <Text style={[ff('regular'), styles.tagline, { color: taglineColor, textAlign: row ? 'left' : 'center' }]}>
            {tagline}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

export const BRAND_TAGLINE = "L'école connectée, partout.";

const styles = StyleSheet.create({
  column: { alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  columnText: { alignItems: 'center', marginTop: 10 },
  rowText: { marginLeft: 10 },
  tagline: { fontSize: 13, lineHeight: 19, marginTop: 2 },
});

export default Logo;
