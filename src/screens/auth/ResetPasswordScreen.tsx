import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Button, Input } from '../../components/ui';
import { colors, spacing, typography } from '../../styles/theme';
import { forgotPasswordService } from '../../services/api';

/** Reached via the emailed reset link (?token=...). */
const ResetPasswordScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const token: string | undefined = route.params?.token;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!token) {
      setError('Lien invalide : jeton manquant.');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await forgotPasswordService.resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => navigation.goBack(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la réinitialisation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.content}>
          <FontAwesome5 name="lock" size={40} color={colors.primary} style={styles.icon} />
          <Text style={styles.title}>Réinitialiser le mot de passe</Text>

          {success ? (
            <View style={styles.successBox}>
              <FontAwesome5 name="check-circle" size={32} color={colors.success} />
              <Text style={styles.successText}>Mot de passe mis à jour avec succès !</Text>
            </View>
          ) : (
            <>
              <Input
                label="Nouveau mot de passe"
                placeholder="Minimum 8 caractères"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <Input
                label="Confirmer le mot de passe"
                placeholder="Répétez le mot de passe"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                error={error}
              />
              <Button label="Réinitialiser" onPress={handleSubmit} loading={loading} fullWidth />
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
  title: { ...typography.h1, color: colors.text, textAlign: 'center', marginBottom: spacing.xl },
  successBox: { alignItems: 'center', gap: spacing.md },
  successText: { ...typography.body, color: colors.text, textAlign: 'center' },
});

export default ResetPasswordScreen;
