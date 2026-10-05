import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useT } from '../../../i18n';
import {
  CallMode,
  CallPermissionKind,
  CallPermissionState,
  CallPermissionStatus,
  allGranted,
  getCallPermissions,
  neededCallPermissions,
  requestCallPermissions,
} from './callPermissions';
import { LIVE } from './liveTheme';

interface Props {
  mode: CallMode;
  isHost: boolean;
  coursTitle?: string;
  /** withMedia=false when the user chose to continue without camera/mic. */
  onReady: (withMedia: boolean) => void;
  onCancel: () => void;
}

/**
 * Pre-call permission step: explains why camera + microphone are needed, fires
 * the OS dialogs on demand, and when they were permanently refused offers to
 * open the app's system settings (re-checked automatically on return).
 * Skips itself entirely when everything is already granted.
 */
const CallPermissionGate = ({ mode, isHost, coursTitle, onReady, onCancel }: Props) => {
  const { t } = useT();
  const kinds = neededCallPermissions(mode);
  const [status, setStatus] = useState<CallPermissionStatus | null>(null);
  const [requesting, setRequesting] = useState(false);
  const doneRef = useRef(false);

  const finish = useCallback(
    (withMedia: boolean) => {
      if (doneRef.current) return;
      doneRef.current = true;
      onReady(withMedia);
    },
    [onReady]
  );

  const refresh = useCallback(async () => {
    try {
      const s = await getCallPermissions();
      setStatus(s);
      if (allGranted(s, kinds)) finish(true);
    } catch {
      setStatus({ camera: 'undetermined', microphone: 'undetermined' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finish, kinds.join(',')]);

  useEffect(() => {
    if (kinds.length === 0) {
      finish(true);
      return;
    }
    refresh();
    // Back from the system settings screen → re-check.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const blocked = !!status && kinds.some((k) => status[k] === 'blocked');

  const handleAllow = async () => {
    if (blocked) {
      Linking.openSettings().catch(() => {});
      return;
    }
    setRequesting(true);
    try {
      const s = await requestCallPermissions(kinds);
      setStatus(s);
      if (allGranted(s, kinds)) finish(true);
    } finally {
      setRequesting(false);
    }
  };

  if (kinds.length === 0 || !status) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={LIVE.accent} />
      </View>
    );
  }

  const stateLabel = (s: CallPermissionState) =>
    s === 'granted' ? t('liveCall.permissions.granted') : s === 'undetermined' ? t('liveCall.permissions.toAllow') : t('liveCall.permissions.denied');
  const stateColor = (s: CallPermissionState) => (s === 'granted' ? LIVE.success : s === 'undetermined' ? LIVE.muted : LIVE.danger);

  const rows: { kind: CallPermissionKind; icon: string; title: string; desc: string }[] = [
    { kind: 'camera', icon: 'video', title: t('liveCall.permissions.camera'), desc: t('liveCall.permissions.cameraDesc') },
    { kind: 'microphone', icon: 'microphone', title: t('liveCall.permissions.microphone'), desc: t('liveCall.permissions.microphoneDesc') },
  ];

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <LinearGradient colors={['#4F46E5', '#9333EA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <FontAwesome5 name="video" size={30} color="#FFFFFF" />
        </LinearGradient>
        {coursTitle ? (
          <Text style={styles.course} numberOfLines={2}>
            {coursTitle}
          </Text>
        ) : null}
        <Text style={styles.title}>{t('liveCall.permissions.title')}</Text>
        <Text style={styles.subtitle}>
          {isHost ? t('liveCall.permissions.subtitleHost') : t('liveCall.permissions.subtitleParticipant')}
        </Text>

        <View style={styles.card}>
          {rows
            .filter((r) => kinds.includes(r.kind))
            .map((r, i) => (
              <View key={r.kind} style={[styles.row, i > 0 && styles.rowBorder]}>
                <View style={styles.rowIcon}>
                  <FontAwesome5 name={r.icon} size={16} color={LIVE.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{r.title}</Text>
                  <Text style={styles.rowDesc}>{r.desc}</Text>
                </View>
                <View style={[styles.pill, { borderColor: stateColor(status[r.kind]) }]}>
                  {status[r.kind] === 'granted' ? <FontAwesome5 name="check" size={9} color={LIVE.success} /> : null}
                  <Text style={[styles.pillText, { color: stateColor(status[r.kind]) }]}>{stateLabel(status[r.kind])}</Text>
                </View>
              </View>
            ))}
        </View>

        {blocked ? (
          <View style={styles.hint}>
            <FontAwesome5 name="info-circle" size={13} color="#FCD34D" />
            <Text style={styles.hintText}>{t('liveCall.permissions.blockedHint')}</Text>
          </View>
        ) : null}

        <View style={styles.privacyRow}>
          <FontAwesome5 name="lock" size={11} color={LIVE.muted} />
          <Text style={styles.privacy}>{t('liveCall.permissions.privacy')}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.primary} onPress={handleAllow} disabled={requesting} activeOpacity={0.85}>
          {requesting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <FontAwesome5 name={blocked ? 'cog' : 'unlock-alt'} size={14} color="#FFFFFF" />
              <Text style={styles.primaryText}>{blocked ? t('liveCall.permissions.openSettings') : t('liveCall.permissions.allow')}</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={() => finish(false)} disabled={requesting}>
          <Text style={styles.secondaryText}>{t('liveCall.permissions.continueWithout')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.link} onPress={onCancel} disabled={requesting}>
          <Text style={styles.linkText}>{t('liveCall.cancel')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: LIVE.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 24, paddingTop: 40, alignItems: 'center' },
  hero: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  course: { color: LIVE.accent, fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  title: { color: LIVE.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: LIVE.muted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  card: { alignSelf: 'stretch', backgroundColor: LIVE.surface, borderRadius: 16, marginTop: 24, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LIVE.border },
  rowIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(129,140,248,0.15)', alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: LIVE.text, fontSize: 15, fontWeight: '700' },
  rowDesc: { color: LIVE.muted, fontSize: 12, marginTop: 2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 11, fontWeight: '700' },
  hint: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(252,211,77,0.12)',
  },
  hintText: { flex: 1, color: '#FDE68A', fontSize: 12, lineHeight: 17 },
  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
  privacy: { color: LIVE.muted, fontSize: 11 },
  footer: { padding: 20, paddingBottom: 28, gap: 6 },
  primary: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LIVE.primary,
    borderRadius: 14,
    paddingVertical: 15,
  },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondary: { alignItems: 'center', paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: LIVE.border },
  secondaryText: { color: LIVE.text, fontSize: 14, fontWeight: '600' },
  link: { alignItems: 'center', paddingVertical: 10 },
  linkText: { color: LIVE.muted, fontSize: 14 },
});

export default CallPermissionGate;
