import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BrandColors, ff, useBrandColors } from '../../components/brand';
import { forgotPasswordService } from '../../services/api';
import { resetToLogin } from '../../navigation/authRoutes';
import { AuthScreen, AuthTitle, Banner, GradientButton, Illustration, TextField, TextLink } from './components/AuthKit';
import { EMAIL_REGEX } from './components/passwordRules';
import { useT } from '../../i18n';

/**
 * "Mot de passe oublié" — same flow as web ForgotPassword.jsx:
 *  1. the user enters their e-mail → POST /auth/reset-password-request?email=…;
 *  2. confirmation step ("Vérifiez votre email"): the backend e-mails a reset LINK
 *     (app.reset-password-url?token=…) that opens the reset page (web, or ResetPasswordScreen
 *     through the scholchat:// deep link) where the new password is chosen.
 */
const ForgotPasswordScreen = () => {
  const c = useBrandColors();
  const s = useMemo(() => createStyles(c), [c]);
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'request' | 'confirmation'>('request');

  const backToLogin = () => resetToLogin(navigation);

  const handleSubmit = async () => {
    // Web: <input type="email" required> — the browser blocks an empty or malformed address.
    if (!email.trim()) {
      setError(t('auth.forgot.missingEmail'));
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      setError(t('auth.common.invalidEmail'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Browsers strip the spaces around an <input type="email"> value, so the web sends it trimmed.
      await forgotPasswordService.requestPasswordReset(email.trim());
      setStep('confirmation');
    } catch {
      setError(t('auth.forgot.failed'));
    } finally {
      setLoading(false);
    }
  };

  if (step === 'confirmation') {
    return (
      <AuthScreen onBack={backToLogin}>
        <Illustration name="forgotPassword" width={Math.min(width * 0.55, 280)} style={s.illustration} />
        <AuthTitle title={t('auth.forgot.sentTitle')} subtitle={t('auth.forgot.sentSubtitle')} />
        <Text style={s.message}>{t('auth.forgot.sentMessage', { email })}</Text>
        <Banner message={t('auth.forgot.spamHint')} type="info" />
        <View style={s.links}>
          <TextLink label={t('auth.forgot.retry')} onPress={() => setStep('request')} />
        </View>
        <View style={s.links}>
          <TextLink label={t('auth.common.backToLogin')} onPress={backToLogin} muted />
        </View>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen onBack={backToLogin}>
      <Illustration name="forgotPassword" width={Math.min(width * 0.55, 280)} style={s.illustration} />
      <AuthTitle title={t('auth.forgot.title')} subtitle={t('auth.forgot.subtitle')} />
      <Banner message={error} />
      <TextField
        label={t('auth.forgot.emailLabel')}
        required
        icon="envelope"
        placeholder={t('auth.common.emailPlaceholder')}
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          if (error) setError('');
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="emailAddress"
        autoComplete="email"
        returnKeyType="send"
        onSubmitEditing={handleSubmit}
      />
      <GradientButton label={t('auth.forgot.submit')} onPress={handleSubmit} loading={loading} style={s.button} />
      <View style={s.links}>
        <TextLink label={t('auth.common.backToLogin')} onPress={backToLogin} />
      </View>
    </AuthScreen>
  );
};

const createStyles = (c: BrandColors) =>
  StyleSheet.create({
    illustration: { marginTop: 16, marginBottom: 24 },
    message: { ...ff('regular'), fontSize: 14, lineHeight: 21, color: c.textSecondary, textAlign: 'center', marginBottom: 16 },
    button: { marginTop: 8 },
    links: { alignItems: 'center', marginTop: 22 },
  });

export default ForgotPasswordScreen;
