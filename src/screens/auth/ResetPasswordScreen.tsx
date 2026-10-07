import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { BrandColors, ff, useBrandColors } from '../../components/brand';
import { forgotPasswordService } from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import { resetToLogin } from '../../navigation/authRoutes';
import { AuthScreen, AuthTitle, Banner, GradientButton, Illustration, TextField, TextLink } from './components/AuthKit';
import { useT } from '../../i18n';
import { PASSWORD_RULES as RULES } from './components/passwordRules';

/**
 * "Nouveau mot de passe" — mirror of web ResetPassword.jsx, reached from the e-mailed reset link
 * through the deep link scholchat://schoolchat/reset-password?token=… (same path as the web page).
 * Token from the link, new password + confirmation, the web's 4 rules, then
 * POST /auth/reset-password { token, newPassword } and back to the login screen.
 */
const ResetPasswordScreen = () => {
  const c = useBrandColors();
  const s = useMemo(() => createStyles(c), [c]);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { width } = useWindowDimensions();
  const { t } = useT();
  const token: string = typeof route.params?.token === 'string' ? route.params.token : '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(token ? '' : t('auth.reset.invalidLink'));
  const [success, setSuccess] = useState(false);

  const rules = RULES.map((r) => ({ ...r, ok: r.test(password) }));
  const allRulesOk = rules.every((r) => r.ok);

  // Web clears the stored session when the reset page opens (localStorage.clear()).
  useEffect(() => {
    const { isAuthenticated, logout } = useAuthStore.getState();
    if (isAuthenticated) logout();
  }, []);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => resetToLogin(navigation), 3000);
    return () => clearTimeout(timer);
  }, [success, navigation]);

  const handleSubmit = async () => {
    if (!token) {
      setError(t('auth.reset.invalidToken'));
      return;
    }
    if (!allRulesOk) {
      setError(t('auth.reset.weak'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.common.passwordMismatch'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await forgotPasswordService.resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t('auth.reset.failed'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthScreen center>
        <Illustration name="newPassword" width={Math.min(width * 0.42, 200)} style={s.illustration} />
        <AuthTitle title={t('auth.reset.success')} subtitle={t('auth.reset.redirecting')} />
        <View style={s.links}>
          <TextLink label={t('auth.common.backToLogin')} onPress={() => resetToLogin(navigation)} />
        </View>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen onBack={() => resetToLogin(navigation)}>
      <Illustration name="newPassword" width={Math.min(width * 0.42, 200)} style={s.illustration} />
      <AuthTitle title={t('auth.reset.title')} subtitle={t('auth.reset.subtitle')} />
      <Banner message={error} />
      <TextField
        label={t('auth.reset.newPassword')}
        required
        secure
        placeholder="••••••••"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          if (error && token) setError('');
        }}
        textContentType="newPassword"
        autoComplete="new-password"
      />
      <TextField
        label={t('auth.reset.confirmPassword')}
        required
        secure
        placeholder="••••••••"
        value={confirm}
        onChangeText={(v) => {
          setConfirm(v);
          if (error && token) setError('');
        }}
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
      />
      <View style={s.rules}>
        {rules.map((r) => (
          <View key={r.key} style={s.rule}>
            <FontAwesome5
              name={r.ok ? 'check-circle' : 'circle'}
              solid={r.ok}
              size={13}
              color={r.ok ? c.success : c.textSecondary}
            />
            <Text style={[s.ruleText, r.ok && { color: c.success }]}>{t(r.label)}</Text>
          </View>
        ))}
      </View>
      <GradientButton
        label={t('auth.reset.submit')}
        onPress={handleSubmit}
        loading={loading}
        disabled={!allRulesOk}
      />
      <View style={s.links}>
        <TextLink label={t('auth.common.backToLogin')} onPress={() => resetToLogin(navigation)} />
      </View>
    </AuthScreen>
  );
};

const createStyles = (c: BrandColors) =>
  StyleSheet.create({
    illustration: { marginTop: 8, marginBottom: 20 },
    rules: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 18, rowGap: 8 },
    rule: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '50%' },
    ruleText: { ...ff('medium'), fontSize: 12, color: c.textSecondary },
    links: { alignItems: 'center', marginTop: 22 },
  });

export default ResetPasswordScreen;
