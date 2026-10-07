import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { BrandColors, ff, useBrandColors } from '../../components/brand';
import { authService } from '../../services/home/authService';
import { resetToLogin } from '../../navigation/authRoutes';
import { AuthScreen, AuthTitle, Banner, GradientButton, Illustration, TextField, TextLink } from './components/AuthKit';
import { EMAIL_REGEX } from './components/passwordRules';
import { translate, useT } from '../../i18n';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;

/** 6 digit boxes driven by ONE hidden TextInput (keeps paste + SMS/e-mail autofill working). */
const OtpBoxes = ({
  value,
  onChange,
  onComplete,
  error,
  c,
  s,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete: (v: string) => void;
  error?: boolean;
  c: BrandColors;
  s: ReturnType<typeof createStyles>;
}) => {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const { t } = useT();
  return (
    <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()} style={s.otpRow} accessibilityLabel={t('verifyAccount.codeLabel')}>
      {Array.from({ length: CODE_LENGTH }).map((_, i) => {
        const digit = value[i] ?? '';
        const active = focused && (i === value.length || (i === CODE_LENGTH - 1 && value.length === CODE_LENGTH));
        return (
          <View
            key={i}
            style={[
              s.otpBox,
              { borderColor: error ? c.danger : active ? c.primary : digit ? c.text : c.border, backgroundColor: c.input },
            ]}
          >
            <Text style={s.otpDigit}>{digit}</Text>
          </View>
        );
      })}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(raw) => {
          // Paste-friendly: keep the digits only ("123 456", "Code: 123456"…).
          const digits = raw.replace(/\D/g, '').slice(0, CODE_LENGTH);
          onChange(digits);
          if (digits.length === CODE_LENGTH) onComplete(digits);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH + 8}
        autoFocus
        caretHidden
        style={s.otpHiddenInput}
        accessibilityLabel={t('verifyAccount.codeLabel')}
      />
    </TouchableOpacity>
  );
};

/**
 * "Vérifier mon compte" — activation by e-mail code instead of the e-mailed link:
 *  1. e-mail → POST /auth/verification-compte/envoyer (always 200);
 *  2. 6-digit code → POST /auth/verification-compte/verifier → { activationToken, email };
 *  3. continues exactly like the activation deep link: SetPassword (POST /auth/registerPassword
 *     with Authorization: Bearer <activationToken>), then back to the login form.
 */
const VerifyAccountScreen = () => {
  const c = useBrandColors();
  const s = useMemo(() => createStyles(c), [c]);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { width } = useWindowDimensions();
  const { t } = useT();

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState<string>(route.params?.email ?? '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const backToLogin = () => resetToLogin(navigation);

  const send = async (isResend = false) => {
    const e = email.trim();
    if (!e) {
      setError(t('auth.forgot.missingEmail'));
      return;
    }
    if (!EMAIL_REGEX.test(e)) {
      setError(t('auth.common.invalidEmail'));
      return;
    }
    setLoading(true);
    setError('');
    setInfo('');
    try {
      await authService.sendVerificationCode(e);
      setStep('code');
      setCode('');
      setCooldown(RESEND_SECONDS);
      if (isResend) setInfo(t('verifyAccount.resent'));
    } catch (err) {
      const errCode = (err as { code?: string })?.code;
      if (errCode === 'TROP_DE_TENTATIVES') setCooldown(RESEND_SECONDS);
      setError(err instanceof Error ? err.message : translate('verifyAccount.errors.sendFailed'));
    } finally {
      setLoading(false);
    }
  };

  const verify = async (value = code) => {
    if (loading) return;
    if (value.length !== CODE_LENGTH) {
      setError(t('verifyAccount.codeIncomplete'));
      return;
    }
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const { activationToken, email: verifiedEmail } = await authService.verifyAccountCode(email, value);
      // Same continuation as the activation link (AccountActivationScreen → SetPassword).
      navigation.replace('SetPassword', { email: verifiedEmail, activationToken });
    } catch (err) {
      const errCode = (err as { code?: string })?.code;
      if (errCode === 'CODE_VERIFICATION_INVALIDE' || errCode === 'CODE_VERIFICATION_EXPIRE') setCode('');
      setError(err instanceof Error ? err.message : translate('verifyAccount.errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  if (step === 'code') {
    return (
      <AuthScreen onBack={() => setStep('email')}>
        <Illustration name="newPassword" width={Math.min(width * 0.45, 200)} style={s.illustration} />
        <AuthTitle title={t('verifyAccount.codeTitle')} subtitle={t('verifyAccount.codeSubtitle', { email: email.trim() })} />
        <Banner message={error} />
        <Banner message={info} type="success" />
        <OtpBoxes
          value={code}
          onChange={(v) => {
            setCode(v);
            if (error) setError('');
          }}
          onComplete={(v) => verify(v)}
          error={!!error}
          c={c}
          s={s}
        />
        <GradientButton label={t('verifyAccount.verify')} onPress={() => verify()} loading={loading} disabled={code.length !== CODE_LENGTH} style={s.button} />
        <View style={s.links}>
          {cooldown > 0 ? (
            <Text style={s.muted}>{t('verifyAccount.resendIn', { seconds: cooldown })}</Text>
          ) : (
            <TextLink label={t('verifyAccount.resend')} onPress={() => send(true)} disabled={loading} />
          )}
        </View>
        <Banner message={t('verifyAccount.spamHint')} type="info" style={s.spam} />
        <View style={s.links}>
          <TextLink
            label={t('verifyAccount.changeEmail')}
            onPress={() => {
              setStep('email');
              setError('');
              setInfo('');
            }}
            muted
          />
        </View>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen onBack={backToLogin}>
      <Illustration name="newPassword" width={Math.min(width * 0.45, 200)} style={s.illustration} />
      <AuthTitle title={t('verifyAccount.title')} subtitle={t('verifyAccount.subtitle')} />
      <Banner message={error} />
      <TextField
        label={t('verifyAccount.emailLabel')}
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
        onSubmitEditing={() => send()}
      />
      <GradientButton label={t('verifyAccount.send')} onPress={() => send()} loading={loading} disabled={cooldown > 0 && !!error} style={s.button} />
      {cooldown > 0 && error ? <Text style={[s.muted, s.center]}>{t('verifyAccount.resendIn', { seconds: cooldown })}</Text> : null}
      <View style={s.links}>
        <TextLink label={t('auth.common.backToLogin')} onPress={backToLogin} />
      </View>
    </AuthScreen>
  );
};

const createStyles = (c: BrandColors) =>
  StyleSheet.create({
    illustration: { marginTop: 12, marginBottom: 20 },
    button: { marginTop: 8 },
    links: { alignItems: 'center', marginTop: 20 },
    muted: { ...ff('regular'), fontSize: 13, color: c.textSecondary },
    center: { textAlign: 'center', marginTop: 10 },
    spam: { marginTop: 20 },
    otpRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 18, position: 'relative' },
    otpBox: {
      flex: 1,
      maxWidth: 52,
      aspectRatio: 0.85,
      borderWidth: 1.5,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    otpDigit: { ...ff('semibold'), fontSize: 22, color: c.text },
    // Covers the boxes (taps focus it, long-press offers "Paste") while staying invisible.
    otpHiddenInput: { ...StyleSheet.absoluteFill, opacity: 0.02, color: 'transparent', fontSize: 1 },
  });

export default VerifyAccountScreen;
