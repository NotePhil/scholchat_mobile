import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useT } from '../../../i18n';
import CourseRichContent, { resolveChapterHtml } from '../CourseRichContent';
import { LIVE } from './liveTheme';

export interface LiveChapter {
  id: string;
  titre?: string;
  ordre?: number;
  contenu?: string;
}

export interface LiveParticipant {
  userId: string;
  userName?: string;
}

export interface LiveChatMessage {
  userId?: string;
  userName?: string;
  message?: string;
  timestamp?: number;
}

// ─── Content (web: ChapterPanel) ────────────────────────────────────────────

interface ContentProps {
  chapitres: LiveChapter[];
  currentChapitreId: string | null;
  isModerator: boolean;
  changing: boolean;
  doneIds: Set<string>;
  redacteurId?: string;
  onSelect: (chapitreId: string) => void;
  onMarkDone: () => void;
}

export const LiveContentPanel = ({
  chapitres,
  currentChapitreId,
  isModerator,
  changing,
  doneIds,
  redacteurId,
  onSelect,
  onMarkDone,
}: ContentProps) => {
  const { t } = useT();
  const cacheRef = useRef(new Map<string, string>());
  const [html, setHtml] = useState<Record<string, string>>({});
  const idx = chapitres.findIndex((c) => c.id === currentChapitreId);
  const current = idx >= 0 ? chapitres[idx] : null;

  useEffect(() => {
    if (!current?.contenu || html[current.id] !== undefined) return;
    let cancelled = false;
    resolveChapterHtml(current.contenu, redacteurId, cacheRef.current)
      .catch(() => current.contenu || '')
      .then((out) => {
        if (!cancelled) setHtml((prev) => ({ ...prev, [current.id]: out }));
      });
    return () => {
      cancelled = true;
    };
  }, [current, redacteurId, html]);

  if (chapitres.length === 0) {
    return (
      <View style={panel.empty}>
        <FontAwesome5 name="book-open" size={28} color={LIVE.muted} />
        <Text style={panel.emptyText}>{t('liveCall.noChapters')}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={panel.navBar}>
        <TouchableOpacity
          style={panel.navBtn}
          disabled={!isModerator || idx <= 0 || changing}
          onPress={() => onSelect(chapitres[idx - 1].id)}
        >
          <FontAwesome5 name="chevron-left" size={14} color={!isModerator || idx <= 0 ? LIVE.border : LIVE.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={panel.navLabel}>{t('liveCall.chapterOf', { current: Math.max(idx, 0) + 1, total: chapitres.length })}</Text>
          <Text style={panel.navTitle} numberOfLines={1}>
            {current?.titre || ''}
          </Text>
        </View>
        {changing ? (
          <ActivityIndicator size="small" color={LIVE.accent} style={panel.navBtn} />
        ) : (
          <TouchableOpacity
            style={panel.navBtn}
            disabled={!isModerator || idx >= chapitres.length - 1}
            onPress={() => onSelect(chapitres[idx + 1].id)}
          >
            <FontAwesome5
              name="chevron-right"
              size={14}
              color={!isModerator || idx >= chapitres.length - 1 ? LIVE.border : LIVE.text}
            />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={panel.scroll}>
        <View style={panel.contentCard}>
          {current?.contenu ? (
            html[current.id] !== undefined ? (
              <CourseRichContent html={html[current.id]} onOpenLink={(url) => Linking.openURL(url).catch(() => {})} />
            ) : (
              <ActivityIndicator color={LIVE.primary} />
            )
          ) : (
            <Text style={panel.noContent}>{t('liveCall.noContent')}</Text>
          )}
        </View>

        {!isModerator && current ? (
          <TouchableOpacity
            style={[panel.markBtn, doneIds.has(current.id) && panel.markBtnDone]}
            disabled={doneIds.has(current.id)}
            onPress={onMarkDone}
          >
            <FontAwesome5 name="check-circle" size={14} color="#FFFFFF" />
            <Text style={panel.markText}>{doneIds.has(current.id) ? t('liveCall.done') : t('liveCall.markDone')}</Text>
          </TouchableOpacity>
        ) : null}

        <View style={{ marginTop: 16, gap: 8 }}>
          {chapitres.map((c, i) => {
            const active = c.id === currentChapitreId;
            const done = doneIds.has(c.id);
            return (
              <TouchableOpacity
                key={c.id}
                style={[panel.chapterRow, active && panel.chapterRowActive]}
                disabled={!isModerator || active || changing}
                onPress={() => onSelect(c.id)}
                activeOpacity={0.8}
              >
                <View style={[panel.chapterNum, active && { backgroundColor: LIVE.primary }, done && { backgroundColor: LIVE.successSolid }]}>
                  {done ? (
                    <FontAwesome5 name="check" size={10} color="#FFFFFF" />
                  ) : (
                    <Text style={panel.chapterNumText}>{i + 1}</Text>
                  )}
                </View>
                <Text style={[panel.chapterTitle, active && { color: LIVE.text, fontWeight: '700' }]} numberOfLines={2}>
                  {c.titre || `${i + 1}`}
                </Text>
                {active ? <Text style={panel.currentTag}>{t('liveCall.currentChapter')}</Text> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

// ─── Chat (web: ChatBar) ────────────────────────────────────────────────────

interface ChatProps {
  messages: LiveChatMessage[];
  handRaises: LiveParticipant[];
  currentUserId?: string;
  connected: boolean;
  onSend: (text: string) => void;
  onRaiseHand: () => void;
}

const timeOf = (ts?: number) => {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const LiveChatPanel = ({ messages, handRaises, currentUserId, connected, onSend, onRaiseHand }: ChatProps) => {
  const { t } = useT();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<LiveChatMessage>>(null);

  const send = () => {
    const v = text.trim();
    if (!v) return;
    onSend(v);
    setText('');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {handRaises.length > 0 ? (
        <View style={panel.handBanner}>
          {handRaises.map((h) => (
            <Text key={h.userId} style={panel.handText}>
              ✋ {t('liveCall.handRaised', { name: h.userName || 'Participant' })}
            </Text>
          ))}
        </View>
      ) : null}
      {!connected ? <Text style={panel.offline}>{t('liveCall.chatOffline')}</Text> : null}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m, i) => `${m.timestamp ?? 0}-${i}`}
        contentContainerStyle={messages.length === 0 ? panel.empty : panel.chatList}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <>
            <FontAwesome5 name="comments" size={28} color={LIVE.muted} />
            <Text style={panel.emptyText}>{t('liveCall.noMessages')}</Text>
          </>
        }
        renderItem={({ item }) => {
          const mine = !!currentUserId && item.userId === currentUserId;
          return (
            <View style={[panel.bubbleWrap, mine && { alignItems: 'flex-end' }]}>
              {!mine ? <Text style={panel.bubbleName}>{item.userName || 'Participant'}</Text> : null}
              <View style={[panel.bubble, mine ? panel.bubbleMine : panel.bubbleOther]}>
                <Text style={panel.bubbleText}>{item.message}</Text>
              </View>
              <Text style={panel.bubbleTime}>{timeOf(item.timestamp)}</Text>
            </View>
          );
        }}
      />
      <View style={panel.inputBar}>
        <TouchableOpacity style={panel.handBtn} onPress={onRaiseHand} disabled={!connected} accessibilityLabel={t('liveCall.raiseHand')}>
          <FontAwesome5 name="hand-paper" size={16} color={connected ? LIVE.warning : LIVE.border} />
        </TouchableOpacity>
        <TextInput
          style={panel.input}
          value={text}
          onChangeText={setText}
          placeholder={t('liveCall.chatPlaceholder')}
          placeholderTextColor={LIVE.muted}
          onSubmitEditing={send}
          returnKeyType="send"
          editable={connected}
        />
        <TouchableOpacity style={[panel.sendBtn, (!connected || !text.trim()) && { opacity: 0.4 }]} onPress={send} disabled={!connected || !text.trim()}>
          <FontAwesome5 name="paper-plane" size={14} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

// ─── Participants sheet ─────────────────────────────────────────────────────

interface ParticipantsProps {
  visible: boolean;
  participants: LiveParticipant[];
  hostId?: string;
  currentUserId?: string;
  onClose: () => void;
}

export const LiveParticipantsSheet = ({ visible, participants, hostId, currentUserId, onClose }: ParticipantsProps) => {
  const { t } = useT();
  const sorted = useMemo(
    () => [...participants].sort((a, b) => (a.userId === hostId ? -1 : b.userId === hostId ? 1 : 0)),
    [participants, hostId]
  );
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={panel.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={panel.sheet}>
        <View style={panel.sheetHandle} />
        <Text style={panel.sheetTitle}>
          {t('liveCall.participantsTitle')} · {participants.length}
        </Text>
        <ScrollView style={{ maxHeight: 360 }}>
          {sorted.map((p) => (
            <View key={p.userId} style={panel.personRow}>
              <View style={panel.avatar}>
                <Text style={panel.avatarText}>{(p.userName || '?').trim().charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={panel.personName} numberOfLines={1}>
                {p.userName || 'Participant'}
                {p.userId === currentUserId ? ` (${t('liveCall.you')})` : ''}
              </Text>
              {p.userId === hostId ? <Text style={panel.hostTag}>{t('liveCall.host')}</Text> : null}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
};

const panel = StyleSheet.create({
  empty: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  emptyText: { color: LIVE.muted, fontSize: 13, textAlign: 'center' },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: LIVE.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LIVE.border,
  },
  navBtn: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center' },
  navLabel: { color: LIVE.accent, fontSize: 11, fontWeight: '700' },
  navTitle: { color: LIVE.text, fontSize: 14, fontWeight: '700', marginTop: 1 },
  scroll: { padding: 14, paddingBottom: 30 },
  contentCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, minHeight: 80, justifyContent: 'center' },
  noContent: { color: '#6B7280', fontSize: 13, textAlign: 'center' },
  markBtn: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LIVE.successSolid,
    borderRadius: 12,
    paddingVertical: 12,
  },
  markBtnDone: { backgroundColor: LIVE.surface2 },
  markText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  chapterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: LIVE.surface },
  chapterRowActive: { borderWidth: 1, borderColor: LIVE.primary, backgroundColor: 'rgba(79,70,229,0.18)' },
  chapterNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: LIVE.surface2, alignItems: 'center', justifyContent: 'center' },
  chapterNumText: { color: LIVE.text, fontSize: 12, fontWeight: '700' },
  chapterTitle: { flex: 1, color: LIVE.muted, fontSize: 14 },
  currentTag: { color: LIVE.accent, fontSize: 11, fontWeight: '700' },
  handBanner: { backgroundColor: 'rgba(251,191,36,0.15)', paddingHorizontal: 14, paddingVertical: 8, gap: 2 },
  handText: { color: '#FDE68A', fontSize: 13, fontWeight: '600' },
  offline: { color: LIVE.warning, fontSize: 12, textAlign: 'center', paddingVertical: 6 },
  chatList: { padding: 14, gap: 10 },
  bubbleWrap: { alignItems: 'flex-start' },
  bubbleName: { color: LIVE.accent, fontSize: 11, fontWeight: '700', marginBottom: 3 },
  bubble: { maxWidth: '82%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMine: { backgroundColor: LIVE.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: LIVE.surface2, borderBottomLeftRadius: 4 },
  bubbleText: { color: '#FFFFFF', fontSize: 14, lineHeight: 19 },
  bubbleTime: { color: LIVE.muted, fontSize: 10, marginTop: 2 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: LIVE.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LIVE.border,
  },
  handBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: LIVE.surface2, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: LIVE.surface2,
    color: LIVE.text,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: LIVE.primary, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: LIVE.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, paddingBottom: 34 },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: LIVE.border, marginBottom: 12 },
  sheetTitle: { color: LIVE.text, fontSize: 16, fontWeight: '800', marginBottom: 10 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: LIVE.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontWeight: '800' },
  personName: { flex: 1, color: LIVE.text, fontSize: 14 },
  hostTag: {
    color: LIVE.success,
    fontSize: 11,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: LIVE.success,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
});
