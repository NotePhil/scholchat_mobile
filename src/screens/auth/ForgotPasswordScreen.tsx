import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Button, Input } from '../../components/ui';
import { colors, spacing, typography } from '../../styles/theme';
import { forgotPasswordService } from '../../services/api';

const ForgotPasswordScreen = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Veuillez saisir votre email.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await forgotPasswordService.requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      // Anti-enumeration: same as web, show success either way.
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.content}>
          <FontAwesome5 name="key" size={40} color={colors.primary} style={styles.icon} />
          <Text style={styles.title}>Mot de passe oublié</Text>

          {sent ? (
            <View style={styles.successBox}>
              <FontAwesome5 name="check-circle" size={32} color={colors.success} />
              <Text style={styles.successText}>
                Si cet email correspond à un compte, un lien de réinitialisation vient de vous être envoyé.
              </Text>
              <Button label="Retour à la connexion" onPress={() => navigation.goBack()} fullWidth style={styles.action} />
            </View>
          ) : (
            <>
              <Text style={styles.subtitle}>
                Saisissez votre email, nous vous enverrons un lien pour réinitialiser votre mot de passe.
              </Text>
              <Input
                label="Email"
                placeholder="vous@exemple.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                error={error}
              />
              <Button label="Envoyer le lien" onPress={handleSubmit} loading={loading} fullWidth />
              <Button label="Retour" variant="ghost" onPress={() => navigation.goBack()} fullWidth />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  icon: { alignSelf: 'center', marginBottom: spacing.lg },
  title: { ...typography.h1, color: colors.text, textAlign: 'center', marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xl },
  successBox: { alignItems: 'center', gap: spacing.md },
  successText: { ...typography.body, color: colors.text, textAlign: 'center' },
  action: { marginTop: spacing.md },
});

export default ForgotPasswordScreen;
