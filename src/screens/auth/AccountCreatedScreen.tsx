import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { BrandColors, ff, useBrandColors } from '../../components/brand';
import { userService } from '../../services/api';
import { resetToLogin } from '../../navigation/authRoutes';
import { AuthScreen, AuthTitle, Banner, GradientButton, Illustration, TextLink } from './components/AuthKit';
import { translate, useT } from '../../i18n';

/**
 * End of a flow:
 * - `activation`: élève / parent account created (or role added to a never-activated account) —
 *   an activation link was e-mailed; its page lets the user choose the password.
 * - `pending`: professor request received — pending admin validation, then an e-mail with the
 *   link to set the password.
 * - `roleAdded` / `rolePending`: role added to (or professor role requested on) an existing
 *   account — the user signs in with that account's existing password.
 * - `classPending`: adult élève signed up with a class code — "Compte créé – en attente
 *   d'approbation": an acknowledgement e-mail is sent now; once the class teacher approves, the
 *   user receives by e-mail their login (e-mail) and a temporary password (changed at first login).
 * - `parentCreated`: parent signed up with their children — "Inscription enregistrée": the login +
 *   temporary password are e-mailed right away; each child's request (state in « Mes enfants »)
 *   waits for its class teacher.
 * Same outcomes and messages as web SignUp.jsx / VerifyEmail.jsx.
 */
export type AccountCreatedVariant = 'activation' | 'pending' | 'roleAdded' | 'rolePending' | 'classPending' | 'parentCreated';

export interface AccountCreatedParams {
  variant: AccountCreatedVariant;
  /** Address the activation link was sent to (variant `activation`). */
  email?: string;
  /** true when a role was added to an existing never-activated account (ACTIVATION_REQUIRED). */
  roleAdded?: boolean;
  /** Class requested with the code (variant `classPending`), when the backend returns its name. */
  classeNom?: string;
  /** Children enrolled by a parent sign-up (variant `parentCreated`). */
  enfants?: { prenom: string; nom: string; classeNom?: string }[];
}

const RESEND_COOLDOWN = 60;

const AccountCreatedScreen = () => {
  const c = useBrandColors();
  const s = useMemo(() => createStyles(c), [c]);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { width } = useWindowDimensions();
  const { t } = useT();
  const params = (route.params ?? { variant: 'activation' }) as AccountCreatedParams;
  const variant = params.variant;
  const email = params.email?.trim() ?? '';

  const [cooldown, setCooldown] = useState(variant === 'activation' ? RESEND_COOLDOWN : 0);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((v) => Math.max(v - 1, 0)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  let title: string;
  let message: string;
  switch (variant) {
    case 'activation':
      title = params.roleAdded ? t('auth.signup.roleAdded.title') : t('auth.accountCreated.title');
      message = params.roleAdded
        ? t('auth.accountCreated.roleAddedActivationMessage')
        : t('auth.accountCreated.activationMessage');
      break;
    case 'pending':
      title = t('auth.accountCreated.pendingTitle');
      message = t('auth.accountCreated.pendingMessage');
      break;
    case 'classPending':
      title = t('auth.accountCreated.classPendingTitle');
      message = params.classeNom?.trim()
        ? t('auth.accountCreated.classPendingMessage', { classe: params.classeNom.trim() })
        : t('auth.accountCreated.classPendingMessageNoClass');
      break;
    case 'parentCreated':
      title = t('auth.accountCreated.parentTitle');
      message = t('auth.accountCreated.parentMessage');
      break;
    case 'roleAdded':
      title = t('auth.signup.roleAdded.title');
      message = t('auth.signup.roleAdded.message');
      break;
    case 'rolePending':
    default:
      title = t('auth.signup.rolePending.title');
      message = t('auth.signup.rolePending.message');
      break;
  }

  const resend = async () => {
    if (!email || cooldown > 0 || sending) return;
    setSending(true);
    setFeedback(null);
    try {
      await userService.resendActivationEmail(email);
      setFeedback({ type: 'success', text: translate('auth.verifyEmail.resent') });
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : translate('auth.verifyEmail.resendFailed') });
    } finally {
      setSending(false);
    }
  };

  /** Opens the mail app: its inbox on iOS (message:), the e-mail app chooser elsewhere (mailto:). */
  const openMailApp = async () => {
    try {
      if (Platform.OS === 'ios') {
        try {
          await Linking.openURL('message:');
          return;
        } catch {
          // fall through to mailto:
        }
      }
      await Linking.openURL('mailto:');
    } catch {
      setFeedback({ type: 'error', text: translate('auth.accountCreated.noMailApp') });
    }
  };

  const goToLogin = () => resetToLogin(navigation);

  return (
    <AuthScreen center>
      <Illustration name="accountCreated" width={Math.min(width * 0.62, 280)} style={s.illustration} />
      <AuthTitle title={title} subtitle={message} />

      {variant === 'parentCreated' && params.enfants?.length ? (
        <View style={s.steps}>
          {params.enfants.map((e, i) => (
            <View key={`${e.prenom}-${e.nom}-${i}`} style={s.stepRow}>
              <FontAwesome5 name="child" size={14} color={c.primary} style={s.childIcon} />
              <View style={s.flex}>
                <Text style={s.childName}>{`${e.prenom} ${e.nom}`.trim()}</Text>
                <Text style={s.childSub}>
                  {e.classeNom
                    ? t('auth.accountCreated.parentChildPendingNamed', { classe: e.classeNom })
                    : t('auth.accountCreated.parentChildPending')}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {variant === 'parentCreated' ? (
        <View style={s.steps}>
          {(['email', 'firstLogin', 'children'] as const).map((k, i) => (
            <View key={k} style={s.stepRow}>
              <View style={s.stepNum}>
                <Text style={s.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={s.stepText}>{t(`auth.accountCreated.parentSteps.${k}`)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {variant === 'classPending' ? (
        <View style={s.steps}>
          {(['ack', 'approval', 'email', 'firstLogin'] as const).map((k, i) => (
            <View key={k} style={s.stepRow}>
              <View style={s.stepNum}>
                <Text style={s.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={s.stepText}>{t(`auth.accountCreated.classPendingSteps.${k}`)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {(variant === 'activation' || variant === 'classPending' || variant === 'parentCreated') && email ? (
        <View style={s.emailChip}>
          <FontAwesome5 name="envelope" size={13} color={c.primary} />
          <Text style={s.emailText} numberOfLines={1}>
            {email}
          </Text>
        </View>
      ) : null}
      {variant === 'activation' || variant === 'parentCreated' || variant === 'classPending' ? (
        <Text style={s.hint}>{t('auth.accountCreated.checkSpam')}</Text>
      ) : null}

      {feedback ? <Banner type={feedback.type} message={feedback.text} /> : null}

      {variant === 'activation' ? (
        <>
          <GradientButton label={t('auth.accountCreated.openMail')} icon="envelope-open-text" onPress={openMailApp} />
          <GradientButton
            label={
              cooldown > 0
                ? t('auth.accountCreated.resendIn', { seconds: cooldown })
                : t('auth.verifyEmail.resend')
            }
            variant="outline"
            onPress={resend}
            loading={sending}
            disabled={cooldown > 0 || !email}
            style={s.secondary}
          />
          <View style={s.links}>
            <TextLink label={t('auth.common.backToLogin')} onPress={goToLogin} />
          </View>
        </>
      ) : (
        <GradientButton label={t('auth.common.backToLogin')} onPress={goToLogin} />
      )}
    </AuthScreen>
  );
};

const createStyles = (c: BrandColors) =>
  StyleSheet.create({
    illustration: { marginBottom: 24 },
    emailChip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      gap: 8,
      maxWidth: '100%',
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: c.primarySoft,
      marginBottom: 10,
    },
    emailText: { ...ff('semibold'), fontSize: 14, color: c.text, flexShrink: 1 },
    hint: { ...ff('regular'), fontSize: 12, lineHeight: 17, color: c.textSecondary, textAlign: 'center', marginBottom: 18 },
    secondary: { marginTop: 12 },
    steps: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
      padding: 14,
      gap: 12,
      marginBottom: 16,
    },
    stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    stepNum: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepNumText: { ...ff('semibold'), fontSize: 12, color: c.primary },
    stepText: { ...ff('regular'), fontSize: 13, lineHeight: 19, color: c.text, flex: 1 },
    flex: { flex: 1 },
    childIcon: { width: 22, textAlign: 'center', marginTop: 2 },
    childName: { ...ff('semibold'), fontSize: 14, color: c.text },
    childSub: { ...ff('regular'), fontSize: 12, lineHeight: 17, color: c.textSecondary, marginTop: 1 },
    links: { alignItems: 'center', marginTop: 22 },
  });

export default AccountCreatedScreen;
