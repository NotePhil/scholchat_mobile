import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,

  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { userService } from '../../services/api';

/**
 * Enterprise-grade VerifyEmail screen informing the newly registered user
 * to activate their account via the email link, matching Scholchat Web design.
 */
const VerifyEmailScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const email: string | undefined = route.params?.email;
  const userType: string | undefined = route.params?.userType;

  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [isError, setIsError] = useState(false);

  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);

  const handleResend = async () => {
    if (!email || userType === 'Professeur') return;
    setSending(true);
    setFeedback('');
    setIsError(false);
    try {
      await userService.resendActivationEmail(email);
      setFeedback("L'e-mail d'activation a été renvoyé avec succès.");
    } catch (err) {
      setIsError(true);
      setFeedback(err instanceof Error ? err.message : "Échec de l'envoi de l'e-mail.");
    } finally {
      setSending(false);
    }
  };

  const handleGoToLogin = () => {
    try {
      navigation.reset({
        index: 0,
        routes: [{ name: 'App' }],
      });
      return;
    } catch {
      // Fallback if reset is not supported
    }

    try {
      navigation.navigate('App', { screen: 'Login' });
      return;
    } catch {
      // Fallback
    }

    try {
      navigation.navigate('Login');
      return;
    } catch {
      navigation.goBack();
    }
  };

  return (
    <View style={[styles.safeArea, { paddingTop: topPadding }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.iconBadge}>
            <FontAwesome5 name="envelope-open-text" size={36} color="#2563EB" />
          </View>

          <Text style={styles.title}>Vérifiez votre e-mail</Text>

          <Text style={styles.subtitle}>
            Nous venons d'envoyer un lien d'activation à :
          </Text>

          <View style={styles.emailChip}>
            <Text style={styles.emailText}>{email || 'votre adresse e-mail'}</Text>
          </View>

          <Text style={styles.instructions}>
            {userType === 'Professeur'
              ? "Votre demande d'inscription professeur a bien été enregistrée. Elle est en attente de vérification par l'administration. Vous recevrez une notification par e-mail une fois validée."
              : "Cliquez sur le lien reçu dans l'e-mail pour activer votre compte et définir votre mot de passe d'accès. Pensez également à vérifier vos spams."}
          </Text>

          {feedback ? (
            <View style={[styles.feedbackBox, isError ? styles.feedbackBoxError : styles.feedbackBoxSuccess]}>
              <FontAwesome5
                name={isError ? 'exclamation-circle' : 'check-circle'}
                size={14}
                color={isError ? '#DC2626' : '#10B981'}
              />
              <Text style={[styles.feedbackText, isError ? styles.feedbackTextError : styles.feedbackTextSuccess]}>
                {feedback}
              </Text>
            </View>
          ) : null}

          {userType !== 'Professeur' && (
            <TouchableOpacity
              style={[styles.resendButton, sending && styles.buttonDisabled]}
              onPress={handleResend}
              disabled={sending}
              activeOpacity={0.85}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#2563EB" />
              ) : (
                <View style={styles.resendRow}>
                  <FontAwesome5 name="redo-alt" size={13} color="#2563EB" />
                  <Text style={styles.resendButtonText}>Renvoyer l'e-mail d'activation</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleGoToLogin}
            activeOpacity={0.85}
          >
            <Text style={styles.loginButtonText}>Aller à la connexion</Text>
            <FontAwesome5 name="arrow-right" size={13} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <Text style={styles.helpText}>
          Besoin d'aide ? Contactez le support de votre établissement.
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  iconBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 10,
  },
  emailChip: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emailText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  instructions: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  feedbackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    width: '100%',
    marginBottom: 16,
  },
  feedbackBoxSuccess: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  feedbackBoxError: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  feedbackText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  feedbackTextSuccess: {
    color: '#065F46',
  },
  feedbackTextError: {
    color: '#991B1B',
  },
  resendButton: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resendButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  loginButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  loginButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  helpText: {
    marginTop: 20,
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
});

export default VerifyEmailScreen;
