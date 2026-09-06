import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,

  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors } from '../../styles/theme';
import { authService } from '../../services/home/authService';
import { useUser } from '../../context/UserContext';
import RoleSelectorSheet from '../shared/RoleSelectorSheet';
import { LoginResponse } from '../../types';

const logo = require('../../../assets/logo.png');

/**
 * Enterprise-grade, clean & professional Login screen matching the Scholchat Web experience.
 * Fully stabilized layout for mobile keyboards (no layout jump, no disappearing inputs,
 * no loss of focus when typing password or email on Android/iOS).
 */
const LoginScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { login } = useUser();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingAuth, setPendingAuth] = useState<LoginResponse | null>(null);
  const [showRolePicker, setShowRolePicker] = useState(false);

  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setError('Veuillez renseigner votre email et mot de passe.');
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
      setError(err instanceof Error ? err.message : 'Identifiants invalides. Veuillez réessayer.');
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
      login({ ...pendingAuth, role: selectedRole });
    } finally {
      setLoading(false);
      setShowRolePicker(false);
      setPendingAuth(null);
    }
  };

  return (
    <View style={[styles.safeArea, { paddingTop: topPadding }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Header Brand */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Image source={logo} style={styles.logo} resizeMode="contain" />
            </View>
            <Text style={styles.brandTitle}>Connexion</Text>
            <View style={styles.headerSubWrap}>
              <Text style={styles.headerSub}>Bienvenue sur SchoolChat · </Text>
              <TouchableOpacity onPress={() => navigation.navigate('SignUp')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.headerLink}>Créer un compte</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {error ? (
              <View style={styles.alertBox}>
                <FontAwesome5 name="exclamation-circle" size={14} color="#DC2626" />
                <Text style={styles.alertText}>{error}</Text>
              </View>
            ) : null}

            {/* Email Field */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Adresse email <Text style={styles.required}>*</Text>
              </Text>
              <View style={[styles.inputContainer, emailFocused && styles.inputContainerFocused]}>
                <FontAwesome5
                  name="envelope"
                  size={15}
                  color={emailFocused ? colors.primary : '#9CA3AF'}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="votre.email@exemple.com"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={(val) => {
                    setEmail(val);
                    if (error) setError('');
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  autoComplete="email"
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.formGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>
                  Mot de passe <Text style={styles.required}>*</Text>
                </Text>
                <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.forgotPasswordText}>Mot de passe oublié ?</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.inputContainer, passwordFocused && styles.inputContainerFocused]}>
                <FontAwesome5
                  name="lock"
                  size={15}
                  color={passwordFocused ? colors.primary : '#9CA3AF'}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Votre mot de passe"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
                    if (error) setError('');
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  autoComplete="password"
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((prev) => !prev)}
                  style={styles.eyeBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <FontAwesome5
                    name={showPassword ? 'eye-slash' : 'eye'}
                    size={14}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={handleSignIn}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <View style={styles.btnLoadingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>Connexion en cours...</Text>
                </View>
              ) : (
                <View style={styles.btnRow}>
                  <Text style={styles.primaryButtonText}>Se connecter</Text>
                  <FontAwesome5 name="arrow-right" size={14} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>

            {/* Bottom Register Prompt inside Card */}
            <View style={styles.bottomRegisterRow}>
              <Text style={styles.bottomRegisterText}>Vous n'avez pas encore de compte ? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('SignUp')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.bottomRegisterLink}>Créer un compte</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer note */}
          <View style={styles.footer}>
            <Text style={styles.footerHelp}>
              Besoin d'aide ? Contactez l'administration de votre établissement.
            </Text>
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
        title="Sélectionner un profil"
        subtitle="Ce compte dispose de plusieurs profils d'accès."
      />
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 24 : 16,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: Platform.OS === 'android' ? 8 : 4,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  logo: {
    width: 40,
    height: 40,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerSubWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  headerSub: {
    fontSize: 13,
    color: '#64748B',
  },
  headerLink: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  alertText: {
    flex: 1,
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 18,
    fontWeight: '500',
  },
  formGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 6,
  },
  required: {
    color: '#DC2626',
  },
  forgotPasswordText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  inputContainerFocused: {
    borderColor: '#2563EB',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: 6,
  },
  primaryButton: {
    height: 48,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryButtonDisabled: {
    backgroundColor: '#93C5FD',
    shadowOpacity: 0,
    elevation: 0,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bottomRegisterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  bottomRegisterText: {
    fontSize: 13,
    color: '#64748B',
  },
  bottomRegisterLink: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '700',
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  footerHelp: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default LoginScreen;
