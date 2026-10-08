import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { BrandColors, ff, useBrandColors } from '../../components/brand';
import { authService } from '../../services/home/authService';
import { useAuthStore } from '../../store/useAuthStore';
import { useUiStore } from '../../store/useUiStore';
import { AuthScreen, AuthTitle, Banner, GradientButton, Illustration, TextField, TextLink } from './components/AuthKit';
import { PASSWORD_RULES } from './components/passwordRules';
import { useT } from '../../i18n';

/**
 * Forced "Nouveau mot de passe" (first login of a parent / élève whose class request was approved:
 * they signed in with the temporary password e-mailed by the backend). Shown by RootNavigator
 * instead of the dashboard while useAuthStore.mustChangePassword is set — from the login response
 * or a 403 MOT_DE_PASSE_A_CHANGER — and persisted with the session, so it survives a restart.
 *
 * POST /auth/change-password { currentPassword, newPassword }: the temporary password typed on the
 * login screen is reused from memory; after an app restart it is asked again. Then a silent
 * re-login with the new password refreshes the session (a fresh JWT without the flag).
 */
const ForceChangePasswordScreen = () => {
  const c = useBrandColors();
  const s = useMemo(() => createStyles(c), [c]);
  const { width } = useWindowDimensions();
  const { t } = useT();
  const user = useAuthStore((st) => st.user);
  const tempPassword = useAuthStore((st) => st.tempPassword);
  const logout = useAuthStore((st) => st.logout);

  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const askCurrent = !tempPassword;
  const rules = PASSWORD_RULES.map((r) => ({ ...r, ok: r.test(password) }));
  const allRulesOk = rules.every((r) => r.ok);

  const clearError = () => {
    if (error) setError('');
  };

  const handleSubmit = async () => {
    if (loading) return;
    const currentPassword = tempPassword ?? current;
    if (!currentPassword) {
      setError(t('auth.forceChange.currentRequired'));
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
    if (password === currentPassword) {
      setError(t('auth.forceChange.sameAsTemporary'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authService.changePassword(currentPassword, password);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t('auth.errors.changePasswordFailed'));
      setLoading(false);
      return;
    }

    // Password changed: refresh the session with the new password (same role). If that fails,
    // keep the current session and just lift the local flag.
    const store = useAuthStore.getState();
    // A parent (account created with their children) lands on "Mes enfants" to follow the requests.
    if (store.role === 'parent') useUiStore.getState().requestTab('children');
    const email = (user?.email ?? user?.username ?? '').trim();
    try {
      if (!email) throw new Error('no email');
      const fresh = await authService.login(email, password, user?.selectedRole || undefined);
      store.login({ ...fresh, mustChangePassword: false });
      store.clearMustChangePassword();
    } catch {
      store.clearMustChangePassword();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen>
      <Illustration name="newPassword" width={Math.min(width * 0.42, 200)} style={s.illustration} />
      <AuthTitle title={t('auth.forceChange.title')} subtitle={t('auth.forceChange.subtitle')} />
      <Banner message={error} />
      {askCurrent ? (
        <TextField
          label={t('auth.forceChange.temporaryPassword')}
          required
          secure
          icon="key"
          placeholder="••••••••"
          value={current}
          onChangeText={(v) => {
            setCurrent(v);
            clearError();
          }}
          textContentType="password"
          autoComplete="password"
        />
      ) : null}
      <TextField
        label={t('auth.reset.newPassword')}
        required
        secure
        icon="lock"
        placeholder={t('auth.password.placeholder')}
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          clearError();
        }}
        textContentType="newPassword"
        autoComplete="new-password"
      />
      <TextField
        label={t('auth.reset.confirmPassword')}
        required
        secure
        icon="lock"
        placeholder={t('auth.common.confirmPasswordPlaceholder')}
        value={confirm}
        onChangeText={(v) => {
          setConfirm(v);
          clearError();
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
      <GradientButton label={t('auth.forceChange.submit')} onPress={handleSubmit} loading={loading} disabled={!allRulesOk} />
      <Text style={s.hint}>{t('auth.forceChange.hint')}</Text>
      <View style={s.links}>
        <TextLink label={t('auth.forceChange.logout')} onPress={() => logout()} disabled={loading} muted />
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
    hint: { ...ff('regular'), fontSize: 12, lineHeight: 17, color: c.textSecondary, textAlign: 'center', marginTop: 14 },
    links: { alignItems: 'center', marginTop: 18 },
  });

export default ForceChangePasswordScreen;
