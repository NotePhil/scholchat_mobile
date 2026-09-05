import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Button, Input } from '../../components/ui';
import { colors, spacing, typography } from '../../styles/theme';
import { authService } from '../../services/home/authService';
import { useUser } from '../../context/UserContext';

import RoleSelectorSheet from '../shared/RoleSelectorSheet';
import { LoginResponse } from '../../types';

const logo = require('../../../assets/logo.png');

/**
 * Full-page login (replaces the old AuthModal overlay) — this is the direct
 * landing screen for a logged-out user, per explicit request: no marketing
 * tabs, straight to sign-in. Supports multi-role selection if account has >1 role.
 */
const LoginScreen = () => {
  const navigation = useNavigation<any>();
  const { login } = useUser();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingAuth, setPendingAuth] = useState<LoginResponse | null>(null);
  const [showRolePicker, setShowRolePicker] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setError('Veuillez remplir tous les champs.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const loginResponse = await authService.login(email.trim(), password);
      if (loginResponse.multiRole && loginResponse.availableRoles && loginResponse.availableRoles.length > 1) {
        setPendingAuth(loginResponse);
        setShowRolePicker(true);
        return;
      }
      login(loginResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Email ou mot de passe incorrect.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRole = async (selectedRole: string) => {
    if (!pendingAuth) return;
    setLoading(true);
    try {
      const switched = await authService.switchRole(selectedRole);
      login(switched);
    } catch {
      // Fallback: use initial auth response with selected role
      login({ ...pendingAuth, role: selectedRole });
    } finally {
      setLoading(false);
      setShowRolePicker(false);
      setPendingAuth(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Image source={logo} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>ScholChat</Text>
          <Text style={styles.subtitle}>Connectez-vous à votre espace</Text>

          <Input
            label="Email"
            placeholder="vous@exemple.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <View style={styles.passwordWrap}>
            <Input
              label="Mot de passe"
              placeholder="Votre mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              error={error}
            />
            <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword((v) => !v)}>
              <FontAwesome5 name={showPassword ? 'eye-slash' : 'eye'} size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.forgotLink} onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.forgotLinkText}>Mot de passe oublié ?</Text>
          </TouchableOpacity>

          <Button label="Se connecter" onPress={handleSignIn} loading={loading} fullWidth style={styles.loginButton} />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Pas encore de compte ? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
              <Text style={styles.footerLink}>S'inscrire</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <RoleSelectorSheet
        visible={showRolePicker}
        roles={pendingAuth?.availableRoles || []}
        onSelect={handleSelectRole}
        onClose={() => {
          setShowRolePicker(false);
          if (pendingAuth) login(pendingAuth);
        }}
        title="Choisir un profil"
        subtitle="Vous avez plusieurs rôles. Choisissez celui que vous souhaitez utiliser."
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  logo: { width: 96, height: 96, alignSelf: 'center', marginBottom: spacing.md },
  title: { ...typography.h1, color: colors.text, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xl },
  passwordWrap: { position: 'relative' },
  eyeButton: { position: 'absolute', right: spacing.md, top: 38 },
  forgotLink: { alignSelf: 'flex-end', marginBottom: spacing.lg },
  forgotLinkText: { color: colors.primary, fontWeight: '600' },
  loginButton: { marginBottom: spacing.lg },
  footer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { ...typography.body, color: colors.textMuted },
  footerLink: { ...typography.body, color: colors.primary, fontWeight: '700' },
});

export default LoginScreen;
