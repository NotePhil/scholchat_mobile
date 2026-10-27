import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Button, Input } from '../../components/ui';
import { colors, spacing, typography, useThemeColors } from '../../styles/theme';
import { authService } from '../../services/home/authService';
import { translate, useT } from '../../i18n';
import { resetToLogin } from '../../navigation/authRoutes';
import { PASSWORD_RULES } from './components/passwordRules';


/** The equivalent of scholchat_front's PasswordPage — sets the initial password right after activation. */
const SetPasswordScreen = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
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
      setError(t('auth.setPassword.tooWeak'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.common.passwordMismatch'));
      return;
    }
    setLoading(true);
    try {
      await authService.registerPassword(email, password, activationToken);
      setSuccess(true);
      // Web PasswordPage goes to the login form (goBack would return to the activation screen).
      setTimeout(() => resetToLogin(navigation as any), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : translate('auth.setPassword.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <FontAwesome5 name="shield-alt" size={40} color={colors.primary} style={styles.icon} />
          <Text style={styles.title}>{t('auth.setPassword.title')}</Text>
          {email ? <Text style={styles.email}>{email}</Text> : null}

          {success ? (
            <View style={styles.center}>
              <FontAwesome5 name="check-circle" size={32} color={colors.success} />
              <Text style={styles.successText}>{t('auth.setPassword.success')}</Text>
            </View>
          ) : (
            <>
              <Input label={t('auth.reset.title')} placeholder={t('auth.password.placeholder')} value={password} onChangeText={setPassword} secureTextEntry />
              <View style={styles.rules}>
                {PASSWORD_RULES.map((rule) => (
                  <View key={rule.key} style={styles.ruleItem}>
                    <FontAwesome5
                      name={rule.test(password) ? 'check-circle' : 'circle'}
                      size={12}
                      color={rule.test(password) ? colors.success : colors.grayLight}
                      solid={rule.test(password)}
                    />
                    <Text style={[styles.ruleText, rule.test(password) && styles.ruleTextMet]}>{t(rule.label)}</Text>
                  </View>
                ))}
              </View>
              <Input
                label={t('auth.common.confirmPassword')}
                placeholder={t('auth.setPassword.repeat')}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                error={error}
              />
              <Button label={t('auth.setPassword.submit')} onPress={handleSubmit} loading={loading} fullWidth />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
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
