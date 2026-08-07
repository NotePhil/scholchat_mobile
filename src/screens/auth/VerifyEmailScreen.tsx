import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Button } from '../../components/ui';
import { colors, spacing, typography } from '../../styles/theme';
import { userService } from '../../services/api';

/** Shown right after signup, telling the user to check their inbox. */
const VerifyEmailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const email: string | undefined = route.params?.email;
  const userType: string | undefined = route.params?.userType;

  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');

  const handleResend = async () => {
    if (!email || userType === 'Professeur') return;
    setSending(true);
    setMessage('');
    try {
      await userService.resendActivationEmail(email);
      setMessage("L'email de vérification a été renvoyé.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Échec de l'envoi.");
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <FontAwesome5 name="envelope" size={40} color={colors.primary} />
        </View>
        <Text style={styles.title}>Vérifiez votre e-mail</Text>
        <Text style={styles.message}>
          Nous avons envoyé un e-mail à {email ? <Text style={styles.bold}>{email}</Text> : 'votre adresse'}.
        </Text>
        <Text style={styles.instructions}>
          {userType === 'Professeur'
            ? 'Un mail de confirmation de création de compte a été envoyé. Veuillez consulter votre boîte mail pour plus d’informations.'
            : "Suivez les instructions dans l'email. Si vous ne le voyez pas, vérifiez votre dossier spam."}
        </Text>

        {message ? <Text style={styles.feedback}>{message}</Text> : null}

        {userType !== 'Professeur' && (
          <Button label="Renvoyer l'email" onPress={handleResend} loading={sending} fullWidth style={styles.action} />
        )}
        <Button label="Aller à la connexion" variant="ghost" fullWidth onPress={() => navigation.goBack()} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  iconWrap: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { ...typography.h1, color: colors.text, textAlign: 'center', marginBottom: spacing.sm },
  message: { ...typography.body, color: colors.text, textAlign: 'center', marginBottom: spacing.sm },
  bold: { fontWeight: '700' },
  instructions: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg },
  feedback: { ...typography.caption, color: colors.success, textAlign: 'center', marginBottom: spacing.md },
  action: { marginBottom: spacing.sm },
});

export default VerifyEmailScreen;
