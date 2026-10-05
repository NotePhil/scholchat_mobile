import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/ui';
import LanguageSwitch from '../../components/common/LanguageSwitch';
import ProfessorDocumentsForm from '../../components/common/ProfessorDocumentsForm';
import { userService } from '../../services/api';
import { extractErrorMessage } from '../../services/api/client';
import { authService } from '../../services/home/authService';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotificationsStore } from '../../store/useNotificationsStore';
import { useThemeStore } from '../../store/useThemeStore';
import { useNotificationsRealtime } from '../../hooks/useNotificationsRealtime';
import { ProfessorDocKey } from '../../hooks/useProfessorDocumentsUpload';
import { radius, spacing, typography, useThemeColors } from '../../styles/theme';
import { confirmLogout } from '../../utils/confirmLogout';
import { ProfessorVerificationStatus } from '../../types';
import { translate, useT } from '../../i18n';
import RoleSwitchSheet from '../shared/RoleSwitchSheet';

interface ProfessorVerificationStatusScreenProps {
  onLogout: () => void;
}

const KNOWN_STATUSES: ProfessorVerificationStatus[] = ['DOCUMENTS_MANQUANTS', 'EN_ATTENTE_VALIDATION', 'VALIDE', 'REJETE'];

/** Notifications that mean "your professor verification status changed": re-check on arrival. */
const VERIFICATION_NOTIFICATION_TYPES = new Set([
  'PROFESSOR_VERIFICATION_VALIDATED',
  'PROFESSOR_VERIFICATION_REJECTED',
  'PROFESSOR_VERIFICATION_DOCUMENTS_REQUIRED',
  'ROLE_VALIDATED',
  'ROLE_REJECTED',
]);

const asStatus = (raw: unknown): ProfessorVerificationStatus | undefined =>
  typeof raw === 'string' && (KNOWN_STATUSES as string[]).includes(raw.toUpperCase())
    ? (raw.toUpperCase() as ProfessorVerificationStatus)
    : undefined;

/**
 * Shown by DashboardShell INSTEAD of the professor dashboard while the professor profile is not
 * validated by an administrator (the server refuses every professor action meanwhile): pending
 * review, documents missing (upload form) or rejected (reason + re-upload). The status is
 * re-read from GET /utilisateurs/{id} on demand, on focus, when the app comes back to the
 * foreground and when a verification notification arrives. Once VALIDE, the session is silently
 * re-issued for PROFESSOR (switch-role) and the shell renders the dashboard.
 */
const ProfessorVerificationStatusScreen = ({ onLogout }: ProfessorVerificationStatusScreenProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const themeMode = useThemeStore((s) => s.mode);
  const toggleThemeMode = useThemeStore((s) => s.toggleMode);

  const user = useAuthStore((s) => s.user);
  const tokenRoles = useAuthStore((s) => s.roles);
  const login = useAuthStore((s) => s.login);
  const updateUser = useAuthStore((s) => s.updateUser);
  const userId = (user?.userId as string | undefined) ?? (user?.id as string | undefined);
  const status = asStatus(user?.professeurStatutVerification);
  const motif = (user?.professeurMotifRejet as string | null | undefined) ?? null;

  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState('');
  const [promoting, setPromoting] = useState(false);
  const [showRoleSheet, setShowRoleSheet] = useState(false);
  const inFlight = useRef(false);

  // The dashboard header (which normally keeps notifications live) is not mounted here.
  useNotificationsRealtime(userId);

  const availableRoles: string[] = (user?.availableRoles as string[] | undefined)?.length
    ? (user?.availableRoles as string[])
    : tokenRoles;
  const canSwitchRole = availableRoles.length > 1;

  const refresh = useCallback(async () => {
    if (!userId || inFlight.current) return;
    inFlight.current = true;
    setChecking(true);
    setCheckError('');
    try {
      const data = await userService.getUserById(userId);
      setProfile(data);
      let next = asStatus(data?.statutVerification);
      if (!next) {
        // Not reported (should not happen for a professor): infer from the documents on file.
        const complete = !!(data?.cniUrlRecto && data?.cniUrlVerso && data?.selfieUrl);
        next = complete ? 'EN_ATTENTE_VALIDATION' : 'DOCUMENTS_MANQUANTS';
      }
      if (next === 'VALIDE') {
        setPromoting(true);
        try {
          // New JWT with ROLE_PROFESSOR (instead of ROLE_PROFESSOR_PENDING), persisted by authService.
          const session = await authService.refreshSession('PROFESSOR');
          login({ ...session, professeurStatutVerification: asStatus(session.professeurStatutVerification) ?? 'VALIDE' });
        } catch {
          // The server re-derives the rights from the database on every request, so the
          // current token keeps working: just unlock the dashboard.
          updateUser({ professeurStatutVerification: 'VALIDE', professeurMotifRejet: null });
        } finally {
          setPromoting(false);
        }
      } else {
        const nextMotif = typeof data?.motifRejetVerification === 'string' ? data.motifRejetVerification : null;
        updateUser({ professeurStatutVerification: next, professeurMotifRejet: next === 'REJETE' ? nextMotif : null });
      }
    } catch (err) {
      setCheckError(extractErrorMessage(err, translate('profVerification.checkFailed')));
    } finally {
      inFlight.current = false;
      setChecking(false);
    }
  }, [userId, login, updateUser]);

  // On mount + every time the dashboard stack screen regains focus (e.g. back from Notifications).
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Back to the foreground (the admin may have reviewed the file meanwhile).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // A verification notification arrived (real-time push or catch-up fetch).
  useEffect(() => {
    const seen = new Set(useNotificationsStore.getState().items.map((n) => n.id));
    return useNotificationsStore.subscribe((state) => {
      let relevant = false;
      for (const n of state.items) {
        if (seen.has(n.id)) continue;
        seen.add(n.id);
        if (VERIFICATION_NOTIFICATION_TYPES.has((n.type ?? '').toUpperCase())) relevant = true;
      }
      if (relevant) refresh();
    });
  }, [refresh]);

  const provided: Partial<Record<ProfessorDocKey, boolean>> = {
    cniRecto: !!profile?.cniUrlRecto,
    cniVerso: !!profile?.cniUrlVerso,
    selfie: !!profile?.selfieUrl,
  };

  const handleDocumentsSent = () => {
    Alert.alert(translate('profVerification.docs.sentTitle'), translate('profVerification.docs.sentMessage'));
    refresh();
  };

  const name = (user?.username as string | undefined) || `${user?.prenom ?? ''} ${user?.nom ?? ''}`.trim();
  const initial = (name || 'S').charAt(0).toUpperCase();

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 2 }]}>
      <View style={styles.langRow}>
        <LanguageSwitch />
      </View>
      <View style={styles.mainRow}>
        <View style={styles.left}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.titleWrap}>
            <Text style={styles.appName}>ScholChat</Text>
            <Text style={styles.roleLabel} numberOfLines={1}>{t('roles.professor')}</Text>
          </View>
        </View>
        <View style={styles.right}>
          {canSwitchRole ? (
            <TouchableOpacity
              style={[styles.roleSwitchBtn, { borderColor: colors.primary }]}
              onPress={() => setShowRoleSheet(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('roles.switchTitle')}
            >
              <FontAwesome5 name="sync-alt" size={11} color={colors.primary} />
              <Text style={[styles.roleSwitchText, { color: colors.primary }]}>{t('header.profile')}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={toggleThemeMode}
            accessibilityRole="button"
            accessibilityLabel={themeMode === 'dark' ? t('header.lightMode') : t('header.darkMode')}
          >
            <FontAwesome5 name={themeMode === 'dark' ? 'sun' : 'moon'} size={14} color={themeMode === 'dark' ? colors.warning : colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => confirmLogout(onLogout)}
            accessibilityRole="button"
            accessibilityLabel={t('logout.title')}
          >
            <FontAwesome5 name="sign-out-alt" size={18} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderBody = () => {
    if (promoting || status === 'VALIDE') {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.success} />
          <Text style={styles.centeredText}>{t('profVerification.validated')}</Text>
        </View>
      );
    }
    if (!status) {
      // Legacy session without the status: wait for GET /utilisateurs/{id} (never flash the dashboard).
      return (
        <View style={styles.centered}>
          {checkError && !checking ? (
            <>
              <FontAwesome5 name="exclamation-triangle" size={28} color={colors.warning} />
              <Text style={styles.centeredText}>{checkError}</Text>
              <Button label={t('profVerification.checkAgain')} icon="sync-alt" onPress={refresh} style={{ marginTop: spacing.md }} />
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.centeredText}>{t('profVerification.checking')}</Text>
            </>
          )}
        </View>
      );
    }

    const meta = {
      EN_ATTENTE_VALIDATION: { icon: 'hourglass-half', color: colors.warning, title: t('profVerification.pending.title'), message: t('profVerification.pending.message') },
      DOCUMENTS_MANQUANTS: { icon: 'file-upload', color: colors.primary, title: t('profVerification.missing.title'), message: t('profVerification.missing.message') },
      REJETE: { icon: 'times-circle', color: colors.danger, title: t('profVerification.rejected.title'), message: t('profVerification.rejected.message') },
    }[status];
    const showUpload = status === 'DOCUMENTS_MANQUANTS' || status === 'REJETE';

    return (
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={[styles.statusIcon, { backgroundColor: `${meta.color}22` }]}>
            <FontAwesome5 name={meta.icon} size={26} color={meta.color} />
          </View>
          <View style={[styles.statusPill, { backgroundColor: `${meta.color}22` }]}>
            <Text style={[styles.statusPillText, { color: meta.color }]}>{t(`profVerification.statuses.${status}`)}</Text>
          </View>
          <Text style={styles.title}>{meta.title}</Text>
          <Text style={styles.message}>{meta.message}</Text>

          {status === 'REJETE' ? (
            <View style={[styles.reasonBox, { borderColor: colors.danger }]}>
              <Text style={[styles.reasonLabel, { color: colors.danger }]}>{t('profVerification.rejected.reason')}</Text>
              <Text style={styles.reasonText}>{motif?.trim() ? motif : t('profVerification.rejected.noReason')}</Text>
            </View>
          ) : null}

          {status === 'EN_ATTENTE_VALIDATION' ? (
            <View style={styles.hintRow}>
              <FontAwesome5 name="bell" size={12} color={colors.textMuted} />
              <Text style={styles.hintText}>{t('profVerification.notifiedHint')}</Text>
            </View>
          ) : null}
        </View>

        {showUpload && userId ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('profVerification.docs.title')}</Text>
            <ProfessorDocumentsForm key={status} userId={userId} provided={provided} onSubmitted={handleDocumentsSent} />
          </View>
        ) : null}

        {checkError ? (
          <View style={styles.errorRow}>
            <FontAwesome5 name="exclamation-circle" size={12} color={colors.danger} />
            <Text style={styles.errorText}>{checkError}</Text>
          </View>
        ) : null}

        <Button
          label={t('profVerification.checkAgain')}
          icon="sync-alt"
          variant="secondary"
          onPress={refresh}
          loading={checking}
          fullWidth
        />
        {canSwitchRole ? (
          <Button
            label={t('profVerification.switchProfile')}
            icon="exchange-alt"
            variant="ghost"
            onPress={() => setShowRoleSheet(true)}
            fullWidth
            style={{ marginTop: spacing.sm }}
          />
        ) : null}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {renderHeader()}
      {renderBody()}
      <RoleSwitchSheet visible={showRoleSheet} onClose={() => setShowRoleSheet(false)} onSwitched={(session) => login(session)} />
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    header: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm + 2,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    langRow: { alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
    mainRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    left: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: spacing.xs },
    avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
    avatarText: { color: colors.white, fontSize: 15, fontWeight: '700' },
    titleWrap: { flexShrink: 1 },
    appName: { ...typography.h3, fontSize: 16, color: colors.text },
    roleLabel: { ...typography.caption, color: colors.textMuted, fontSize: 11, marginTop: 1 },
    right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    roleSwitchBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 7,
      paddingVertical: 4,
      borderRadius: radius.sm,
      borderWidth: 1,
      backgroundColor: colors.background,
    },
    roleSwitchText: { fontSize: 11, fontWeight: '700' },
    iconButton: { padding: 6 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
    centeredText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
    scrollContent: { padding: spacing.lg, gap: spacing.md },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
    },
    statusIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
    statusPill: { alignSelf: 'center', marginTop: spacing.sm, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full },
    statusPillText: { ...typography.captionBold },
    title: { ...typography.h2, color: colors.text, textAlign: 'center', marginTop: spacing.sm },
    message: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
    reasonBox: { marginTop: spacing.md, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surfaceElevated },
    reasonLabel: { ...typography.captionBold, marginBottom: 2 },
    reasonText: { ...typography.body, color: colors.text },
    hintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.md },
    hintText: { ...typography.caption, color: colors.textMuted, flexShrink: 1, textAlign: 'center' },
    sectionTitle: { ...typography.h4, color: colors.text, marginBottom: spacing.md },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    errorText: { ...typography.caption, color: colors.danger, flex: 1 },
  });

export default ProfessorVerificationStatusScreen;
