import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, StatusBar, StyleSheet, Text, View } from 'react-native';
import { Logo, brand, ff, useBrandColors } from '../../components/brand';
import { useT } from '../../i18n';

/**
 * Animated splash shown right after the native splash (same #8C52FF background, so the hand-off
 * is seamless) while the session hydrates, the fonts load and the onboarding flag is read.
 * Dark mode follows the board's "Splash (mode sombre)": slate background, gradient logo.
 * `fontsReady` re-renders the texts in Poppins as soon as it is available.
 */
const SplashScreen = ({ fontsReady }: { fontsReady?: boolean }) => {
  const c = useBrandColors();
  const dark = c.mode === 'dark';
  const { t } = useT();
  const logoAnim = useRef(new Animated.Value(0)).current;
  const textAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(logoAnim, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
      Animated.timing(textAnim, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [logoAnim, textAnim]);

  const bg = dark ? '#0F172A' : brand.primary;
  // `c` (useBrandColors) changes when Poppins is applied, re-rendering the texts with it.
  void fontsReady;

  return (
    <View style={[styles.root, { backgroundColor: bg }]} accessibilityLabel={t('brand.loading')}>
      <StatusBar barStyle="light-content" backgroundColor={bg} />
      <Animated.View
        style={{
          opacity: logoAnim,
          transform: [{ scale: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
        }}
      >
        <Logo variant={dark ? 'gradient' : 'white'} size={112} />
      </Animated.View>
      <Animated.View
        style={{
          alignItems: 'center',
          opacity: textAnim,
          transform: [{ translateY: textAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        }}
      >
        <Text style={[ff('bold'), styles.wordmark]}>ScholChat</Text>
        <Text style={[ff('regular'), styles.tagline, { color: dark ? '#CBD5E1' : 'rgba(255,255,255,0.92)' }]}>
          {t('brand.tagline')}
        </Text>
      </Animated.View>
      <ActivityIndicator style={styles.spinner} color={dark ? '#A78BFA' : '#FFFFFF'} size="large" />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  wordmark: { color: '#FFFFFF', fontSize: 40, lineHeight: 52, letterSpacing: -0.5, marginTop: 18 },
  tagline: { fontSize: 17, lineHeight: 25, textAlign: 'center', marginTop: 4 },
  spinner: { position: 'absolute', bottom: '18%' },
});

export default SplashScreen;
