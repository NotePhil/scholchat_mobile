import React, { useEffect } from 'react';
import { AppState, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useAuthStore } from '../../store/useAuthStore';
import { useThemeStore } from '../../store/useThemeStore';
import { isTokenExpired } from '../../utils/tokenUtils';
import { useT } from '../../i18n';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Port of web's "Session Expirée" modal (Principal.jsx + Principal.css):
 * dark overlay, amber clock icon, title, message and a "Se reconnecter"
 * button that logs out. Can't be dismissed any other way.
 *
 * Shown when useAuthStore.sessionExpired is set — by the API client on a
 * 401/403, or here when the token's `exp` passes while the app is open
 * (checked every 5 minutes like web, and whenever the app returns to the
 * foreground, since timers don't run in the background).
 */
const SessionExpiredModal = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const sessionExpired = useAuthStore((s) => s.sessionExpired);
  const logout = useAuthStore((s) => s.logout);
  const isDark = useThemeStore((s) => s.mode === 'dark');
  const { t } = useT();

  useEffect(() => {
    if (!isAuthenticated) return;
    const check = () => {
      const { token, markSessionExpired } = useAuthStore.getState();
      if (!token || isTokenExpired(token)) markSessionExpired();
    };
    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [isAuthenticated]);

  const visible = isAuthenticated && sessionExpired;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={[styles.card, isDark && styles.cardDark]}>
          <Svg width={64} height={64} viewBox="0 0 24 24" fill="none">
            <Circle cx={12} cy={12} r={10} stroke="#f59e0b" strokeWidth={2} fill="#fef3c7" />
            <Path d="M12 8v4l3 3" stroke="#f59e0b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={[styles.title, isDark && styles.titleDark]}>{t('session.expiredTitle')}</Text>
          <Text style={[styles.message, isDark && styles.messageDark]}>
            {t('session.expiredMessage')}
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => logout()} activeOpacity={0.85}>
            <Text style={styles.buttonText}>{t('session.reconnect')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  cardDark: { backgroundColor: '#2D3748' },
  title: { marginTop: 16, marginBottom: 12, fontSize: 22, fontWeight: '600', color: '#2C3E50' },
  titleDark: { color: '#FFFFFF' },
  message: { marginBottom: 24, fontSize: 15, lineHeight: 22, color: '#6C757D', textAlign: 'center' },
  messageDark: { color: '#CBD5E0' },
  // web .reconnect-button: #4a6da7 → #3a5d97 gradient, 14×32 padding, min 160
  button: {
    backgroundColor: '#4A6DA7',
    paddingVertical: 14,
    paddingHorizontal: 32,
    minWidth: 160,
    alignItems: 'center',
    borderRadius: 8,
    shadowColor: '#4A6DA7',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});

export default SessionExpiredModal;
