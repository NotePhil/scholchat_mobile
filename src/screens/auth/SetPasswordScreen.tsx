import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Button, Input } from '../../components/ui';
import { colors, spacing, typography, useThemeColors } from '../../styles/theme';
import { authService } from '../../services/home/authService';

const PASSWORD_RULES: { test: (v: string) => boolean; label: string }[] = [
  { test: (v) => v.length >= 8, label: '8+ caractères' },
  { test: (v) => /[A-Z]/.test(v), label: 'Majuscule' },
  { test: (v) => /[0-9]/.test(v), label: 'Chiffre' },
  { test: (v) => /[!@#$%^&*(),.?":{}|<>]/.test(v), label: 'Caractère spécial' },
];

/** The equivalent of scholchat_front's PasswordPage — sets the initial password right after activation. */
const SetPasswordScreen = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation();
  const route = useRoute<any>();
  const email: string = route.params?.email ?? '';
  const activationToken: string = route.params?.activationToken ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (!PASSWORD_RULES.every((rule) => rule.test(password))) {
      setError('Mot de passe trop faible. Utilisez des caractères variés.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      await authService.registerPassword(email, password, activationToken);
      setSuccess(true);
      setTimeout(() => navigation.goBack(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la définition du mot de passe.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.content}>
          <FontAwesome5 name="shield-alt" size={40} color={colors.primary} style={styles.icon} />
          <Text style={styles.title}>Sécurisez votre compte</Text>
          {email ? <Text style={styles.email}>{email}</Text> : null}

          {success ? (
            <View style={styles.center}>
              <FontAwesome5 name="check-circle" size={32} color={colors.success} />
              <Text style={styles.successText}>Mot de passe défini avec succès !</Text>
            </View>
          ) : (
            <>
              <Input label="Nouveau mot de passe" placeholder="Minimum 8 caractères" value={password} onChangeText={setPassword} secureTextEntry />
              <View style={styles.rules}>
                {PASSWORD_RULES.map((rule) => (
                  <View key={rule.label} style={styles.ruleItem}>
                    <FontAwesome5
                      name={rule.test(password) ? 'check-circle' : 'circle'}
                      size={12}
                      color={rule.test(password) ? colors.success : colors.grayLight}
                      solid={rule.test(password)}
                    />
                    <Text style={[styles.ruleText, rule.test(password) && styles.ruleTextMet]}>{rule.label}</Text>
                  </View>
                ))}
              </View>
              <Input
                label="Confirmer le mot de passe"
                placeholder="Répétez votre mot de passe"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                error={error}
              />
              <Button label="Valider mon profil" onPress={handleSubmit} loading={loading} fullWidth />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  icon: { alignSelf: 'center', marginBottom: spacing.md },
  title: { ...typography.h1, color: colors.text, textAlign: 'center' },
  email: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg },
  center: { alignItems: 'center' },
  successText: { ...typography.body, color: colors.text, marginTop: spacing.md },
  rules: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  ruleItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ruleText: { ...typography.caption, color: colors.textMuted },
  ruleTextMet: { color: colors.success, fontWeight: '600' },
});

export default SetPasswordScreen;
