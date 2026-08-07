import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Button, Input, LoadingSpinner } from '../../components/ui';
import { colors, spacing, typography } from '../../styles/theme';
import { authService } from '../../services/home/authService';
import { userService } from '../../services/api';
import { decodeToken } from '../../utils/tokenUtils';

type Status = 'loading' | 'success' | 'error';

/** Reached via the emailed activation link (?activationToken=...). */
const AccountActivationScreen = () => {
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
        setMessage("Aucun jeton d'activation fourni.");
        return;
      }
      const decoded = decodeToken(activationToken);
      const decodedEmail = (decoded?.sub as string) || (decoded?.email as string) || '';
      setEmail(decodedEmail);

      try {
        await authService.activateAccount(activationToken);
        setStatus('success');
      } catch (err) {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : "L'activation a échoué.");
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
        {status === 'loading' && <LoadingSpinner label="Vérification en cours..." />}

        {status === 'success' && (
          <View style={styles.center}>
            <FontAwesome5 name="check-circle" size={48} color={colors.success} />
            <Text style={styles.title}>Compte activé !</Text>
            <Text style={styles.subtitle}>Définissez maintenant votre mot de passe pour terminer.</Text>
            <Button
              label="Définir mon mot de passe"
              fullWidth
              style={styles.action}
              onPress={() => navigation.navigate('SetPassword', { email, activationToken })}
            />
          </View>
        )}

        {status === 'error' && (
          <View style={styles.center}>
            <FontAwesome5 name="exclamation-triangle" size={48} color={colors.danger} />
            <Text style={styles.title}>Erreur d'activation</Text>
            <Text style={styles.subtitle}>{message}</Text>

            <Input
              label="Recevoir un nouveau lien d'activation"
              placeholder="Votre email"
              value={resendEmail}
              onChangeText={setResendEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Button
              label={resendStatus === 'sent' ? 'Email envoyé' : 'Renvoyer le lien'}
              onPress={handleResend}
              loading={resendStatus === 'sending'}
              disabled={resendStatus === 'sent'}
              fullWidth
            />
            <Button label="Aller à la connexion" variant="ghost" fullWidth onPress={() => navigation.goBack()} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  center: { alignItems: 'center' },
  title: { ...typography.h1, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xl },
  action: { marginTop: spacing.md },
});

export default AccountActivationScreen;
