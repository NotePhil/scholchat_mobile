import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { BrandColors, Logo, Wordmark, ff, useBrandColors } from '../../components/brand';
import { authService } from '../../services/home/authService';
import { useUser } from '../../context/UserContext';
import RoleSelectorSheet from '../shared/RoleSelectorSheet';
import { LoginResponse } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import { AuthScreen, Banner, GradientButton, Illustration, PromptLink, TextField, TextLink } from './components/AuthKit';
import { TranslationKey, localizedServerMessage, translate, useT } from '../../i18n';

/** Translated wording for the backend's English login errors (other messages are shown as returned). */
const LOGIN_MESSAGES: Record<string, TranslationKey> = {
  'User account is still pending activation': 'auth.login.errors.pendingActivation',
  'User account is inactive': 'auth.login.errors.inactive',
  'Invalid email or password': 'auth.login.errors.invalidCredentials',
};

/** Backend error codes with a translated message (English UI only; French keeps the server text). */
const LOGIN_CODES: Record<string, TranslationKey> = {
  INVALID_STATE: 'auth.login.errors.pendingActivation',
  INACTIVE_USER: 'auth.login.errors.inactive',
  COMPTE_EN_ATTENTE_APPROBATION: 'auth.login.errors.classApprovalPending',
};

/**
 * "Se connecter" — same flow as web Login.jsx: e-mail + password → POST /auth/login. Multi-role
 * accounts pick a profile, then re-login with the chosen role (closing the picker, like the web
 * modal, just goes back to the form). ABONNEMENT_EXPIRE offers "Renouveler mon compte".
 */
const LoginScreen = () => {
  const c = useBrandColors();
  const s = useMemo(() => createStyles(c), [c]);
  const navigation = useNavigation<any>();
  // From the sign-up (existing e-mail): e-mail prefilled, optional information message.
  const route = useRoute<any>();
  const infoMessage: string = typeof route.params?.message === 'string' ? route.params.message : '';
  const { width } = useWindowDimensions();
  const { login } = useUser();
  const { t } = useT();

  const [email, setEmail] = useState<string>(typeof route.params?.email === 'string' ? route.params.email : '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [offreExpireeBlocked, setOffreExpireeBlocked] = useState(false);
  const [pendingAuth, setPendingAuth] = useState<LoginResponse | null>(null);
  const [showRolePicker, setShowRolePicker] = useState(false);

  /**
   * Opens the session. First login with the e-mailed temporary password (mustChangePassword):
   * the typed password is kept in memory only, for the forced "Nouveau mot de passe" screen.
   */
  const openSession = (response: LoginResponse) => {
    useAuthStore.getState().setTempPassword(response.mustChangePassword ? password : null);
    login(response);
  };

  const clearError = () => {
    if (error) setError('');
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setError(t('auth.login.errors.missingFields'));
      return;
    }
    setLoading(true);
    setError('');
    setOffreExpireeBlocked(false);
    try {
      const loginResponse = await authService.login(email.trim(), password);
      if (loginResponse.multiRole && loginResponse.availableRoles && loginResponse.availableRoles.length > 1) {
        setPendingAuth(loginResponse);
        setShowRolePicker(true);
        return;
      }
      openSession(loginResponse);
    } catch (err) {
      const raw = err instanceof Error ? err.message : translate('auth.login.errors.generic');
      const code = (err as { code?: string })?.code;
      setError(
        LOGIN_MESSAGES[raw]
          ? translate(LOGIN_MESSAGES[raw])
          : localizedServerMessage(raw, code ? LOGIN_CODES[code] : undefined)
      );
      if (code === 'ABONNEMENT_EXPIRE') setOffreExpireeBlocked(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRole = async (selectedRole: string) => {
    if (!pendingAuth) return;
    setShowRolePicker(false);
    setLoading(true);
    setError('');
    try {
      const chosen = await authService.login(email.trim(), password, selectedRole);
      openSession(chosen);
    } catch (err) {
      if ((err as { code?: string })?.code === 'ABONNEMENT_EXPIRE') setOffreExpireeBlocked(true);
      setError(err instanceof Error ? err.message : translate('auth.login.errors.profileLogin'));
    } finally {
      setLoading(false);
      setPendingAuth(null);
    }
  };

  return (
    <AuthScreen contentStyle={s.content}>
      <View style={s.brand}>
        <Logo size="lg" />
        <Wordmark color={c.text} size={30} style={s.wordmark} />
        <Text style={s.tagline}>{t('brand.tagline')}</Text>
      </View>

      {!error && infoMessage ? <Banner type="info" message={infoMessage} /> : null}
      <Banner message={error} />
      {offreExpireeBlocked ? (
        <TextLink
          label={t('auth.login.renewAccount')}
          onPress={() => navigation.navigate('Renewal')}
          style={s.renewLink}
        />
      ) : null}

      <TextField
        icon="envelope"
        placeholder={t('auth.login.emailPlaceholder')}
        accessibilityLabel={t('auth.login.emailPlaceholder')}
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          clearError();
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="emailAddress"
        autoComplete="email"
        returnKeyType="next"
      />
      <TextField
        icon="lock"
        placeholder={t('auth.common.password')}
        accessibilityLabel={t('auth.common.password')}
        secure
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          clearError();
        }}
        textContentType="password"
        autoComplete="password"
        returnKeyType="go"
        onSubmitEditing={handleSignIn}
        containerStyle={s.passwordField}
      />
      <View style={s.linksRow}>
        <TextLink label={t('verifyAccount.link')} onPress={() => navigation.navigate('VerifyAccount', { email: email.trim() })} />
        <TextLink label={t('auth.login.forgotPassword')} onPress={() => navigation.navigate('ForgotPassword', { email: email.trim() })} />
      </View>

      <GradientButton label={t('auth.login.signIn')} onPress={handleSignIn} loading={loading} />

      <View style={s.signupRow}>
        <PromptLink
          text={t('auth.login.noAccount')}
          link={t('auth.common.createAccount')}
          onPress={() => navigation.navigate('RoleChoice', { fromLogin: true })}
        />
      </View>

      <View style={s.spacer} />
      <Illustration name="loginHero" width={Math.min(width - 48, 420)} style={s.hero} />

      <RoleSelectorSheet
        visible={showRolePicker}
        roles={pendingAuth?.availableRoles || []}
        pendingRoles={pendingAuth?.pendingRoles || []}
        onSelect={handleSelectRole}
        onClose={() => {
          setShowRolePicker(false);
          setPendingAuth(null);
        }}
        title={t('auth.login.selectProfile')}
        subtitle={t('auth.login.selectProfileSubtitle')}
      />
    </AuthScreen>
  );
};

const createStyles = (c: BrandColors) =>
  StyleSheet.create({
    content: { paddingTop: 8 },
    brand: { alignItems: 'center', marginBottom: 28 },
    wordmark: { marginTop: 10 },
    tagline: { ...ff('regular'), fontSize: 14, lineHeight: 20, color: c.textSecondary, marginTop: 2 },
    renewLink: { alignSelf: 'flex-start', marginTop: -6, marginBottom: 14 },
    passwordField: { marginBottom: 10 },
    linksRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 22 },
    signupRow: { marginTop: 22, alignItems: 'center' },
    spacer: { flex: 1, minHeight: 16 },
    hero: { marginTop: 8 },
  });

export default LoginScreen;
