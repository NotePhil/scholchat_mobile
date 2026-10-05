import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { useT } from '../../i18n';
import { useUser } from '../../context/UserContext';
import { coursProgrammerService, coursService, liveSessionService } from '../../services/api';
import { SessionMode } from '../../services/api/liveSessionService';
import { stompClient } from '../../services/realtime/stompClient';
import { storageService } from '../../services/storageService';
import { parseServerDate } from '../../utils/dates';
import { LiveSessionInfo } from '../../types';
import CallPermissionGate from './live/CallPermissionGate';
import { buildJitsiHtml, JitsiEvent } from './live/jitsiHtml';
import {
  LiveChapter,
  LiveChatMessage,
  LiveChatPanel,
  LiveContentPanel,
  LiveParticipant,
  LiveParticipantsSheet,
} from './live/LivePanels';
import { LIVE } from './live/liveTheme';

/**
 * Route params:
 * - coursId (required)
 * - isHost: professor (moderator) side
 * - scheduledId: the cours programmé being run (set to TERMINE when the host ends the class)
 * - launchMode: set by "Démarrer" — after the permission step this screen marks the
 *   programmation EN_COURS and starts the session (web: handleLaunchSession)
 * - coursTitle: shown immediately while the course loads
 */
export interface LiveSessionParams {
  coursId: string;
  isHost?: boolean;
  scheduledId?: string;
  launchMode?: SessionMode;
  coursTitle?: string;
}

type Phase = 'checking' | 'permissions' | 'connecting' | 'live' | 'waiting' | 'error' | 'ended';
type Tab = 'video' | 'content' | 'chat';

const LOAD_TIMEOUT_MS = 30_000;

const formatElapsed = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

/** Isolated so the per-second tick never re-renders the WebView tree. */
const LiveTimer = ({ startedAt }: { startedAt?: string }) => {
  const origin = useMemo(() => {
    const parsed = parseServerDate(startedAt)?.getTime();
    const now = Date.now();
    // Server LocalDateTime vs phone clock/zone mismatch → fall back to "since I joined".
    return parsed && parsed <= now + 60_000 && now - parsed < 12 * 3600_000 ? Math.min(parsed, now) : now;
  }, [startedAt]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return <Text style={styles.timer}>{formatElapsed(now - origin)}</Text>;
};

const MODE_ICON: Record<string, string> = { VIDEO: 'video', AUDIO: 'microphone', CONTENT_ONLY: 'book-open' };

/**
 * Live class — mobile counterpart of web's LiveSession.jsx (+ JitsiRoom,
 * ChapterPanel, ChatBar): permission step → start/join → full-screen call with
 * live header (title, EN DIRECT, mode, timer, participants), Vidéo / Contenu /
 * Chat tabs, "Terminer le cours" (host, confirmed) or "Quitter" (participant).
 */
const LiveSessionScreen = () => {
  useKeepAwake();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = (route.params ?? {}) as LiveSessionParams;
  const { coursId, scheduledId } = params;
  const isHost = !!params.isHost;
  const { user } = useUser();
  const userId = user?.userId ?? user?.id ?? '';
  const displayName =
    user?.username || [user?.prenom, user?.nom].filter(Boolean).join(' ') || 'Utilisateur';

  const [phase, setPhase] = useState<Phase>('checking');
  const [mode, setMode] = useState<SessionMode | undefined>(params.launchMode);
  const [pendingLaunch, setPendingLaunch] = useState<SessionMode | undefined>(params.launchMode);
  const [withMedia, setWithMedia] = useState(true);
  const [session, setSession] = useState<LiveSessionInfo | null>(null);
  const [coursTitle, setCoursTitle] = useState(params.coursTitle ?? '');
  const [redacteurId, setRedacteurId] = useState<string | undefined>();
  const [error, setError] = useState('');
  const [busyLabel, setBusyLabel] = useState('');
  const [endedByMe, setEndedByMe] = useState(false);
  const [tab, setTab] = useState<Tab>('video');
  const [participants, setParticipants] = useState<LiveParticipant[]>([]);
  const [chapitres, setChapitres] = useState<LiveChapter[]>([]);
  const [currentChapitreId, setCurrentChapitreId] = useState<string | null>(null);
  const [chapterChanging, setChapterChanging] = useState(false);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [handRaises, setHandRaises] = useState<LiveParticipant[]>([]);
  const [wsConnected, setWsConnected] = useState(stompClient.isConnected());
  const [showParticipants, setShowParticipants] = useState(false);
  const [webKey, setWebKey] = useState(0);
  const [webLoaded, setWebLoaded] = useState(false);
  const [webError, setWebError] = useState(false);

  const webRef = useRef<WebView>(null);
  const sessionRef = useRef<LiveSessionInfo | null>(null);
  const exitAllowedRef = useRef(false);
  const leftRef = useRef(false);
  const hangupHandledRef = useRef(false);
  const tabRef = useRef<Tab>('video');
  tabRef.current = tab;
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;

  // ── course title / author (chapter media resolution) ──
  useEffect(() => {
    if (!coursId) return;
    coursService
      .getById(coursId)
      .then((c) => {
        if (c?.titre) setCoursTitle(c.titre);
        const r = (c as { redacteurId?: string })?.redacteurId;
        if (r) setRedacteurId(r);
      })
      .catch(() => {});
  }, [coursId]);

  // ── initial step ──
  const checkActive = useCallback(async () => {
    if (!coursId) return;
    setPhase('checking');
    setError('');
    try {
      const active = await liveSessionService.findActiveSession(coursId);
      if (!active) {
        setPhase('waiting');
        return;
      }
      setMode(active.mode as SessionMode);
      setPhase('permissions');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('liveCall.joinFailed'));
      setPhase('error');
    }
  }, [coursId, t]);

  useEffect(() => {
    if (!coursId) return;
    if (params.launchMode) setPhase('permissions');
    else checkActive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coursId]);

  /** Marks the matching programmation(s) TERMINE — web's terminerCours after endSession. */
  const terminateProgrammation = useCallback(async () => {
    if (!coursId) return;
    const body = { etatCoursProgramme: 'TERMINE', dateFinEffectif: new Date().toISOString() } as any;
    if (scheduledId) {
      await coursProgrammerService.update(scheduledId, body).catch(() => {});
      return;
    }
    const list = await coursProgrammerService.getByCours(coursId).catch(() => []);
    await Promise.all(
      (list || [])
        .filter((p) => p.etatCoursProgramme === 'EN_COURS' && p.id)
        .map((p) => coursProgrammerService.update(p.id as string, body).catch(() => {}))
    );
  }, [coursId, scheduledId]);

  // ── permission step done → start (host launch) and join ──
  const connect = useCallback(
    async (media: boolean) => {
      if (!coursId) return;
      setWithMedia(media);
      setPhase('connecting');
      setError('');
      try {
        let sessionId: string | undefined;
        if (pendingLaunch) {
          setBusyLabel(t('liveCall.starting'));
          if (scheduledId) {
            await coursProgrammerService.update(scheduledId, {
              etatCoursProgramme: 'EN_COURS',
              dateDebutEffectif: new Date().toISOString(),
              dateFinEffectif: null,
            } as any);
          }
          const started = await liveSessionService.startSession(coursId, pendingLaunch);
          sessionId = started.sessionId;
          setPendingLaunch(undefined);
        } else {
          setBusyLabel(t('liveCall.connecting'));
          const active = await liveSessionService.findActiveSession(coursId);
          if (!active) {
            setPhase('waiting');
            return;
          }
          sessionId = active.sessionId;
        }
        setBusyLabel(t('liveCall.connecting'));
        // Every client (host included) joins to get a Jitsi JWT scoped to itself — same as web.
        const joined = await liveSessionService.joinSession(coursId, sessionId);
        sessionRef.current = joined;
        leftRef.current = false;
        hangupHandledRef.current = false;
        setSession(joined);
        setMode(joined.mode as SessionMode);
        if (joined.coursTitle) setCoursTitle((prev) => prev || joined.coursTitle || '');
        setParticipants(joined.participants ?? []);
        const chaps = (joined.chapitres ?? []).slice().sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
        setChapitres(chaps);
        setCurrentChapitreId(joined.currentChapitreId || chaps[0]?.id || null);
        setWebLoaded(false);
        setWebError(false);
        setPhase('live');
        if (!isHost) {
          liveSessionService
            .getProgress(coursId)
            .then((p) => {
              const arr = Array.isArray(p) ? (p as { chapitreId?: string; completed?: boolean }[]) : [];
              setDoneIds(new Set(arr.filter((x) => x.completed && x.chapitreId).map((x) => x.chapitreId as string)));
            })
            .catch(() => {});
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : pendingLaunch ? t('liveCall.startFailed') : t('liveCall.joinFailed'));
        setPhase('error');
      } finally {
        setBusyLabel('');
      }
    },
    [coursId, pendingLaunch, scheduledId, isHost, t]
  );

  // ── realtime: /topic/cours/{id}/session + /chat (web: useSessionWebSocket) ──
  useEffect(() => {
    if (!coursId || !userId) return;
    let release: (() => void) | null = null;
    let offSession: (() => void) | null = null;
    let offChat: (() => void) | null = null;
    let offConn: (() => void) | null = null;
    let disposed = false;
    storageService
      .getUserToken()
      .catch(() => null)
      .then((token) => {
        if (disposed) return;
        release = stompClient.connect(token, userId);
        setWsConnected(stompClient.isConnected());
        offConn = stompClient.onConnectionEvent((evt) => setWsConnected(evt !== 'disconnected'));
        offSession = stompClient.subscribe(`/topic/cours/${coursId}/session`, (body) => {
          const ev = body as Record<string, any> | null;
          if (!ev || typeof ev !== 'object') return;
          switch (ev.event) {
            case 'SESSION_STARTED':
              // Waiting participant: the professor just started → go to the permission step.
              if (phaseRef.current === 'waiting') {
                setMode(ev.session?.mode);
                setPhase('permissions');
              }
              break;
            case 'SESSION_ENDED':
              if (!sessionRef.current || ev.sessionId === sessionRef.current.sessionId) {
                if (phaseRef.current === 'live' || phaseRef.current === 'connecting') {
                  leftRef.current = true;
                  setPhase('ended');
                }
              }
              break;
            case 'CHAPTER_CHANGED':
              if (ev.chapitreId) setCurrentChapitreId(ev.chapitreId);
              break;
            case 'PARTICIPANT_JOINED':
            case 'PARTICIPANT_LEFT':
              if (Array.isArray(ev.participants)) setParticipants(ev.participants);
              break;
            case 'HAND_RAISED':
              setHandRaises((prev) =>
                prev.some((h) => h.userId === ev.userId) ? prev : [...prev, { userId: ev.userId, userName: ev.userName }]
              );
              setTimeout(() => setHandRaises((prev) => prev.filter((h) => h.userId !== ev.userId)), 30_000);
              break;
            default:
              break;
          }
        });
        offChat = stompClient.subscribe(`/topic/cours/${coursId}/chat`, (body) => {
          const ev = body as LiveChatMessage & { event?: string };
          if (!ev || ev.event !== 'CHAT_MESSAGE') return;
          setMessages((prev) => [...prev, ev]);
          if (tabRef.current !== 'chat' && ev.userId !== userId) setUnread((n) => n + 1);
        });
      });
    return () => {
      disposed = true;
      offSession?.();
      offChat?.();
      offConn?.();
      release?.();
    };
  }, [coursId, userId]);

  // ── fallback polling (web polls every 15 s for participants) ──
  useEffect(() => {
    if (!coursId || (phase !== 'live' && phase !== 'waiting')) return;
    const id = setInterval(async () => {
      try {
        const active = await liveSessionService.findActiveSession(coursId);
        if (phaseRef.current === 'live' && (!active || active.sessionId !== sessionRef.current?.sessionId)) {
          leftRef.current = true;
          setPhase('ended');
        } else if (phaseRef.current === 'waiting' && active) {
          setMode(active.mode as SessionMode);
          setPhase('permissions');
        }
      } catch {
        // network hiccup — keep going
      }
    }, 15_000);
    return () => clearInterval(id);
  }, [coursId, phase]);

  // ── call load timeout ──
  useEffect(() => {
    if (phase !== 'live' || webLoaded || mode === 'CONTENT_ONLY') return;
    const id = setTimeout(() => setWebError(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [phase, webLoaded, webKey, mode]);

  // ── app background: turn the camera off while hidden, back on when visible ──
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (phaseRef.current !== 'live') return;
      const cmd = s === 'active' ? 'foreground' : s === 'background' ? 'background' : null;
      if (cmd) webRef.current?.injectJavaScript(`window.__sc && window.__sc.cmd('${cmd}'); true;`);
    });
    return () => sub.remove();
  }, []);

  // ── leave / end ──
  const leaveSilently = useCallback(() => {
    const sid = sessionRef.current?.sessionId;
    if (!coursId || !sid || leftRef.current) return;
    leftRef.current = true;
    liveSessionService.leaveSession(coursId, sid).catch(() => {});
  }, [coursId]);

  // Best-effort leave when the screen goes away (web: leave on unmount).
  useEffect(() => () => leaveSilently(), [leaveSilently]);

  const exit = useCallback(() => {
    exitAllowedRef.current = true;
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const endCourse = useCallback(async () => {
    const sid = sessionRef.current?.sessionId;
    if (!coursId || !sid) return;
    setBusyLabel(t('liveCall.ending'));
    try {
      webRef.current?.injectJavaScript(`window.__sc && window.__sc.cmd('hangup'); true;`);
      await liveSessionService.endSession(coursId, sid);
      await terminateProgrammation();
      leftRef.current = true;
      setEndedByMe(true);
      setPhase('ended');
    } catch (e) {
      Alert.alert(t('liveCall.endFailed'), e instanceof Error ? e.message : '');
    } finally {
      setBusyLabel('');
    }
  }, [coursId, t, terminateProgrammation]);

  const confirmEnd = useCallback(() => {
    Alert.alert(t('liveCall.confirmEndTitle'), t('liveCall.confirmEndMessage'), [
      { text: t('liveCall.cancel'), style: 'cancel' },
      { text: t('liveCall.endCourse'), style: 'destructive', onPress: endCourse },
    ]);
  }, [t, endCourse]);

  const confirmLeave = useCallback(
    (onLeave: () => void) => {
      const buttons: { text: string; style?: 'cancel' | 'destructive' | 'default'; onPress?: () => void }[] = [
        { text: t('liveCall.cancel'), style: 'cancel' },
        {
          text: t('liveCall.leave'),
          style: isHost ? 'default' : 'destructive',
          onPress: () => {
            leaveSilently();
            onLeave();
          },
        },
      ];
      if (isHost) buttons.push({ text: t('liveCall.endCourse'), style: 'destructive', onPress: endCourse });
      Alert.alert(
        t('liveCall.confirmLeaveTitle'),
        isHost ? t('liveCall.confirmHostLeaveMessage') : t('liveCall.confirmLeaveMessage'),
        buttons
      );
    },
    [t, isHost, leaveSilently, endCourse]
  );

  // Android back / swipe back while in the call → confirm first.
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e: any) => {
      if (exitAllowedRef.current || phaseRef.current !== 'live') return;
      e.preventDefault();
      confirmLeave(() => {
        exitAllowedRef.current = true;
        navigation.dispatch(e.data.action);
      });
    });
    return unsub;
  }, [navigation, confirmLeave]);

  // ── Jitsi bridge ──
  const onWebMessage = useCallback(
    (e: WebViewMessageEvent) => {
      let msg: JitsiEvent | null = null;
      try {
        msg = JSON.parse(e.nativeEvent.data);
      } catch {
        return;
      }
      if (!msg) return;
      if (msg.type === 'loaded') setWebLoaded(true);
      else if (msg.type === 'joined') {
        setWebLoaded(true);
        hangupHandledRef.current = false;
      } else if (msg.type === 'error') setWebError(true);
      else if (msg.type === 'hangup') {
        if (hangupHandledRef.current || phaseRef.current !== 'live') return;
        hangupHandledRef.current = true;
        if (!isHost) {
          // Participant pressed Jitsi's red button → leave (web: onHangup = onClose).
          leaveSilently();
          exit();
          return;
        }
        Alert.alert(t('liveCall.hangupHostTitle'), t('liveCall.hangupHostMessage'), [
          {
            text: t('liveCall.rejoin'),
            onPress: () => {
              setWebLoaded(false);
              setWebKey((k) => k + 1);
            },
          },
          {
            text: t('liveCall.leave'),
            onPress: () => {
              leaveSilently();
              exit();
            },
          },
          { text: t('liveCall.endCourse'), style: 'destructive', onPress: endCourse },
        ]);
      }
    },
    [isHost, leaveSilently, exit, endCourse, t]
  );

  // ── content / chat actions ──
  const selectChapter = async (chapitreId: string) => {
    const sid = sessionRef.current?.sessionId;
    if (!isHost || !coursId || !sid) return;
    setChapterChanging(true);
    try {
      await liveSessionService.changeChapter(coursId, sid, chapitreId);
      setCurrentChapitreId(chapitreId);
    } catch {
      // keep the current chapter
    } finally {
      setChapterChanging(false);
    }
  };

  const markDone = async () => {
    if (!coursId || !currentChapitreId) return;
    const id = currentChapitreId;
    try {
      await liveSessionService.saveProgress(coursId, { chapitreId: id, completed: true });
      setDoneIds((prev) => new Set(prev).add(id));
    } catch {
      // ignore
    }
  };

  const sendChat = (message: string) => {
    if (coursId) stompClient.publish(`/app/cours/${coursId}/chat`, { message });
  };
  const raiseHand = () => {
    if (coursId) stompClient.publish(`/app/cours/${coursId}/hand-raise`, {});
  };

  const html = useMemo(
    () =>
      session && session.roomName && session.jitsiDomain
        ? buildJitsiHtml({ session, isModerator: isHost, displayName, subject: coursTitle || session.coursTitle || '', withMedia })
        : null,
    // Title changes must not reload the call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, isHost, displayName, withMedia]
  );

  // ── render ──
  if (!coursId) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <StateCard icon="exclamation-circle" iconColor={LIVE.danger} title={t('liveCall.unavailableTitle')} message={t('liveCall.invalidSession')}>
          <PrimaryButton label={t('liveCall.back')} onPress={exit} />
        </StateCard>
      </View>
    );
  }

  if (phase === 'permissions') {
    return (
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <StatusBar barStyle="light-content" backgroundColor={LIVE.bg} />
        <CallPermissionGate
          mode={mode}
          isHost={isHost}
          coursTitle={coursTitle}
          onReady={connect}
          onCancel={() => {
            exitAllowedRef.current = true;
            navigation.goBack();
          }}
        />
      </View>
    );
  }

  if (phase !== 'live') {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <StatusBar barStyle="light-content" backgroundColor={LIVE.bg} />
        {phase === 'checking' || phase === 'connecting' ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={LIVE.accent} />
            <Text style={styles.busyText}>{busyLabel || t('liveCall.connecting')}</Text>
            {coursTitle ? <Text style={styles.busyCourse}>{coursTitle}</Text> : null}
          </View>
        ) : phase === 'waiting' ? (
          <StateCard
            icon="video"
            iconColor={LIVE.accent}
            title={isHost ? t('liveCall.waitingHostTitle') : t('liveCall.waitingTitle')}
            message={isHost ? t('liveCall.waitingHostMessage') : t('liveCall.waitingMessage')}
          >
            {isHost ? (
              <PrimaryButton
                label={t('liveCall.startSession')}
                onPress={() => {
                  setPendingLaunch('VIDEO');
                  setMode('VIDEO');
                  setPhase('permissions');
                }}
              />
            ) : (
              <PrimaryButton label={t('liveCall.refresh')} onPress={checkActive} />
            )}
            <SecondaryButton label={t('liveCall.back')} onPress={exit} />
          </StateCard>
        ) : phase === 'ended' ? (
          <StateCard
            icon="check-circle"
            iconColor={LIVE.success}
            title={t('liveCall.endedTitle')}
            message={endedByMe ? t('liveCall.endedByYou') : t('liveCall.endedByHost')}
          >
            <PrimaryButton label={t('liveCall.backToCourses')} onPress={exit} />
          </StateCard>
        ) : (
          <StateCard icon="exclamation-circle" iconColor={LIVE.danger} title={t('liveCall.unavailableTitle')} message={error}>
            <PrimaryButton label={t('liveCall.retry')} onPress={() => (pendingLaunch ? setPhase('permissions') : checkActive())} />
            <SecondaryButton label={t('liveCall.back')} onPress={exit} />
          </StateCard>
        )}
      </View>
    );
  }

  const modeKey = (mode || session?.mode || 'VIDEO') as 'VIDEO' | 'AUDIO' | 'CONTENT_ONLY';
  // SessionResponseDTO doesn't expose the starter; the host knows it's himself.
  const hostId = isHost ? userId : undefined;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={LIVE.surface} />
      {/* Top bar (web: LiveSession top bar) */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={8}>
          <FontAwesome5 name="arrow-left" size={17} color={LIVE.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} numberOfLines={1}>
            {coursTitle || t('liveCall.sessionTitle')}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{t('liveCall.live').toUpperCase()}</Text>
            <Text style={styles.metaSep}>·</Text>
            <FontAwesome5 name={MODE_ICON[modeKey] || 'video'} size={10} color={LIVE.muted} />
            <Text style={styles.metaText}>{t(`liveCall.modes.${modeKey}` as any)}</Text>
            <Text style={styles.metaSep}>·</Text>
            <LiveTimer startedAt={session?.startedAt} />
          </View>
        </View>
        <TouchableOpacity style={styles.peopleChip} onPress={() => setShowParticipants(true)}>
          <FontAwesome5 name="users" size={12} color={LIVE.muted} />
          <Text style={styles.peopleText}>{participants.length}</Text>
        </TouchableOpacity>
        {isHost ? (
          <TouchableOpacity style={styles.endBtn} onPress={confirmEnd} disabled={!!busyLabel}>
            {busyLabel ? <ActivityIndicator size="small" color="#FFFFFF" /> : <FontAwesome5 name="phone-slash" size={12} color="#FFFFFF" />}
            <Text style={styles.endText}>{t('liveCall.end')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.endBtn} onPress={() => confirmLeave(exit)}>
            <FontAwesome5 name="sign-out-alt" size={12} color="#FFFFFF" />
            <Text style={styles.endText}>{t('liveCall.leave')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {!withMedia && modeKey !== 'CONTENT_ONLY' ? (
        <View style={styles.banner}>
          <FontAwesome5 name="video-slash" size={11} color="#FDE68A" />
          <Text style={styles.bannerText}>{t('liveCall.noMediaBanner')}</Text>
        </View>
      ) : null}

      {/* Body: the call stays mounted underneath; Contenu / Chat overlay it. */}
      <View style={styles.body}>
        {modeKey === 'CONTENT_ONLY' || !html ? (
          <View style={[styles.center, { flex: 1, padding: 24 }]}>
            <View style={styles.contentOnlyIcon}>
              <FontAwesome5 name="book-open" size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.stateTitle}>{t('liveCall.contentOnlyTitle')}</Text>
            <Text style={styles.stateMessage}>{t('liveCall.contentOnlyMessage')}</Text>
          </View>
        ) : webError ? (
          <View style={[styles.center, { flex: 1, padding: 24 }]}>
            <StateCard icon="exclamation-triangle" iconColor={LIVE.warning} title={t('liveCall.callErrorTitle')} message={t('liveCall.callErrorMessage')}>
              <PrimaryButton
                label={t('liveCall.retry')}
                onPress={() => {
                  setWebError(false);
                  setWebLoaded(false);
                  setWebKey((k) => k + 1);
                }}
              />
            </StateCard>
          </View>
        ) : (
          <>
            <WebView
              key={webKey}
              ref={webRef}
              source={{ html, baseUrl: `https://${session?.jitsiDomain}/` }}
              style={styles.webview}
              containerStyle={{ backgroundColor: LIVE.bg }}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              thirdPartyCookiesEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              mediaCapturePermissionGrantType="grant"
              allowsFullscreenVideo
              allowsProtectedMedia
              setSupportMultipleWindows={false}
              webviewDebuggingEnabled={__DEV__}
              onMessage={onWebMessage}
              onError={() => setWebError(true)}
            />
            {!webLoaded ? (
              <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: LIVE.bg }]} pointerEvents="none">
                <ActivityIndicator size="large" color={LIVE.accent} />
                <Text style={styles.busyText}>{t('liveCall.loadingCall')}</Text>
              </View>
            ) : null}
          </>
        )}

        {tab !== 'video' ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: LIVE.bg }]}>
            {tab === 'content' ? (
              <LiveContentPanel
                chapitres={chapitres}
                currentChapitreId={currentChapitreId}
                isModerator={isHost}
                changing={chapterChanging}
                doneIds={doneIds}
                redacteurId={redacteurId}
                onSelect={selectChapter}
                onMarkDone={markDone}
              />
            ) : (
              <LiveChatPanel
                messages={messages}
                handRaises={handRaises}
                currentUserId={userId}
                connected={wsConnected}
                onSend={sendChat}
                onRaiseHand={raiseHand}
              />
            )}
          </View>
        ) : null}
      </View>

      {/* Bottom tabs (web mobile layout: Vidéo / Contenu / Chat) */}
      <View style={[styles.tabs, { paddingBottom: Math.max(insets.bottom, 6) }]}>
        {(
          [
            { key: 'video', icon: modeKey === 'AUDIO' ? 'microphone' : 'video', label: t('liveCall.tabs.video') },
            { key: 'content', icon: 'book-open', label: t('liveCall.tabs.content') },
            { key: 'chat', icon: 'comment-dots', label: t('liveCall.tabs.chat') },
          ] as { key: Tab; icon: string; label: string }[]
        ).map((it) => {
          const active = tab === it.key;
          return (
            <TouchableOpacity
              key={it.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => {
                setTab(it.key);
                if (it.key === 'chat') setUnread(0);
              }}
            >
              <View>
                <FontAwesome5 name={it.icon} size={17} color={active ? LIVE.accent : LIVE.muted} />
                {it.key === 'chat' && unread > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.tabText, active && { color: LIVE.accent }]}>{it.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <LiveParticipantsSheet
        visible={showParticipants}
        participants={participants}
        hostId={hostId}
        currentUserId={userId}
        onClose={() => setShowParticipants(false)}
      />
    </View>
  );
};

// ─── small building blocks ──────────────────────────────────────────────────

const StateCard = ({
  icon,
  iconColor,
  title,
  message,
  children,
}: {
  icon: string;
  iconColor: string;
  title: string;
  message?: string;
  children?: React.ReactNode;
}) => (
  <View style={styles.card}>
    <FontAwesome5 name={icon} size={40} color={iconColor} style={{ alignSelf: 'center', marginBottom: 14 }} />
    <Text style={styles.stateTitle}>{title}</Text>
    {message ? <Text style={styles.stateMessage}>{message}</Text> : null}
    <View style={{ marginTop: 20, gap: 8, alignSelf: 'stretch' }}>{children}</View>
  </View>
);

const PrimaryButton = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <TouchableOpacity style={styles.primaryBtn} onPress={onPress} activeOpacity={0.85}>
    <Text style={styles.primaryText}>{label}</Text>
  </TouchableOpacity>
);

const SecondaryButton = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <TouchableOpacity style={styles.secondaryBtn} onPress={onPress}>
    <Text style={styles.secondaryText}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: LIVE.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: LIVE.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LIVE.border,
  },
  iconBtn: { padding: 4 },
  title: { color: LIVE.text, fontSize: 15, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: LIVE.success },
  liveText: { color: LIVE.success, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  metaSep: { color: '#6B7280', fontSize: 11 },
  metaText: { color: LIVE.muted, fontSize: 11 },
  timer: { color: LIVE.text, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  peopleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: LIVE.surface2,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  peopleText: { color: LIVE.text, fontSize: 12, fontWeight: '700' },
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: LIVE.dangerSolid,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
  },
  endText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(251,191,36,0.14)',
  },
  bannerText: { flex: 1, color: '#FDE68A', fontSize: 11, lineHeight: 15 },
  body: { flex: 1, backgroundColor: LIVE.bg },
  webview: { flex: 1, backgroundColor: LIVE.bg },
  tabs: {
    flexDirection: 'row',
    backgroundColor: LIVE.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LIVE.border,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4, paddingTop: 9, borderTopWidth: 2, borderTopColor: 'transparent' },
  tabActive: { borderTopColor: LIVE.accent },
  tabText: { color: LIVE.muted, fontSize: 11, fontWeight: '600' },
  badge: {
    position: 'absolute',
    top: -6,
    right: -12,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: LIVE.dangerSolid,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  busyText: { color: LIVE.muted, fontSize: 14, marginTop: 14 },
  busyCourse: { color: LIVE.text, fontSize: 15, fontWeight: '700', marginTop: 6, textAlign: 'center', paddingHorizontal: 24 },
  card: { width: '86%', maxWidth: 420, backgroundColor: LIVE.surface, borderRadius: 20, padding: 24 },
  stateTitle: { color: LIVE.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  stateMessage: { color: LIVE.muted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  contentOnlyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  primaryBtn: { backgroundColor: LIVE.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondaryBtn: { borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: LIVE.border },
  secondaryText: { color: LIVE.text, fontSize: 14, fontWeight: '600' },
});

export default LiveSessionScreen;
