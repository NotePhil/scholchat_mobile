import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Button, Input, LoadingSpinner } from '../../components/ui';
import { colors, spacing, typography, useThemeColors } from '../../styles/theme';
import { authService } from '../../services/home/authService';
import { userService } from '../../services/api';
import { decodeToken } from '../../utils/tokenUtils';
import { translate, useT } from '../../i18n';
import { resetToLogin } from '../../navigation/authRoutes';

type Status = 'loading' | 'success' | 'error';

/** Reached via the emailed activation link (?activationToken=...). */
const AccountActivationScreen = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const activationToken: string | undefined = route.params?.activationToken;

  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  useEffect(() => {
    const run = async () => {
      if (!activationToken) {
        setStatus('error');
        setMessage(translate('auth.activation.noToken'));
        return;
      }
      const decoded = decodeToken(activationToken);
      const decodedEmail = (decoded?.sub as string) || (decoded?.email as string) || '';
      setEmail(decodedEmail);

      try {
        await authService.activateAccount(activationToken);
        setStatus('success');
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        // Link opened again after activation but before the password was set ("must be in PENDING
        // state"): like web AccountActivation.jsx, go on to the password page with the same token.
        if (msg.includes('PENDING') || msg.includes('ACTIVE')) {
          setStatus('success');
          return;
        }
        setStatus('error');
        setMessage(msg || translate('auth.activation.failed'));
      }
    };
    run();
  }, [activationToken]);

  const handleResend = async () => {
    if (!resendEmail.trim()) return;
    setResendStatus('sending');
    try {
      await userService.resendActivationEmail(resendEmail.trim());
      setResendStatus('sent');
    } catch {
      setResendStatus('idle');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {status === 'loading' && <LoadingSpinner label={t('auth.activation.verifying')} />}

        {status === 'success' && (
          <View style={styles.center}>
            <FontAwesome5 name="check-circle" size={48} color={colors.success} />
            <Text style={styles.title}>{t('auth.activation.successTitle')}</Text>
            <Text style={styles.subtitle}>{t('auth.activation.successSubtitle')}</Text>
            <Button
              label={t('auth.activation.setPassword')}
              fullWidth
              style={styles.action}
              onPress={() => navigation.navigate('SetPassword', { email, activationToken })}
            />
          </View>
        )}

        {status === 'error' && (
          <View style={styles.center}>
            <FontAwesome5 name="exclamation-triangle" size={48} color={colors.danger} />
            <Text style={styles.title}>{t('auth.activation.errorTitle')}</Text>
            <Text style={styles.subtitle}>{message}</Text>

            <Input
              label={t('auth.activation.resendLabel')}
              placeholder={t('auth.activation.yourEmail')}
              value={resendEmail}
              onChangeText={setResendEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Button
              label={resendStatus === 'sent' ? t('auth.activation.emailSent') : t('auth.activation.resendLink')}
              onPress={handleResend}
              loading={resendStatus === 'sending'}
              disabled={resendStatus === 'sent'}
              fullWidth
            />
            <Button label={t('auth.activation.goToLogin')} variant="ghost" fullWidth onPress={() => resetToLogin(navigation)} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  center: { alignItems: 'center' },
  title: { ...typography.h1, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xl },
  action: { marginTop: spacing.md },
});

export default AccountActivationScreen;
