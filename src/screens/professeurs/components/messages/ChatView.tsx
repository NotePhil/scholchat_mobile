import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Clipboard,
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardEvent,
  Linking,
  PanResponder,
  Platform,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useThemeColors } from "../../../../styles/theme";
import { translate, useT } from "../../../../i18n";
import { subscribeMessagesStream } from "../../../../store/useMessagesStore";
import { ChatMessage, Conversation, conversationService } from "../../../../services/conversationService";
import AttachmentModal, { AttachmentType } from "./AttachmentModal";
import ChatActionSheet, { ChatAction } from "./ChatActionSheet";
import { ChatAvatar } from "./ConversationList";
import { MessageMediaList, PendingAttachmentsBar, useMessageAttachments } from "./messageMedia";
import {
  avatarColor,
  chatDayLabel,
  chatTime,
  conversationInitials,
  conversationTitle,
  isReadByAll,
  mergeMessages,
  messageExcerpt,
  otherParticipants,
  participantName,
  sameDay,
} from "./chatHelpers";
import { getRoleLabel } from "./messageHelpers";

type ThemeColors = ReturnType<typeof useThemeColors>;
type Styles = ReturnType<typeof createStyles>;

const PAGE_SIZE = 30;
const SWIPE_TRIGGER = 60;
const URL_RE = /(https?:\/\/[^\s]+)/g;

interface Props {
  conversation: Conversation;
  userId?: string;
  me: { prenom?: string | null; nom?: string | null };
  /** Space kept under the composer when the keyboard is closed (floating footer nav). */
  bottomClearance: number;
  onBack: () => void;
  /** The chat was marked read on the server (clear its unread badge). */
  onRead: (conversationId: string) => void;
  /** A message I sent was saved (update the list preview / order). */
  onSent: (message: ChatMessage) => void;
  onConversationChange: (c: Conversation) => void;
  onHidden: (conversationId: string) => void;
  /** "Marquer comme non lu": the parent marks it and leaves the chat. */
  onMarkUnread?: (c: Conversation) => void;
}

const LinkifiedText = ({ text, style, linkColor }: { text: string; style: any; linkColor: string }) => (
  <Text style={style}>
    {text.split(URL_RE).map((part, i) =>
      /^https?:\/\//.test(part) ? (
        <Text
          key={i}
          style={{ color: linkColor, textDecorationLine: "underline" }}
          onPress={() => Linking.openURL(part).catch(() => undefined)}
        >
          {part}
        </Text>
      ) : (
        <Text key={i}>{part}</Text>
      )
    )}
  </Text>
);

/** Swipe a bubble to the right to reply (PanResponder: no gesture-handler root in the app). */
const SwipeToReply = ({
  enabled,
  onReply,
  children,
  iconColor,
}: {
  enabled: boolean;
  onReply: () => void;
  children: React.ReactNode;
  iconColor: string;
}) => {
  const dx = useRef(new Animated.Value(0)).current;
  const onReplyRef = useRef(onReply);
  onReplyRef.current = onReply;
  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_e, g) => enabled && g.dx > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
        onPanResponderMove: (_e, g) => dx.setValue(Math.max(0, Math.min(g.dx, 90))),
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_e, g) => {
          if (g.dx >= SWIPE_TRIGGER) onReplyRef.current();
          Animated.spring(dx, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
        },
        onPanResponderTerminate: () => Animated.spring(dx, { toValue: 0, useNativeDriver: true }).start(),
      }),
    [enabled, dx]
  );
  const iconOpacity = dx.interpolate({ inputRange: [0, SWIPE_TRIGGER], outputRange: [0, 1], extrapolate: "clamp" });
  return (
    <View {...responder.panHandlers}>
      <Animated.View style={{ position: "absolute", left: 8, top: 0, bottom: 0, justifyContent: "center", opacity: iconOpacity }}>
        <FontAwesome5 name="reply" size={16} color={iconColor} />
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: dx }] }}>{children}</Animated.View>
    </View>
  );
};

interface BubbleProps {
  item: ChatMessage;
  mine: boolean;
  showSender: boolean;
  read: boolean;
  highlighted: boolean;
  styles: Styles;
  colors: ThemeColors;
  userId?: string;
  onLongPress: (m: ChatMessage) => void;
  onReply: (m: ChatMessage) => void;
  onQuotePress: (id: string) => void;
}

const Bubble = memo(
  ({ item, mine, showSender, read, highlighted, styles, colors, userId, onLongPress, onReply, onQuotePress }: BubbleProps) => {
    const deleted = !!item.supprimePourTous;
    const text = (item.contenu ?? "").trim();
    const fg = mine ? colors.white : colors.text;
    const sub = mine ? "rgba(255,255,255,0.75)" : colors.textLight;
    const quote = item.replyTo;
    return (
      <SwipeToReply enabled={!deleted && !item.pending} onReply={() => onReply(item)} iconColor={colors.textMuted}>
        <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
          <TouchableOpacity
            activeOpacity={0.85}
            delayLongPress={300}
            onLongPress={() => !item.pending && onLongPress(item)}
            style={[
              styles.bubble,
              mine ? styles.bubbleMine : styles.bubbleTheirs,
              highlighted && styles.bubbleHighlighted,
            ]}
          >
            {showSender ? (
              <Text style={[styles.sender, { color: avatarColor(item.expediteurId) }]} numberOfLines={1}>
                {participantName({ prenom: item.expediteurPrenom, nom: item.expediteurNom })}
              </Text>
            ) : null}
            {quote && !deleted ? (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => onQuotePress(quote.id)}
                style={[styles.quote, mine ? styles.quoteMine : styles.quoteTheirs]}
              >
                <Text style={[styles.quoteName, { color: mine ? colors.white : avatarColor(quote.expediteurId) }]} numberOfLines={1}>
                  {quote.expediteurId === userId
                    ? translate("chat.you")
                    : participantName({ prenom: quote.expediteurPrenom, nom: quote.expediteurNom })}
                </Text>
                <Text style={[styles.quoteText, { color: sub }, quote.supprime && { fontStyle: "italic" }]} numberOfLines={2}>
                  {quote.supprime ? translate("chat.deletedMessage") : quote.extrait || translate("chat.attachment")}
                </Text>
              </TouchableOpacity>
            ) : null}
            {deleted ? (
              <View style={styles.deletedRow}>
                <FontAwesome5 name="ban" size={12} color={sub} />
                <Text style={[styles.deletedText, { color: sub }]}>{translate("chat.deletedMessage")}</Text>
              </View>
            ) : (
              <>
                {item.medias?.length ? <MessageMediaList medias={item.medias} mine={mine} /> : null}
                {text ? (
                  <LinkifiedText text={text} style={[styles.bubbleText, { color: fg }]} linkColor={mine ? colors.white : colors.primary} />
                ) : null}
              </>
            )}
            <View style={styles.meta}>
              {item.favori && !deleted ? (
                <FontAwesome5 name="star" solid size={9} color={mine ? "#fde68a" : "#f59e0b"} style={{ marginRight: 4 }} />
              ) : null}
              <Text style={[styles.time, { color: sub }]}>{chatTime(item.date)}</Text>
              {mine && !deleted ? (
                item.pending ? (
                  <FontAwesome5 name="clock" size={9} color={sub} />
                ) : read ? (
                  <FontAwesome5 name="check-double" size={10} color="#7dd3fc" />
                ) : item.statut === "DELIVERED" ? (
                  <FontAwesome5 name="check-double" size={10} color={sub} />
                ) : (
                  <FontAwesome5 name="check" size={10} color={sub} />
                )
              ) : null}
            </View>
          </TouchableOpacity>
        </View>
      </SwipeToReply>
    );
  }
);

const ChatView = ({
  conversation,
  userId,
  me,
  bottomClearance,
  onBack,
  onRead,
  onSent,
  onConversationChange,
  onHidden,
  onMarkUnread,
}: Props) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const cid = conversation.id;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const hasMoreRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const loadingOlderRef = useRef<Promise<void> | null>(null);
  const [error, setError] = useState("");

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [showAttach, setShowAttach] = useState(false);
  const [menuFor, setMenuFor] = useState<ChatMessage | null>(null);
  const [headerMenu, setHeaderMenu] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState<number | null>(null);

  const attachments = useMessageAttachments(userId);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);
  const markingRef = useRef(false);

  const apply = useCallback((fn: (prev: ChatMessage[]) => ChatMessage[]) => {
    const next = fn(messagesRef.current);
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const setMore = (v: boolean) => {
    hasMoreRef.current = v;
    setHasMore(v);
  };

  const markRead = useCallback(() => {
    if (markingRef.current) return;
    markingRef.current = true;
    conversationService
      .markRead(cid)
      .then(() => onRead(cid))
      .catch(() => undefined)
      .finally(() => {
        markingRef.current = false;
      });
  }, [cid, onRead]);

  const loadLatest = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const page = await conversationService.messages(cid, null, PAGE_SIZE);
        // Keep older pages already loaded (resync), replace the latest window.
        apply((prev) => (silent ? mergeMessages(prev, page.messages) : mergeMessages([], page.messages)));
        if (!silent) setMore(page.hasMore);
        setError("");
        markRead();
      } catch (e) {
        if (!silent) setError(e instanceof Error ? e.message : t("chat.errors.load"));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cid, apply, markRead]
  );

  useEffect(() => {
    messagesRef.current = [];
    setMessages([]);
    setReplyTo(null);
    setDraft("");
    attachments.clear();
    loadLatest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid]);

  const loadOlder = useCallback((): Promise<void> => {
    if (loadingOlderRef.current) return loadingOlderRef.current;
    if (!hasMoreRef.current) return Promise.resolve();
    const oldest = messagesRef.current.find((m) => !m.id.startsWith("local-"));
    if (!oldest) return Promise.resolve();
    setLoadingOlder(true);
    const p = conversationService
      .messages(cid, oldest.id, PAGE_SIZE)
      .then((page) => {
        apply((prev) => mergeMessages(prev, page.messages));
        setMore(page.hasMore);
      })
      .catch(() => undefined)
      .finally(() => {
        loadingOlderRef.current = null;
        setLoadingOlder(false);
      });
    loadingOlderRef.current = p;
    return p;
  }, [cid, apply]);

  // Live events of this conversation.
  useEffect(
    () =>
      subscribeMessagesStream((evt) => {
        if (evt.type === "RESYNC") {
          loadLatest(true);
          return;
        }
        if (!("type" in evt)) return;
        const e = evt as any;
        if (e.type === "NEW_MESSAGE") {
          const chat: ChatMessage | null | undefined = e.chat;
          if (!chat || (chat.conversationId ?? e.conversationId) !== cid) return;
          apply((prev) => mergeMessages(prev, [chat]));
          if (chat.expediteurId !== userId) markRead();
        } else if (e.type === "MESSAGE_DELETED") {
          const id: string | undefined = e.message?.id;
          if (!id || (e.conversationId && e.conversationId !== cid)) return;
          if (e.pourTous) {
            apply((prev) =>
              prev.map((m) =>
                m.id === id
                  ? { ...m, supprimePourTous: true, contenu: "", medias: [] }
                  : m.replyTo?.id === id
                    ? { ...m, replyTo: { ...m.replyTo, supprime: true, extrait: "" } }
                    : m
              )
            );
          } else if (e.pourTous === false) {
            apply((prev) => prev.filter((m) => m.id !== id));
          } else {
            loadLatest(true);
          }
        } else if (e.type === "MESSAGE_RESTORED") {
          if (!e.conversationId || e.conversationId === cid) loadLatest(true);
        } else if (e.type === "CONVERSATION_UPDATED" && e.conversationId === cid) {
          // restored from the trash / star changed on another device: history and stars may differ
          loadLatest(true);
        }
      }),
    [cid, userId, apply, markRead, loadLatest]
  );

  // Keyboard: Android lays the whole app out above the keyboard (KeyboardInsetView) and hides the
  // footer nav; iOS needs the composer lifted by the keyboard height.
  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const base = Dimensions.get("window").height;
    const onShow = (e: KeyboardEvent) => {
      if (Platform.OS === "android") {
        setKeyboardHeight(0);
        return;
      }
      const resizedBy = Math.max(0, base - Dimensions.get("window").height);
      setKeyboardHeight(Math.max(0, e.endCoordinates.height - resizedBy));
    };
    const s1 = Keyboard.addListener(showEvt, onShow);
    const s2 = Keyboard.addListener(hideEvt, () => setKeyboardHeight(null));
    return () => {
      s1.remove();
      s2.remove();
    };
  }, []);

  const data = useMemo(() => [...messages].reverse(), [messages]);
  const isGroup = conversation.type === "GROUPE";

  const startReply = useCallback((m: ChatMessage) => {
    if (m.supprimePourTous || m.pending) return;
    setReplyTo(m);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const jumpTo = useCallback(
    async (id: string) => {
      let guard = 0;
      while (!messagesRef.current.some((m) => m.id === id) && hasMoreRef.current && guard < 15) {
        guard++;
        await loadOlder();
      }
      const idx = [...messagesRef.current].reverse().findIndex((m) => m.id === id);
      if (idx < 0) {
        Alert.alert(t("chat.title"), t("chat.originalNotFound"));
        return;
      }
      setTimeout(() => {
        try {
          listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
        } catch {
          // handled by onScrollToIndexFailed
        }
      }, 80);
      setHighlightId(id);
      setTimeout(() => setHighlightId((h) => (h === id ? null : h)), 1800);
    },
    [loadOlder, t]
  );

  const copy = (m: ChatMessage) => {
    const text = (m.contenu ?? "").trim();
    if (!text) return;
    try {
      Clipboard.setString(text);
      if (Platform.OS === "ios") Alert.alert(t("chat.copied"));
    } catch {
      Share.share({ message: text }).catch(() => undefined);
    }
  };

  const deleteMessage = async (m: ChatMessage, pourTous: boolean) => {
    try {
      await conversationService.deleteMessage(cid, m.id, pourTous);
      apply((prev) =>
        pourTous
          ? prev.map((x) => (x.id === m.id ? { ...x, supprimePourTous: true, contenu: "", medias: [] } : x))
          : prev.filter((x) => x.id !== m.id)
      );
      if (replyTo?.id === m.id) setReplyTo(null);
    } catch (e) {
      Alert.alert(t("common.error"), e instanceof Error ? e.message : t("chat.errors.delete"));
    }
  };

  /** Star / unstar a message (old per-user favori status); the list's "Favoris" filter follows. */
  const toggleMessageStar = async (m: ChatMessage) => {
    if (!userId) return;
    const next = !m.favori;
    apply((prev) => prev.map((x) => (x.id === m.id ? { ...x, favori: next } : x)));
    try {
      await conversationService.setMessageFavorite(m.id, userId, next);
      const fresh = await conversationService.get(cid).catch(() => null);
      if (fresh) onConversationChange({ ...conversation, contientFavori: !!fresh.contientFavori });
    } catch (e) {
      apply((prev) => prev.map((x) => (x.id === m.id ? { ...x, favori: !next } : x)));
      Alert.alert(t("common.error"), e instanceof Error ? e.message : t("chat.errors.generic"));
    }
  };

  const messageActions = (m: ChatMessage): ChatAction[] => {
    const mine = m.expediteurId === userId;
    const list: ChatAction[] = [];
    if (!m.supprimePourTous) list.push({ key: "reply", label: t("chat.reply"), icon: "reply", onPress: () => startReply(m) });
    if (!m.supprimePourTous && (m.contenu ?? "").trim()) list.push({ key: "copy", label: t("chat.copy"), icon: "copy", onPress: () => copy(m) });
    if (!m.supprimePourTous) {
      list.push({
        key: "star",
        label: m.favori ? t("chat.unstarMessage") : t("chat.starMessage"),
        icon: "star",
        onPress: () => toggleMessageStar(m),
      });
    }
    list.push({ key: "me", label: t("chat.deleteForMe"), icon: "trash-alt", destructive: true, onPress: () => deleteMessage(m, false) });
    if (mine && !m.supprimePourTous) {
      list.push({
        key: "all",
        label: t("chat.deleteForAll"),
        icon: "trash",
        destructive: true,
        onPress: () =>
          Alert.alert(t("chat.deleteTitle"), undefined, [
            { text: t("common.cancel"), style: "cancel" },
            { text: t("chat.deleteForAll"), style: "destructive", onPress: () => deleteMessage(m, true) },
          ]),
      });
    }
    return list;
  };

  const handleAttach = async (type: AttachmentType) => {
    setShowAttach(false);
    try {
      if (type === "media") await attachments.pickMedia();
      else if (type === "camera") await attachments.captureMedia("photo");
      else if (type === "video") await attachments.captureMedia("video");
      else if (type === "document") await attachments.pickDocument();
    } catch (e) {
      Alert.alert(t("common.error"), e instanceof Error ? e.message : t("chat.errors.generic"));
    }
  };

  const medias = attachments.toPayload();
  const canSend = (!!draft.trim() || medias.length > 0) && !sending && !attachments.isUploading;

  const send = async () => {
    if (!userId || !canSend) return;
    if (attachments.hasErrors) {
      Alert.alert(t("chat.title"), t("chat.uploadErrors"));
      return;
    }
    const text = draft.trim();
    const quoted = replyTo;
    const withMedia = medias.length > 0;
    const localId = `local-${Date.now()}`;
    setSending(true);
    setDraft("");
    setReplyTo(null);
    if (!withMedia) {
      apply((prev) => [
        ...prev,
        {
          id: localId,
          conversationId: cid,
          expediteurId: userId,
          expediteurPrenom: me.prenom ?? "",
          expediteurNom: me.nom ?? "",
          contenu: text,
          medias: [],
          date: new Date().toISOString(),
          replyTo: quoted
            ? {
                id: quoted.id,
                expediteurId: quoted.expediteurId,
                expediteurPrenom: quoted.expediteurPrenom,
                expediteurNom: quoted.expediteurNom,
                extrait: messageExcerpt(quoted),
                supprime: false,
              }
            : null,
          statut: null,
          pending: true,
        },
      ]);
    }
    try {
      const saved = await conversationService.send(cid, { contenu: text, medias, replyToId: quoted?.id ?? null });
      apply((prev) => mergeMessages(prev.filter((m) => m.id !== localId), [saved]));
      if (withMedia) attachments.clear();
      onSent(saved);
    } catch (e) {
      apply((prev) => prev.filter((m) => m.id !== localId));
      setDraft((d) => d || text);
      if (quoted) setReplyTo((r) => r ?? quoted);
      Alert.alert(t("chat.sendFailed"), e instanceof Error ? e.message : t("chat.errors.send"));
    } finally {
      setSending(false);
    }
  };

  const others = otherParticipants(conversation, userId);
  const title = conversationTitle(conversation, userId);
  const subtitle = isGroup
    ? others.map((p) => (p.prenom || p.nom || "").trim()).filter(Boolean).join(", ") ||
      t("chat.participants", { count: conversation.participants.length })
    : getRoleLabel(others[0] ? { typeUtilisateur: others[0].typeUtilisateur ?? undefined } : null);

  /** Star / unstar the conversation (for me only). */
  const toggleFavorite = async () => {
    const next = !conversation.favori;
    onConversationChange({ ...conversation, favori: next });
    try {
      await conversationService.setFavorite(cid, next);
    } catch (e) {
      onConversationChange({ ...conversation, favori: !next });
      Alert.alert(t("common.error"), e instanceof Error ? e.message : t("chat.errors.generic"));
    }
  };

  const headerActions: ChatAction[] = [
    {
      key: "favorite",
      label: conversation.favori ? t("chat.removeFavorite") : t("chat.addFavorite"),
      icon: "star",
      onPress: toggleFavorite,
    },
    ...(onMarkUnread
      ? [
          {
            key: "unread",
            label: t("chat.markUnread"),
            icon: "envelope" as const,
            onPress: () => onMarkUnread(conversation),
          },
        ]
      : []),
    {
      key: "mute",
      label: conversation.muted ? t("chat.unmute") : t("chat.mute"),
      icon: conversation.muted ? "bell" : "bell-slash",
      onPress: async () => {
        try {
          const updated = await conversationService.setMuted(cid, !conversation.muted);
          onConversationChange({ ...conversation, ...updated, muted: !conversation.muted });
        } catch (e) {
          Alert.alert(t("common.error"), e instanceof Error ? e.message : t("chat.errors.generic"));
        }
      },
    },
    {
      key: "hide",
      label: t("chat.deleteChat"),
      icon: "trash-alt",
      destructive: true,
      onPress: () =>
        Alert.alert(t("chat.deleteChat"), t("chat.deleteChatConfirm"), [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.delete"),
            style: "destructive",
            onPress: async () => {
              try {
                await conversationService.hide(cid);
                onHidden(cid);
              } catch (e) {
                Alert.alert(t("common.error"), e instanceof Error ? e.message : t("chat.errors.delete"));
              }
            },
          },
        ]),
    },
  ];

  const bottomSpacer = keyboardHeight !== null ? keyboardHeight : bottomClearance;

  const renderItem = ({ item, index }: { item: ChatMessage; index: number }) => {
    const older = data[index + 1];
    const mine = item.expediteurId === userId;
    const showDay = !older || !sameDay(older.date, item.date);
    const showSender = isGroup && !mine && (showDay || older?.expediteurId !== item.expediteurId);
    const read = mine && (item.statut === "READ" || isReadByAll(item, conversation, userId));
    return (
      <View>
        {showDay ? (
          <View style={styles.dayWrap}>
            <Text style={styles.dayLabel}>{chatDayLabel(item.date)}</Text>
          </View>
        ) : null}
        <Bubble
          item={item}
          mine={mine}
          showSender={showSender}
          read={read}
          highlighted={highlightId === item.id}
          styles={styles}
          colors={colors}
          userId={userId}
          onLongPress={setMenuFor}
          onReply={startReply}
          onQuotePress={jumpTo}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.iconBtn} accessibilityLabel={t("common.back")}>
          <FontAwesome5 name="arrow-left" size={18} color={colors.text} />
        </TouchableOpacity>
        <ChatAvatar label={conversationInitials(conversation, userId)} seed={conversation.id} group={isGroup} size={38} />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.headerSub} numberOfLines={1}>
              {conversation.muted ? `${t("chat.muted")} · ` : ""}
              {subtitle}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={toggleFavorite}
          style={styles.iconBtn}
          accessibilityLabel={conversation.favori ? t("chat.removeFavorite") : t("chat.addFavorite")}
          accessibilityState={{ selected: !!conversation.favori }}
        >
          <FontAwesome5 name="star" solid={!!conversation.favori} size={16} color={conversation.favori ? "#f59e0b" : colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setHeaderMenu(true)} style={styles.iconBtn} accessibilityLabel="Menu">
          <FontAwesome5 name="ellipsis-v" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {loading && messages.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error && messages.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: colors.danger, textAlign: "center" }}>{error}</Text>
          <TouchableOpacity onPress={() => loadLatest()} style={styles.retry}>
            <Text style={styles.retryText}>{t("chat.retry")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          inverted
          style={styles.list}
          data={data}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          extraData={[highlightId, conversation.participants, isGroup]}
          contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 8 }}
          keyboardShouldPersistTaps="handled"
          onEndReached={() => {
            if (hasMore) loadOlder();
          }}
          onEndReachedThreshold={0.3}
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            listRef.current?.scrollToOffset({ offset: Math.max(0, index * averageItemLength), animated: false });
            setTimeout(() => {
              try {
                listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
              } catch {
                // give up quietly
              }
            }, 250);
          }}
          ListFooterComponent={
            loadingOlder ? (
              <View style={styles.olderLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.olderText}>{t("chat.loadingOlder")}</Text>
              </View>
            ) : null
          }
        />
      )}

      <View style={styles.composerWrap}>
        {replyTo ? (
          <View style={styles.replyPreview}>
            <View style={[styles.replyBar, { backgroundColor: avatarColor(replyTo.expediteurId) }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.replyName, { color: avatarColor(replyTo.expediteurId) }]} numberOfLines={1}>
                {replyTo.expediteurId === userId
                  ? t("chat.you")
                  : t("chat.replyingTo", {
                      name: participantName({ prenom: replyTo.expediteurPrenom, nom: replyTo.expediteurNom }),
                    })}
              </Text>
              <Text style={styles.replyText} numberOfLines={2}>
                {messageExcerpt(replyTo)}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={10} accessibilityLabel={t("chat.cancelReply")}>
              <FontAwesome5 name="times" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        ) : null}
        <PendingAttachmentsBar items={attachments.items} onRemove={attachments.remove} onRetry={attachments.retry} />
        <View style={styles.composer}>
          <View style={styles.inputBox}>
            <TouchableOpacity onPress={() => setShowAttach(true)} style={styles.inputIcon} accessibilityLabel={t("chat.attach")}>
              <FontAwesome5 name="paperclip" size={16} color={colors.textMuted} />
            </TouchableOpacity>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder={t("chat.typeMessage")}
              placeholderTextColor={colors.textLight}
              multiline
              maxLength={5000}
            />
            {!draft.trim() ? (
              <TouchableOpacity
                onPress={() => handleAttach("camera")}
                style={styles.inputIcon}
                accessibilityLabel={t("camera.takePhoto")}
              >
                <FontAwesome5 name="camera" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
            onPress={send}
            disabled={!canSend}
            accessibilityLabel={t("chat.send")}
          >
            {sending || attachments.isUploading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <FontAwesome5 name="paper-plane" size={16} color={colors.white} solid />
            )}
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ height: bottomSpacer, backgroundColor: colors.surface }} />

      {showAttach && <AttachmentModal onClose={() => setShowAttach(false)} onAttach={handleAttach} />}
      {menuFor && (
        <ChatActionSheet
          title={messageExcerpt(menuFor)}
          actions={messageActions(menuFor)}
          onClose={() => setMenuFor(null)}
        />
      )}
      {headerMenu && <ChatActionSheet title={title} actions={headerActions} onClose={() => setHeaderMenu(false)} />}
    </View>
  );
};

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 6,
      paddingVertical: 8,
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    iconBtn: { padding: 10 },
    headerText: { flex: 1, minWidth: 0, marginLeft: 10 },
    headerTitle: { fontSize: 16, fontWeight: "800", color: c.text },
    headerSub: { fontSize: 12, color: c.textMuted, marginTop: 1 },
    list: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    retry: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: c.primaryLight },
    retryText: { color: c.primaryDark, fontWeight: "700" },
    olderLoading: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10 },
    olderText: { fontSize: 12, color: c.textMuted },
    dayWrap: { alignItems: "center", marginVertical: 8 },
    dayLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: c.textMuted,
      backgroundColor: c.surfaceElevated,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      overflow: "hidden",
    },
    bubbleRow: { flexDirection: "row", justifyContent: "flex-start", marginVertical: 2 },
    bubbleRowMine: { justifyContent: "flex-end" },
    bubble: { maxWidth: "82%", minWidth: 70, paddingHorizontal: 10, paddingTop: 6, paddingBottom: 4, borderRadius: 14 },
    bubbleMine: { backgroundColor: c.primary, borderBottomRightRadius: 4 },
    bubbleTheirs: { backgroundColor: c.surface, borderBottomLeftRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    bubbleHighlighted: { borderWidth: 2, borderColor: "#facc15" },
    sender: { fontSize: 12, fontWeight: "800", marginBottom: 2 },
    quote: { borderLeftWidth: 3, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 5 },
    quoteMine: { backgroundColor: "rgba(255,255,255,0.18)", borderLeftColor: "rgba(255,255,255,0.8)" },
    quoteTheirs: { backgroundColor: c.surfaceElevated, borderLeftColor: c.primary },
    quoteName: { fontSize: 12, fontWeight: "800" },
    quoteText: { fontSize: 12, marginTop: 1 },
    bubbleText: { fontSize: 15, lineHeight: 21 },
    deletedRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 2 },
    deletedText: { fontSize: 14, fontStyle: "italic" },
    meta: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 2 },
    time: { fontSize: 10 },
    composerWrap: {
      backgroundColor: c.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      paddingHorizontal: 8,
      paddingTop: 6,
    },
    replyPreview: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: c.surfaceElevated,
      borderRadius: 10,
      padding: 8,
      marginBottom: 6,
    },
    replyBar: { width: 3, alignSelf: "stretch", borderRadius: 2 },
    replyName: { fontSize: 12, fontWeight: "800" },
    replyText: { fontSize: 12, color: c.textMuted, marginTop: 1 },
    composer: { flexDirection: "row", alignItems: "flex-end", gap: 6, paddingBottom: 6 },
    inputBox: {
      flex: 1,
      flexDirection: "row",
      alignItems: "flex-end",
      backgroundColor: c.background,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 4,
    },
    inputIcon: { paddingHorizontal: 10, paddingVertical: 12 },
    input: {
      flex: 1,
      maxHeight: 120,
      minHeight: 42,
      paddingTop: Platform.OS === "ios" ? 12 : 9,
      paddingBottom: Platform.OS === "ios" ? 12 : 9,
      fontSize: 15,
      color: c.text,
    },
    sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" },
    sendBtnDisabled: { backgroundColor: c.grayMid },
  });

export default ChatView;
