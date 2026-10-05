import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardEvent,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FontAwesome5 } from "@expo/vector-icons";
import { messageService } from "../../../../services/messageService";
import { subscribeMessagesStream, useMessagesStore } from "../../../../store/useMessagesStore";
import { useUser } from "../../../../context/UserContext";
import { useThemeColors } from "../../../../styles/theme";

type ThemeColors = ReturnType<typeof useThemeColors>;
import { MessageItem, MessageParty } from "../../../../types";
import { DeleteScope } from "../../../../services/messageService";
import ComposeMessageModal from "./ComposeMessageModal";
import AttachmentModal, { AttachmentType } from "./AttachmentModal";
import { MessageMediaList, PendingAttachmentsBar, useMessageAttachments } from "./messageMedia";
import {
  ConversationThread,
  formatBubbleTime,
  formatDayLabel,
  formatListDate,
  getDisplayName,
  getInitials,
  getMessagePreview,
  getRoleLabel,
  groupByPartner,
  parseMessageDate,
  splitQuoted,
  stripReplyPrefix,
  toUtilisateurPayload,
  upsertById,
} from "./messageHelpers";

type FilterType = "inbox" | "sent" | "starred" | "trash";

/** Height of the shared floating MobileFooterNav above the bottom safe-area inset. */
const FOOTER_NAV_HEIGHT = 64;

const URL_RE = /(https?:\/\/[^\s]+)/g;

/** Renders message text with tappable links. */
const LinkifiedText = ({ text, style, linkColor }: { text: string; style: any; linkColor: string }) => {
  const parts = text.split(URL_RE);
  return (
    <Text style={style}>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <Text
            key={i}
            style={{ color: linkColor, textDecorationLine: "underline" }}
            onPress={() => Linking.openURL(part).catch(() => Alert.alert("Erreur", "Impossible d'ouvrir le lien."))}
          >
            {part}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        )
      )}
    </Text>
  );
};

interface DashboardMessagesBodyProps {
  onBack?: () => void;
}

const DashboardMessagesBody = ({ onBack }: DashboardMessagesBodyProps) => {
  const { user } = useUser();
  // The login response carries `userId`, not `id`.
  const userId = (user?.userId ?? user?.id) as string | undefined;
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [sent, setSent] = useState<MessageItem[]>([]);
  const [received, setReceived] = useState<MessageItem[]>([]);
  const [trash, setTrash] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [filterType, setFilterType] = useState<FilterType>("inbox");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const [selectedThreadKey, setSelectedThreadKey] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState<number | null>(null);
  const [showReplyAttach, setShowReplyAttach] = useState(false);
  const replyAttachments = useMessageAttachments(userId);

  const markingRef = useRef(new Set<string>());
  const listRef = useRef<FlatList<MessageItem>>(null);
  const loadSeqRef = useRef(0);

  const refreshUnreadBadge = useCallback(() => {
    useMessagesStore.getState().refresh(userId);
  }, [userId]);

  /** `silent` refreshes (reconnect catch-up, pull-to-refresh) never swap the list for a spinner. */
  const load = useCallback(
    async (silent = false) => {
      if (!userId) {
        setLoading(false);
        return;
      }
      const seq = ++loadSeqRef.current;
      if (!silent) setLoading(true);
      try {
        const [sentData, receivedData, trashData] = await Promise.all([
          messageService.getSentMessages(userId),
          messageService.getReceivedMessages(userId),
          messageService.getTrash(userId).catch(() => [] as MessageItem[]),
        ]);
        if (seq !== loadSeqRef.current) return; // a newer load already started
        setSent(sentData);
        setReceived(receivedData);
        setTrash(trashData);
        setError("");
        refreshUnreadBadge();
      } catch (err) {
        if (seq !== loadSeqRef.current) return;
        // Keep showing the last good data on a failed background refresh.
        if (!silent) setError(err instanceof Error ? err.message : "Échec du chargement des messages.");
      } finally {
        if (seq === loadSeqRef.current) setLoading(false);
      }
    },
    [userId, refreshUnreadBadge]
  );

  useEffect(() => {
    load();
  }, [load]);

  const refreshTrash = useCallback(() => {
    if (!userId) return;
    messageService
      .getTrash(userId)
      .then(setTrash)
      .catch(() => {});
  }, [userId]);

  // Live updates pushed on /topic/messages/{userId} (shared STOMP socket, see useMessagesRealtime).
  // No polling: after a socket reconnect the stream emits RESYNC and we re-fetch once.
  useEffect(
    () =>
      subscribeMessagesStream((evt) => {
        if (evt.type === "RESYNC") {
          load(true);
          return;
        }
        const msg = "message" in evt ? evt.message : null;
        if (!msg?.id) return;
        if (evt.type === "NEW_MESSAGE" || evt.type === "MESSAGE_RESTORED") {
          const isSender = !!userId && msg.expediteur?.id === userId;
          const isRecipient = !isSender || (msg.destinataires ?? []).some((d) => d?.id === userId);
          if (isSender) setSent((prev) => upsertById(prev, msg));
          if (isRecipient) setReceived((prev) => upsertById(prev, msg));
          if (evt.type === "MESSAGE_RESTORED") setTrash((prev) => prev.filter((m) => m.id !== msg.id));
        } else if (evt.type === "MESSAGE_DELETED") {
          const drop = (list: MessageItem[]) => list.filter((m) => m.id !== msg.id);
          setSent(drop);
          setReceived(drop);
          // If WE deleted it (e.g. on another device) it now sits in our trash.
          refreshTrash();
        }
      }),
    [userId, load, refreshTrash]
  );

  // Track keyboard so the chat input sits above it (and above the floating footer nav otherwise).
  useEffect(() => {
    const baseWindowHeight = Dimensions.get("window").height;
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e: KeyboardEvent) => {
      // If the OS already resized the window (Android adjustResize without edge-to-edge),
      // the keyboard no longer overlaps us.
      const resizedBy = Math.max(0, baseWindowHeight - Dimensions.get("window").height);
      setKeyboardInset(Math.max(0, e.endCoordinates.height - resizedBy));
    };
    const onHide = () => setKeyboardInset(null);
    const s1 = Keyboard.addListener(showEvt, onShow);
    const s2 = Keyboard.addListener(hideEvt, onHide);
    return () => {
      s1.remove();
      s2.remove();
    };
  }, []);

  // One conversation list built from BOTH sides of every exchange, deduped by id.
  const allMessages = useMemo(() => {
    const byId = new Map<string, MessageItem>();
    [...received, ...sent].forEach((m) => {
      const existing = byId.get(m.id);
      // A message sent to yourself shows up in both lists — keep the received copy (real `lu`).
      byId.set(m.id, existing ? { ...m, ...existing } : m);
    });
    return Array.from(byId.values());
  }, [received, sent]);

  const allThreads = useMemo(() => groupByPartner(allMessages, userId), [allMessages, userId]);

  const term = searchTerm.trim().toLowerCase();

  const listedThreads = useMemo(() => {
    let threads = allThreads;
    if (filterType === "inbox") threads = threads.filter((t) => t.hasReceived);
    else if (filterType === "sent") threads = threads.filter((t) => t.hasSent);
    else if (filterType === "starred") threads = threads.filter((t) => t.hasFavorite);
    if (!term) return threads;
    return threads.filter(
      (t) =>
        t.partnerLabel.toLowerCase().includes(term) ||
        t.messages.some(
          (m) => (m.objet ?? "").toLowerCase().includes(term) || (m.contenu ?? "").toLowerCase().includes(term)
        )
    );
  }, [allThreads, filterType, term]);

  const listedTrash = useMemo(() => {
    const when = (m: MessageItem) => parseMessageDate(m.dateSuppression ?? m.dateCreation)?.getTime() ?? 0;
    const sorted = [...trash].sort((a, b) => when(b) - when(a));
    if (!term) return sorted;
    return sorted.filter(
      (m) =>
        (m.objet ?? "").toLowerCase().includes(term) ||
        (m.contenu ?? "").toLowerCase().includes(term) ||
        getDisplayName(m.expediteur).toLowerCase().includes(term) ||
        (m.destinataires ?? []).some((d) => getDisplayName(d).toLowerCase().includes(term))
    );
  }, [trash, term]);

  const counts = useMemo(
    () => ({
      inbox: allThreads.reduce((n, t) => n + t.unreadCount, 0),
      sent: 0,
      starred: allMessages.filter((m) => m.favori).length,
      trash: trash.length,
    }),
    [allThreads, allMessages, trash]
  );

  const selectedThread = useMemo(
    () => allThreads.find((t) => t.key === selectedThreadKey) ?? null,
    [allThreads, selectedThreadKey]
  );

  const patchMessage = useCallback((id: string, patch: Partial<MessageItem>) => {
    const apply = (list: MessageItem[]) => list.map((m) => (m.id === id ? { ...m, ...patch } : m));
    setReceived(apply);
    setSent(apply);
  }, []);

  const markThreadRead = useCallback(
    (thread: ConversationThread) => {
      if (!userId) return;
      const toMark = thread.messages.filter(
        (m) => !m.lu && m.expediteur?.id !== userId && !markingRef.current.has(m.id)
      );
      if (toMark.length === 0) return;
      toMark.forEach((m) => markingRef.current.add(m.id));
      Promise.allSettled(toMark.map((m) => messageService.setRead(m.id, userId, true))).then((results) => {
        results.forEach((r, i) => {
          const id = toMark[i].id;
          markingRef.current.delete(id);
          // Only flip locally once the backend confirmed it, so a failure doesn't silently revert later.
          if (r.status === "fulfilled") patchMessage(id, { lu: true });
        });
        refreshUnreadBadge();
      });
    },
    [userId, patchMessage, refreshUnreadBadge]
  );

  // Mark incoming messages as read while their thread is open (also covers messages pushed live).
  useEffect(() => {
    if (selectedThread) markThreadRead(selectedThread);
  }, [selectedThread, markThreadRead]);

  const markThreadUnread = async (thread: ConversationThread) => {
    if (!userId) return;
    const lastReceived = [...thread.messages].reverse().find((m) => m.expediteur?.id !== userId);
    if (!lastReceived) return;
    try {
      await messageService.setRead(lastReceived.id, userId, false);
      patchMessage(lastReceived.id, { lu: false });
      refreshUnreadBadge();
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la mise à jour du statut.");
    }
  };

  const toggleFavorite = async (message: MessageItem) => {
    if (!userId) return;
    const next = !message.favori;
    patchMessage(message.id, { favori: next });
    try {
      await messageService.setFavorite(message.id, userId, next);
    } catch (err) {
      patchMessage(message.id, { favori: !next });
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la mise à jour du statut.");
    }
  };

  const removeLocally = useCallback((ids: string[]) => {
    const set = new Set(ids);
    const drop = (list: MessageItem[]) => list.filter((m) => !set.has(m.id));
    setSent(drop);
    setReceived(drop);
  }, []);

  /** Single message: sender may delete for everyone or for themself; a recipient only for themself. */
  const confirmDeleteMessage = (message: MessageItem) => {
    const isMine = message.expediteur?.id === userId;
    const run = async (scope: DeleteScope) => {
      try {
        await messageService.remove(message.id, scope);
        removeLocally([message.id]);
        refreshTrash();
        refreshUnreadBadge();
      } catch (err) {
        Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la suppression du message.");
      }
    };
    if (isMine) {
      Alert.alert("Supprimer le message", "Le message sera placé dans votre corbeille.", [
        { text: "Supprimer pour tout le monde", style: "destructive", onPress: () => run("everyone") },
        { text: "Supprimer pour moi", onPress: () => run("me") },
        { text: "Annuler", style: "cancel" },
      ]);
    } else {
      Alert.alert("Supprimer le message", "Le message sera supprimé de votre messagerie uniquement.", [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer pour moi", style: "destructive", onPress: () => run("me") },
      ]);
    }
  };

  /** Whole conversation (POST /messages/bulk-delete): "everyone" only if the user sent at least one message in it. */
  const confirmDeleteThread = (thread: ConversationThread) => {
    const ids = thread.messages.map((m) => m.id).filter((id) => !id.startsWith("local-"));
    if (ids.length === 0) return;
    const run = async (scope: DeleteScope) => {
      try {
        await messageService.bulkDelete(ids, scope);
        removeLocally(ids);
        if (selectedThreadKey === thread.key) setSelectedThreadKey(null);
        refreshTrash();
        refreshUnreadBadge();
      } catch (err) {
        Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la suppression de la conversation.");
      }
    };
    if (thread.hasSent) {
      Alert.alert(
        "Supprimer la conversation",
        "« Pour tout le monde » supprime vos messages chez tous les participants ; les messages reçus ne sont supprimés que pour vous.",
        [
          { text: "Supprimer pour tout le monde", style: "destructive", onPress: () => run("everyone") },
          { text: "Supprimer pour moi", onPress: () => run("me") },
          { text: "Annuler", style: "cancel" },
        ]
      );
    } else {
      Alert.alert("Supprimer la conversation", "La conversation sera supprimée de votre messagerie uniquement.", [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer pour moi", style: "destructive", onPress: () => run("me") },
      ]);
    }
  };

  const handleThreadLongPress = (thread: ConversationThread) => {
    const options: { text: string; onPress?: () => void; style?: "cancel" | "destructive" }[] = [];
    if (thread.unreadCount > 0) options.push({ text: "Marquer comme lu", onPress: () => markThreadRead(thread) });
    else if (thread.hasReceived) options.push({ text: "Marquer comme non lu", onPress: () => markThreadUnread(thread) });
    options.push({ text: "Supprimer la conversation", style: "destructive", onPress: () => confirmDeleteThread(thread) });
    options.push({ text: "Annuler", style: "cancel" });
    Alert.alert(thread.partnerLabel, undefined, options);
  };

  const handleBubbleLongPress = (message: MessageItem) => {
    if (message.id.startsWith("local-")) return;
    Alert.alert(message.objet || "Message", undefined, [
      { text: message.favori ? "Retirer des favoris" : "Ajouter aux favoris", onPress: () => toggleFavorite(message) },
      { text: "Supprimer", style: "destructive", onPress: () => confirmDeleteMessage(message) },
      { text: "Annuler", style: "cancel" },
    ]);
  };

  // A half-written reply's attachments belong to that conversation only.
  useEffect(() => {
    replyAttachments.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThreadKey]);

  const handleReplyAttach = async (type: AttachmentType) => {
    setShowReplyAttach(false);
    try {
      if (type === "media") await replyAttachments.pickMedia();
      else if (type === "document") await replyAttachments.pickDocument();
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Impossible d'ajouter la pièce jointe.");
    }
  };

  const replyMedias = replyAttachments.toPayload();
  const canSendReply =
    (!!replyText.trim() || replyMedias.length > 0) && !sendingReply && !replyAttachments.isUploading && !replyAttachments.hasErrors;

  const handleSendReply = async () => {
    if (!selectedThread || !userId || sendingReply) return;
    if (replyAttachments.hasErrors) {
      Alert.alert("Pièces jointes", "Certaines pièces jointes n'ont pas pu être téléversées. Retirez-les ou réessayez.");
      return;
    }
    const content = replyText.trim();
    const medias = replyAttachments.toPayload();
    if ((!content && medias.length === 0) || replyAttachments.isUploading) return;
    const recipients: MessageParty[] = selectedThread.partner
      ? [selectedThread.partner]
      : selectedThread.broadcastRecipients;
    if (recipients.length === 0 || recipients.every((r) => r.id === userId)) {
      Alert.alert("Erreur", "Destinataire introuvable pour cette réponse.");
      return;
    }
    const baseSubject = stripReplyPrefix(selectedThread.latest.objet);
    setSendingReply(true);
    try {
      const created = await messageService.sendIndividualMessage({
        contenu: content,
        objet: baseSubject ? `Re: ${baseSubject}` : undefined,
        destinataires: recipients.map((r) => toUtilisateurPayload(r)),
        medias: medias.length ? medias : undefined,
      });
      // The server also pushes NEW_MESSAGE to the sender; upsert by id keeps a single copy.
      setSent((prev) =>
        upsertById(prev, {
          ...created,
          id: created?.id ?? `local-${Date.now()}`,
          contenu: created?.contenu ?? content,
          dateCreation: created?.dateCreation ?? new Date().toISOString(),
          expediteur: created?.expediteur ?? { id: userId, nom: user?.nom, prenom: user?.prenom },
          destinataires: created?.destinataires ?? recipients,
          medias: created?.medias ?? [],
          lu: true,
        })
      );
      setReplyText("");
      replyAttachments.clear();
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de l'envoi de la réponse.");
    } finally {
      setSendingReply(false);
    }
  };

  const handleRestore = (message: MessageItem) => {
    Alert.alert("Restaurer", "Restaurer ce message depuis la corbeille ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Restaurer",
        onPress: async () => {
          try {
            await messageService.restore(message.id);
            setTrash((prev) => prev.filter((m) => m.id !== message.id));
            load(true);
            refreshUnreadBadge();
          } catch (err) {
            Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la restauration.");
          }
        },
      },
    ]);
  };

  const handleEmptyTrash = () => {
    Alert.alert("Vider la corbeille", "Supprimer définitivement tous les messages de votre corbeille ? Cette action est irréversible.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Vider",
        style: "destructive",
        onPress: async () => {
          try {
            await messageService.emptyTrash();
            setTrash([]);
          } catch (err) {
            Alert.alert("Erreur", err instanceof Error ? err.message : "Échec du vidage de la corbeille.");
          }
        },
      },
    ]);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  const footerClearance = Math.max(insets.bottom, 12) + FOOTER_NAV_HEIGHT;

  // ── Thread (chat) view ────────────────────────────────────────────────
  if (selectedThread) {
    const canReply = !!selectedThread.partner || selectedThread.broadcastRecipients.length > 0;
    const subtitle = selectedThread.partner
      ? [getRoleLabel(selectedThread.partner), stripReplyPrefix(selectedThread.latest.objet)].filter(Boolean).join(" · ")
      : `Message groupé · ${selectedThread.broadcastRecipients.length} destinataires`;
    const bottomSpacer = keyboardInset !== null ? keyboardInset + 8 : footerClearance;

    return (
      <View style={styles.container}>
        <View style={styles.threadHeader}>
          <TouchableOpacity onPress={() => setSelectedThreadKey(null)} style={styles.iconButton} accessibilityLabel="Retour">
            <FontAwesome5 name="arrow-left" size={18} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.threadAvatar}>
            {selectedThread.partner ? (
              <Text style={styles.threadAvatarText}>{getInitials(selectedThread.partner)}</Text>
            ) : (
              <FontAwesome5 name="users" size={14} color={colors.white} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.threadName} numberOfLines={1}>
              {selectedThread.partnerLabel}
            </Text>
            {subtitle ? (
              <Text style={styles.threadSubject} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={() => confirmDeleteThread(selectedThread)} style={styles.iconButton} accessibilityLabel="Supprimer la conversation">
            <FontAwesome5 name="trash-alt" size={16} color={colors.textLight} />
          </TouchableOpacity>
        </View>

        <FlatList
          ref={listRef}
          style={styles.bubbleList}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          data={selectedThread.messages}
          keyExtractor={(item) => item.id}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          renderItem={({ item, index }) => {
            const isMine = item.expediteur?.id === userId;
            const { body, quoted } = splitQuoted(item.contenu);
            const prev = index > 0 ? selectedThread.messages[index - 1] : null;
            const day = formatDayLabel(item.dateCreation);
            const showDay = !prev || formatDayLabel(prev.dateCreation) !== day;
            const subject = stripReplyPrefix(item.objet);
            const showSubject = !!subject && (!prev || stripReplyPrefix(prev.objet) !== subject);
            return (
              <View>
                {showDay && day ? <Text style={styles.dayLabel}>{day}</Text> : null}
                <View style={[styles.bubbleRow, isMine && styles.bubbleRowMine]}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onLongPress={() => handleBubbleLongPress(item)}
                    style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}
                  >
                    {showSubject && (
                      <Text style={[styles.bubbleSubject, isMine && styles.bubbleSubjectMine]} numberOfLines={2}>
                        {subject}
                      </Text>
                    )}
                    <MessageMediaList medias={item.medias} mine={isMine} />
                    {body || !item.medias?.length ? (
                      <LinkifiedText
                        text={body || " "}
                        style={[styles.bubbleText, isMine && styles.bubbleTextMine]}
                        linkColor={isMine ? colors.white : colors.primary}
                      />
                    ) : null}
                    {quoted ? (
                      <Text style={[styles.bubbleQuoted, isMine && styles.bubbleQuotedMine]} numberOfLines={6}>
                        {quoted}
                      </Text>
                    ) : null}
                    <View style={styles.bubbleMeta}>
                      {item.favori && (
                        <FontAwesome5 name="star" solid size={9} color={isMine ? colors.white : colors.warning} />
                      )}
                      <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>
                        {formatBubbleTime(item.dateCreation)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />

        {canReply ? (
          <View style={styles.replyContainer}>
            <PendingAttachmentsBar
              items={replyAttachments.items}
              onRemove={replyAttachments.remove}
              onRetry={replyAttachments.retry}
            />
            <View style={styles.replyBar}>
              <TouchableOpacity
                style={styles.replyAttachButton}
                onPress={() => setShowReplyAttach(true)}
                accessibilityLabel="Joindre un fichier"
              >
                <FontAwesome5 name="paperclip" size={16} color={colors.primary} />
              </TouchableOpacity>
              <TextInput
                style={styles.replyInput}
                value={replyText}
                onChangeText={setReplyText}
                placeholder="Écrire un message..."
                placeholderTextColor={colors.textLight}
                multiline
                maxLength={5000}
              />
              <TouchableOpacity
                style={[styles.replySendButton, !canSendReply && styles.replySendButtonDisabled]}
                onPress={handleSendReply}
                disabled={!canSendReply}
                accessibilityLabel="Envoyer"
              >
                {sendingReply || replyAttachments.isUploading ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <FontAwesome5 name="paper-plane" size={16} color={colors.white} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
        {/* Keeps the reply bar above the keyboard, or above the shared floating footer nav. */}
        <View style={{ height: bottomSpacer, backgroundColor: colors.surface }} />
        {showReplyAttach && <AttachmentModal onClose={() => setShowReplyAttach(false)} onAttach={handleReplyAttach} />}
      </View>
    );
  }

  // ── Inbox / list view ────────────────────────────────────────────────
  const filterTabs: {
    id: FilterType;
    label: string;
    icon: React.ComponentProps<typeof FontAwesome5>["name"];
    count: number;
  }[] = [
    { id: "inbox", label: "Inbox", icon: "inbox", count: counts.inbox },
    { id: "sent", label: "Envoyés", icon: "paper-plane", count: counts.sent },
    { id: "starred", label: "Favoris", icon: "star", count: counts.starred },
    { id: "trash", label: "Corbeille", icon: "trash-alt", count: counts.trash },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity style={styles.backButton} onPress={onBack} accessibilityLabel="Retour">
            <FontAwesome5 name="arrow-left" size={18} color={colors.primary} />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity onPress={() => load(true)} disabled={loading} style={styles.refreshButton} accessibilityLabel="Actualiser">
          <FontAwesome5 name="sync-alt" size={15} color={colors.textMuted} style={loading ? { opacity: 0.4 } : undefined} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <FontAwesome5 name="search" size={14} color={colors.textLight} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholderTextColor={colors.textLight}
        />
        {searchTerm ? (
          <TouchableOpacity onPress={() => setSearchTerm("")} accessibilityLabel="Effacer">
            <FontAwesome5 name="times-circle" size={14} color={colors.textLight} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {filterTabs.map((tab) => {
          const active = filterType === tab.id;
          return (
            <TouchableOpacity key={tab.id} style={[styles.tab, active && styles.activeTab]} onPress={() => setFilterType(tab.id)}>
              <FontAwesome5 name={tab.icon} size={12} color={active ? colors.white : colors.textMuted} />
              <Text style={[styles.tabText, active && styles.activeTabText]}>{tab.label}</Text>
              {tab.count > 0 && (
                <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>{tab.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.messagesList}
        contentContainerStyle={{ paddingBottom: insets.bottom + 150 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        {error ? (
          <View style={styles.emptyState}>
            <FontAwesome5 name="exclamation-circle" size={40} color={colors.danger} />
            <Text style={[styles.emptyStateText, { color: colors.danger }]}>{error}</Text>
            <TouchableOpacity onPress={() => load()} style={styles.retryButton}>
              <Text style={styles.retryText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.emptyStateSubtext}>Chargement des messages...</Text>
          </View>
        ) : filterType === "trash" ? (
          listedTrash.length === 0 ? (
            <EmptyState styles={styles} colors={colors} searchTerm={searchTerm} filterType={filterType} />
          ) : (
            <>
              <View style={styles.trashHeaderRow}>
                <Text style={styles.trashHint}>Messages que vous avez supprimés.</Text>
                <TouchableOpacity onPress={handleEmptyTrash} style={styles.emptyTrashButton} accessibilityLabel="Vider la corbeille">
                  <FontAwesome5 name="trash" size={11} color={colors.danger} />
                  <Text style={styles.emptyTrashText}>Vider la corbeille</Text>
                </TouchableOpacity>
              </View>
              {listedTrash.map((m) => {
                const sentByMe = m.expediteur?.id === userId;
                const counterpart = sentByMe ? m.destinataires?.[0] : m.expediteur;
                const preview = getMessagePreview(m);
                return (
                  <View key={m.id} style={styles.trashItem}>
                    <View style={styles.trashAvatar}>
                      <Text style={styles.trashAvatarText}>{getInitials(counterpart)}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.trashTo} numberOfLines={1}>
                        {sentByMe
                          ? `À : ${(m.destinataires ?? []).map(getDisplayName).join(", ") || "—"}`
                          : `De : ${getDisplayName(m.expediteur)}`}
                      </Text>
                      <Text style={styles.trashSubject} numberOfLines={1}>{m.objet || "Sans objet"}</Text>
                      <View style={styles.previewRow}>
                        {preview.icon ? <FontAwesome5 name={preview.icon} size={10} color={colors.textLight} /> : null}
                        <Text style={[styles.trashPreview, { marginTop: 0 }]} numberOfLines={1}>{preview.text}</Text>
                      </View>
                      {m.supprimePourTous ? <Text style={styles.trashBadge}>Supprimé pour tout le monde</Text> : null}
                    </View>
                    <TouchableOpacity onPress={() => handleRestore(m)} style={styles.restoreButton} accessibilityLabel="Restaurer">
                      <FontAwesome5 name="undo" size={14} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </>
          )
        ) : listedThreads.length === 0 ? (
          <EmptyState styles={styles} colors={colors} searchTerm={searchTerm} filterType={filterType} />
        ) : (
          listedThreads.map((thread) => {
            const hasUnread = thread.unreadCount > 0;
            const latestIsMine = thread.latest.expediteur?.id === userId;
            const latestPreview = getMessagePreview(thread.latest);
            return (
              <TouchableOpacity
                key={thread.key}
                style={styles.conversationCard}
                onPress={() => setSelectedThreadKey(thread.key)}
                onLongPress={() => handleThreadLongPress(thread)}
              >
                <View style={styles.conversationAvatarWrap}>
                  <View style={[styles.conversationAvatar, hasUnread && styles.conversationAvatarUnread]}>
                    {thread.partner ? (
                      <Text style={[styles.conversationAvatarText, hasUnread && { color: colors.primary }]}>
                        {getInitials(thread.partner)}
                      </Text>
                    ) : (
                      <FontAwesome5 name="users" size={16} color={colors.textMuted} />
                    )}
                  </View>
                  {hasUnread && <View style={styles.unreadDot} />}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.conversationTopRow}>
                    <Text style={[styles.conversationName, hasUnread && styles.conversationNameUnread]} numberOfLines={1}>
                      {thread.partnerLabel}
                    </Text>
                    <Text style={[styles.conversationTime, hasUnread && { color: colors.primary }]}>
                      {formatListDate(thread.latest.dateCreation)}
                    </Text>
                  </View>
                  <Text style={styles.conversationSubject} numberOfLines={1}>
                    {thread.latest.objet || "Sans objet"}
                  </Text>
                  <View style={styles.conversationBottomRow}>
                    {latestPreview.icon ? (
                      <FontAwesome5
                        name={latestPreview.icon}
                        size={11}
                        color={hasUnread ? colors.text : colors.textMuted}
                        style={{ marginRight: 5 }}
                      />
                    ) : null}
                    <Text style={[styles.conversationPreview, hasUnread && styles.conversationPreviewUnread]} numberOfLines={1}>
                      {latestIsMine ? "Vous : " : ""}
                      {latestPreview.text}
                    </Text>
                    {hasUnread ? (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>{thread.unreadCount}</Text>
                      </View>
                    ) : thread.messages.length > 1 ? (
                      <Text style={styles.threadCountText}>{thread.messages.length}</Text>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.floatingButton, { bottom: footerClearance + 20 }]}
        onPress={() => setShowCompose(true)}
        accessibilityLabel="Nouveau message"
      >
        <FontAwesome5 name="pen" size={20} color={colors.white} />
      </TouchableOpacity>

      {showCompose && (
        <ComposeMessageModal
          onClose={() => setShowCompose(false)}
          onSend={() => {
            setShowCompose(false);
            setFilterType("inbox");
            load(true);
          }}
        />
      )}
    </View>
  );
};

const EMPTY_COPY: Record<FilterType, { icon: React.ComponentProps<typeof FontAwesome5>["name"]; title: string; sub: string }> = {
  inbox: { icon: "inbox", title: "Aucun message", sub: "Vos conversations apparaîtront ici" },
  sent: { icon: "paper-plane", title: "Aucun message envoyé", sub: "Appuyez sur le bouton crayon pour écrire" },
  starred: { icon: "star", title: "Aucun favori", sub: "Appui long sur un message pour l'ajouter aux favoris" },
  trash: { icon: "trash-alt", title: "Corbeille vide", sub: "Les messages que vous supprimez apparaîtront ici" },
};

const EmptyState = ({
  styles,
  colors,
  searchTerm,
  filterType,
}: {
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  searchTerm: string;
  filterType: FilterType;
}) => {
  const copy = EMPTY_COPY[filterType];
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <FontAwesome5 name={searchTerm ? "search" : copy.icon} size={32} color={colors.textLight} />
      </View>
      <Text style={styles.emptyStateText}>{searchTerm ? "Aucun résultat trouvé" : copy.title}</Text>
      <Text style={styles.emptyStateSubtext}>{searchTerm ? "Essayez avec d'autres mots-clés" : copy.sub}</Text>
    </View>
  );
};

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
    backButton: { marginRight: 12, padding: 4 },
    headerTitle: { flex: 1, fontSize: 22, fontWeight: "800", color: c.text },
    refreshButton: { padding: 9, backgroundColor: c.surface, borderRadius: 10, borderWidth: 1, borderColor: c.border },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      marginHorizontal: 16,
      marginBottom: 10,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === "ios" ? 11 : 4,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
    },
    searchIcon: { marginRight: 10 },
    searchInput: { flex: 1, fontSize: 14, color: c.text },
    tabsContainer: { flexGrow: 0, marginBottom: 10 },
    tab: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    activeTab: { backgroundColor: c.primary, borderColor: c.primary },
    tabText: { fontSize: 12, fontWeight: "700", color: c.textMuted },
    activeTabText: { color: c.white },
    tabBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, backgroundColor: c.surfaceElevated },
    tabBadgeActive: { backgroundColor: "rgba(255,255,255,0.25)" },
    tabBadgeText: { fontSize: 10, fontWeight: "700", color: c.textMuted },
    tabBadgeTextActive: { color: c.white },
    messagesList: { flex: 1, paddingHorizontal: 16 },
    conversationCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      padding: 14,
      marginBottom: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
    },
    conversationAvatarWrap: { marginRight: 14 },
    conversationAvatar: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: c.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
    },
    conversationAvatarUnread: { backgroundColor: c.primaryLight },
    conversationAvatarText: { fontSize: 16, fontWeight: "800", color: c.textMuted },
    unreadDot: {
      position: "absolute",
      top: -2,
      right: -2,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: c.primary,
      borderWidth: 2,
      borderColor: c.surface,
    },
    conversationTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
    conversationName: { flex: 1, fontSize: 14, fontWeight: "600", color: c.text, marginRight: 8 },
    conversationNameUnread: { fontWeight: "800" },
    conversationTime: { fontSize: 10, fontWeight: "700", color: c.textLight },
    conversationSubject: { fontSize: 11, fontWeight: "700", color: c.primary, marginTop: 1 },
    conversationBottomRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
    conversationPreview: { flex: 1, fontSize: 12, color: c.textMuted },
    conversationPreviewUnread: { color: c.text, fontWeight: "600" },
    unreadBadge: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 5,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 8,
    },
    unreadBadgeText: { fontSize: 10, fontWeight: "800", color: c.white },
    threadCountText: { fontSize: 10, fontWeight: "700", color: c.textLight, marginLeft: 8 },
    emptyState: { alignItems: "center", paddingVertical: 56, paddingHorizontal: 24 },
    emptyIconWrap: { padding: 22, borderRadius: 999, backgroundColor: c.surfaceElevated, marginBottom: 4 },
    emptyStateText: { fontSize: 15, fontWeight: "700", color: c.text, marginTop: 12, textAlign: "center" },
    emptyStateSubtext: { fontSize: 12, color: c.textMuted, marginTop: 4, textAlign: "center" },
    retryButton: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: c.primaryLight },
    retryText: { color: c.primaryDark, fontWeight: "700" },
    floatingButton: {
      position: "absolute",
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: c.primary,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 8,
    },
    // Trash
    trashHint: { fontSize: 11, color: c.textLight, marginBottom: 8, marginLeft: 4 },
    trashItem: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      padding: 14,
      marginBottom: 8,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
    },
    trashAvatar: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: c.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    trashAvatarText: { fontSize: 13, fontWeight: "800", color: c.textLight },
    trashTo: { fontSize: 11, fontWeight: "600", color: c.textMuted },
    trashSubject: { fontSize: 13, fontWeight: "700", color: c.text, marginTop: 1 },
    trashPreview: { fontSize: 12, color: c.textLight, marginTop: 2 },
    trashHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    emptyTrashButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: c.dangerLight,
    },
    emptyTrashText: { fontSize: 11, fontWeight: "700", color: c.danger },
    previewRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
    trashBadge: { fontSize: 10, fontWeight: "700", color: c.warning, marginTop: 3 },
    restoreButton: { padding: 10, borderRadius: 10, backgroundColor: c.primaryLight, marginLeft: 8 },
    // Thread / chat view
    threadHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    iconButton: { padding: 8 },
    threadAvatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
      marginHorizontal: 8,
    },
    threadAvatarText: { color: c.white, fontSize: 14, fontWeight: "800" },
    threadName: { fontSize: 15, fontWeight: "800", color: c.text },
    threadSubject: { fontSize: 11, fontWeight: "600", color: c.textLight },
    bubbleList: { flex: 1 },
    dayLabel: {
      alignSelf: "center",
      fontSize: 10,
      fontWeight: "700",
      color: c.textMuted,
      backgroundColor: c.surfaceElevated,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
      marginVertical: 8,
      overflow: "hidden",
    },
    bubbleRow: { flexDirection: "row", justifyContent: "flex-start", marginBottom: 10 },
    bubbleRowMine: { justifyContent: "flex-end" },
    bubble: { maxWidth: "82%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
    bubbleTheirs: { backgroundColor: c.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: c.border },
    bubbleMine: { backgroundColor: c.primary, borderBottomRightRadius: 4 },
    bubbleSubject: { fontSize: 11, fontWeight: "800", color: c.primary, marginBottom: 4 },
    bubbleSubjectMine: { color: "rgba(255,255,255,0.85)" },
    bubbleText: { fontSize: 14, lineHeight: 20, color: c.text },
    bubbleTextMine: { color: c.white },
    bubbleQuoted: {
      fontSize: 12,
      lineHeight: 17,
      color: c.textMuted,
      marginTop: 8,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    bubbleQuotedMine: { color: "rgba(255,255,255,0.75)", borderTopColor: "rgba(255,255,255,0.35)" },
    bubbleMeta: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 4 },
    bubbleTime: { fontSize: 10, color: c.textLight },
    bubbleTimeMine: { color: "rgba(255,255,255,0.75)" },
    replyContainer: {
      paddingHorizontal: 12,
      paddingTop: 4,
      backgroundColor: c.surface,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    replyBar: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
      paddingTop: 6,
      paddingBottom: 6,
    },
    replyAttachButton: {
      width: 40,
      height: 44,
      borderRadius: 14,
      backgroundColor: c.primaryLight,
      alignItems: "center",
      justifyContent: "center",
    },
    replyInput: {
      flex: 1,
      maxHeight: 120,
      backgroundColor: c.background,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
      fontSize: 14,
      color: c.text,
    },
    replySendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    replySendButtonDisabled: { backgroundColor: c.grayMid },
  });

export default DashboardMessagesBody;
