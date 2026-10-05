import React, { useMemo, useRef, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Button } from '../../components/ui';
import { spacing, typography, useThemeColors } from '../../styles/theme';
import { establishmentService } from '../../services/api';
import { TranslationKey, useT } from '../../i18n';
import { getClassActionTexts } from '../../hooks/useClassActionConfirm';

type Status = 'confirm' | 'loading' | 'success' | 'error' | 'cancelled' | 'invalid';

interface Props {
  action: 'approve' | 'reject';
}

const KEYS: Record<Props['action'], { loading: TranslationKey; okTitle: TranslationKey; okMsg: TranslationKey; errTitle: TranslationKey; errMsg: TranslationKey }> = {
  approve: {
    loading: 'auth.classLink.approving',
    okTitle: 'auth.classLink.approvedTitle',
    okMsg: 'auth.classLink.approvedMessage',
    errTitle: 'auth.classLink.approveErrorTitle',
    errMsg: 'auth.classLink.approveFailed',
  },
  reject: {
    loading: 'auth.classLink.rejecting',
    okTitle: 'auth.classLink.rejectedTitle',
    okMsg: 'auth.classLink.rejectedMessage',
    errTitle: 'auth.classLink.rejectErrorTitle',
    errMsg: 'auth.classLink.rejectFailed',
  },
};

/**
 * Shared body of the emailed class approval / rejection deep links (no login
 * required). Nothing is sent when the screen opens: it explains what will
 * happen and only calls the API after an explicit "Confirmer" tap.
 * Same flow as web's pages/ClassLinkDecision.jsx.
 */
const ClassLinkDecision = ({ action }: Props) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const route = useRoute<any>();
  const classeId: string | undefined = route.params?.classeId;
  const etablissementId: string | undefined = route.params?.etablissementId;
  const className: string | undefined = route.params?.nom || route.params?.className;
  // Signed token from the e-mailed link: lets the backend accept the decision without a login.
  const token: string | undefined = route.params?.token;
  const keys = KEYS[action];
  const isApprove = action === 'approve';
  const texts = getClassActionTexts(action, className, t);

  const [status, setStatus] = useState<Status>(classeId && etablissementId ? 'confirm' : 'invalid');
  const [message, setMessage] = useState('');
  const submittingRef = useRef(false);

  const handleConfirm = async () => {
    if (!classeId || !etablissementId || submittingRef.current) return;
    submittingRef.current = true;
    setStatus('loading');
    try {
      if (isApprove) await establishmentService.approveClass(classeId, etablissementId, token);
      else await establishmentService.rejectClass(classeId, etablissementId, token);
      setStatus('success');
      setMessage(t(keys.okMsg));
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error && err.message ? err.message : t(keys.errMsg));
    } finally {
      submittingRef.current = false;
    }
  };

  const accent = isApprove ? colors.success : colors.danger;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        {status === 'invalid' && (
          <View style={styles.center}>
            <FontAwesome5 name="exclamation-circle" size={48} color={colors.danger} />
            <Text style={styles.title}>{t(keys.errTitle)}</Text>
            <Text style={styles.message}>{t('auth.classLink.invalidLink')}</Text>
          </View>
        )}
        {(status === 'confirm' || status === 'loading') && (
          <View style={styles.center}>
            <FontAwesome5 name={isApprove ? 'check-circle' : 'exclamation-triangle'} size={48} color={accent} />
            <Text style={styles.title}>{texts.title}</Text>
            <Text style={styles.message}>{status === 'loading' ? t(keys.loading) : texts.message}</Text>
            <View style={styles.actions}>
              <Button
                label={t('classConfirm.cancel')}
                variant="secondary"
                onPress={() => setStatus('cancelled')}
                disabled={status === 'loading'}
                style={styles.actionBtn}
              />
              <Button
                label={t('classConfirm.confirm')}
                variant={isApprove ? 'primary' : 'danger'}
                onPress={handleConfirm}
                loading={status === 'loading'}
                style={isApprove ? { ...styles.actionBtn, backgroundColor: colors.success } : styles.actionBtn}
              />
            </View>
          </View>
        )}
        {status === 'cancelled' && (
          <View style={styles.center}>
            <FontAwesome5 name="info-circle" size={48} color={colors.textMuted} />
            <Text style={styles.title}>{t('classConfirm.cancelledTitle')}</Text>
            <Text style={styles.message}>{t('classConfirm.cancelledMessage')}</Text>
            <Button label={t('classConfirm.back')} variant="secondary" onPress={() => setStatus('confirm')} style={{ marginTop: spacing.lg }} />
          </View>
        )}
        {status === 'success' && (
          <View style={styles.center}>
            <FontAwesome5 name={isApprove ? 'check-circle' : 'times-circle'} size={48} color={accent} />
            <Text style={styles.title}>{t(keys.okTitle)}</Text>
            <Text style={styles.message}>{message}</Text>
          </View>
        )}
        {status === 'error' && (
          <View style={styles.center}>
            <FontAwesome5 name="exclamation-circle" size={48} color={colors.danger} />
            <Text style={styles.title}>{t(keys.errTitle)}</Text>
            <Text style={styles.message}>{message}</Text>
            <Button label={t('classConfirm.retry')} variant="secondary" onPress={() => setStatus('confirm')} style={{ marginTop: spacing.lg }} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.xl },
  center: { alignItems: 'center' },
  title: { ...typography.h2, color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm, textAlign: 'center' },
  message: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, width: '100%' },
  actionBtn: { flex: 1 },
});

export default ClassLinkDecision;
