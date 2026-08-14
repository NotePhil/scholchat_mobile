import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
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
import { useMessagesStore } from "../../../../store/useMessagesStore";
import { useUser } from "../../../../context/UserContext";
import { MessageItem, MessageParty } from "../../../../types";
import ComposeMessageModal from "./ComposeMessageModal";

type FilterType = "all" | "trash";

interface ConversationThread {
  key: string;
  partner: MessageParty | null;
  partnerLabel: string;
  messages: MessageItem[];
  latest: MessageItem;
  isConversation: boolean;
  hasUnread: boolean;
}

const getInitials = (party: MessageParty | null | undefined) => {
  const nom = party?.nom ?? "";
  const prenom = party?.prenom ?? "";
  const initials = `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
  return initials || "?";
};

const getDisplayName = (party: MessageParty | null | undefined) => {
  if (party?.prenom || party?.nom) return `${party?.prenom ?? ""} ${party?.nom ?? ""}`.trim();
  return party?.email || "Utilisateur";
};

const stripQuoted = (contenu?: string) => (contenu ?? "").split("--- Message original ---")[0].trim();

const formatListDate = (dateString?: string) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const diffHours = (Date.now() - date.getTime()) / 3_600_000;
  if (diffHours < 24) return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (diffHours < 168) return date.toLocaleDateString("fr-FR", { weekday: "short" });
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
};

const formatBubbleTime = (dateString?: string) => {
  if (!dateString) return "";
  return new Date(dateString).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
};

/**
 * Groups messages by conversation PARTNER (the other person), not by
 * subject, so every message exchanged with the same person merges into one
 * thread — mirrors web's real mobile design (MobileMessagingInterface's
 * groupMessagesByConversation in scholchat_front/.../Messsages/
 * MessagingInterface.jsx), which is the actual spec for this screen, not a
 * mobile-invented layout.
 */
const groupByPartner = (messages: MessageItem[], userId?: string): ConversationThread[] => {
  const buckets = new Map<string, { partner: MessageParty | null; messages: MessageItem[] }>();

  messages.forEach((msg) => {
    const isSender = msg.expediteur?.id === userId;
    const destinataires = msg.destinataires ?? [];
    let key: string;
    let partner: MessageParty | null;
    if (isSender && destinataires.length === 1) {
      partner = destinataires[0];
      key = partner.id;
    } else if (!isSender) {
      partner = msg.expediteur ?? null;
      key = partner?.id ?? "unknown";
    } else {
      partner = msg.expediteur ?? null;
      key = `broadcast:${destinataires.map((d) => d.id).sort().join(",")}`;
    }
    if (!buckets.has(key)) buckets.set(key, { partner, messages: [] });
    buckets.get(key)!.messages.push(msg);
  });

  const threads: ConversationThread[] = [];
  buckets.forEach(({ partner, messages: msgs }, key) => {
    const sorted = [...msgs].sort(
      (a, b) => new Date(a.dateCreation ?? 0).getTime() - new Date(b.dateCreation ?? 0).getTime()
    );
    const latest = sorted[sorted.length - 1];
    threads.push({
      key,
      partner,
      partnerLabel: getDisplayName(partner),
      messages: sorted,
      latest,
      isConversation: sorted.length > 1,
      hasUnread: sorted.some((m) => !m.lu && m.expediteur?.id !== userId),
    });
  });

  return threads.sort(
    (a, b) => new Date(b.latest.dateCreation ?? 0).getTime() - new Date(a.latest.dateCreation ?? 0).getTime()
  );
};

interface DashboardMessagesBodyProps {
  onBack?: () => void;
}

const DashboardMessagesBody = ({ onBack }: DashboardMessagesBodyProps) => {
  const { user } = useUser();
  const userId = user?.userId as string | undefined;
  const insets = useSafeAreaInsets();

  const [sent, setSent] = useState<MessageItem[]>([]);
  const [received, setReceived] = useState<MessageItem[]>([]);
  const [trash, setTrash] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filterType, setFilterType] = useState<FilterType>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const [selectedThreadKey, setSelectedThreadKey] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError("");
    try {
      const [sentData, receivedData, trashData] = await Promise.all([
        messageService.getSentMessages(userId),
        messageService.getReceivedMessages(userId),
        messageService.getTrash(userId).catch(() => []),
      ]);
      setSent(sentData);
      setReceived(receivedData);
      setTrash(trashData);
      useMessagesStore.getState().refresh(userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du chargement des messages.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // WhatsApp-style single inbox: every conversation is built from BOTH sides
  // of the exchange, deduped by id — not from `received` alone. Previously
  // "Inbox" only ever fed `received` into groupByPartner and "Envoyés" only
  // fed `sent`, so opening a thread from Inbox never showed your own replies
  // and the same conversation effectively lived in two disconnected places.
  const allMessages = useMemo(() => {
    const byId = new Map<string, MessageItem>();
    [...received, ...sent].forEach((m) => byId.set(m.id, m));
    return Array.from(byId.values());
  }, [received, sent]);

  const sourceMessages = filterType === "trash" ? trash : allMessages;

  const filteredMessages = useMemo(() => {
    if (!searchTerm.trim()) return sourceMessages;
    const term = searchTerm.toLowerCase();
    return sourceMessages.filter(
      (m) =>
        (m.objet ?? "").toLowerCase().includes(term) ||
        (m.contenu ?? "").toLowerCase().includes(term) ||
        getDisplayName(m.expediteur).toLowerCase().includes(term)
    );
  }, [sourceMessages, searchTerm]);

  const threads = useMemo(
    () => (filterType === "trash" ? [] : groupByPartner(filteredMessages, userId)),
    [filteredMessages, filterType, userId]
  );

  const counts = useMemo(
    () => ({
      all: received.filter((m) => !m.lu).length,
      trash: trash.length,
    }),
    [received, trash]
  );

  const selectedThread = threads.find((t) => t.key === selectedThreadKey) ?? null;

  const openThread = (thread: ConversationThread) => {
    setSelectedThreadKey(thread.key);
    if (!userId) return;
    const toMark = thread.messages.filter((m) => !m.lu && m.expediteur?.id !== userId);
    if (toMark.length === 0) return;
    // Only flip a message to "read" locally once the backend confirms it —
    // an optimistic-always update here previously masked failed setRead
    // calls, so the message would silently revert to unread on next load.
    Promise.allSettled(toMark.map((m) => messageService.setRead(m.id, userId, true))).then((results) => {
      const succeededIds = new Set(
        toMark.filter((_, i) => results[i].status === "fulfilled").map((m) => m.id)
      );
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          console.warn("Échec du marquage lu pour le message", toMark[i].id, r.reason);
        }
      });
      if (succeededIds.size > 0) {
        setReceived((prev) => prev.map((m) => (succeededIds.has(m.id) ? { ...m, lu: true } : m)));
        useMessagesStore.getState().refresh(userId);
      }
    });
  };

  const handleSendReply = async () => {
    if (!selectedThread || !replyText.trim() || !userId) return;
    const recipients: MessageParty[] =
      selectedThread.latest.expediteur?.id === userId
        ? selectedThread.latest.destinataires ?? []
        : selectedThread.latest.expediteur
        ? [selectedThread.latest.expediteur]
        : [];
    if (recipients.length === 0) {
      Alert.alert("Erreur", "Destinataire introuvable pour cette réponse.");
      return;
    }
    const content = replyText.trim();
    setSendingReply(true);
    try {
      const created = await messageService.sendIndividualMessage({
        contenu: content,
        objet: (selectedThread.latest.objet ?? "").toLowerCase().startsWith("re:")
          ? selectedThread.latest.objet
          : `Re: ${selectedThread.latest.objet ?? "Sans objet"}`,
        dateCreation: new Date().toISOString(),
        etat: "envoyé",
        expediteur: {
          type: "utilisateur",
          id: userId,
          nom: user?.nom || "",
          prenom: user?.prenom || "",
          email: user?.email || "",
        },
        destinataires: recipients.map((r) => ({
          type: "utilisateur",
          id: r.id,
          nom: r.nom || "",
          prenom: r.prenom || "",
          email: r.email || "",
        })),
      } as Partial<MessageItem>);
      setSent((prev) => [...prev, { ...created, lu: true }]);
      setReplyText("");
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
            load();
          } catch (err) {
            Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la restauration.");
          }
        },
      },
    ]);
  };

  const handleDeleteFromThread = (thread: ConversationThread) => {
    const mine = thread.messages.filter((m) => m.expediteur?.id === userId);
    if (mine.length === 0) {
      Alert.alert("Info", "Vous ne pouvez supprimer que les messages que vous avez envoyés.");
      return;
    }
    Alert.alert("Supprimer", "Déplacer ces messages vers la corbeille ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await Promise.all(mine.map((m) => messageService.remove(m.id).catch(() => {})));
          setSelectedThreadKey(null);
          load();
        },
      },
    ]);
  };

  // ── Thread (chat) view ────────────────────────────────────────────────
  if (selectedThread) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.threadHeader}>
          <TouchableOpacity onPress={() => setSelectedThreadKey(null)} style={styles.threadBackButton}>
            <FontAwesome5 name="arrow-left" size={20} color="#374151" />
          </TouchableOpacity>
          <View style={styles.threadAvatar}>
            <Text style={styles.threadAvatarText}>{getInitials(selectedThread.partner)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.threadName} numberOfLines={1}>
              {selectedThread.partnerLabel}
            </Text>
            <Text style={styles.threadSubject} numberOfLines={1}>
              {selectedThread.latest.objet}
            </Text>
          </View>
          <TouchableOpacity onPress={() => handleDeleteFromThread(selectedThread)} style={styles.threadBackButton}>
            <FontAwesome5 name="trash" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <FlatList
          style={styles.bubbleList}
          contentContainerStyle={{ padding: 16, paddingTop: 20 }}
          data={selectedThread.messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isMine = item.expediteur?.id === userId;
            const body = stripQuoted(item.contenu);
            return (
              <View style={[styles.bubbleRow, isMine && styles.bubbleRowMine]}>
                <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{body}</Text>
                  <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>
                    {formatBubbleTime(item.dateCreation)}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        <View style={styles.replyBar}>
          <TextInput
            style={styles.replyInput}
            value={replyText}
            onChangeText={setReplyText}
            placeholder="Écrire un message..."
            placeholderTextColor="#9CA3AF"
            onSubmitEditing={handleSendReply}
          />
          <TouchableOpacity
            style={[styles.replySendButton, !replyText.trim() && styles.replySendButtonDisabled]}
            onPress={handleSendReply}
            disabled={!replyText.trim() || sendingReply}
          >
            {sendingReply ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <FontAwesome5 name="paper-plane" size={16} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
        {/* Clears the fixed-position MobileFooterNav rendered as a sibling by the dashboard shell, which would otherwise cover the reply bar. */}
        <View style={{ height: Math.max(insets.bottom, 12) + 70 }} />
      </KeyboardAvoidingView>
    );
  }

  // ── Inbox / list view ────────────────────────────────────────────────
  const filterTabs: { id: FilterType; label: string; icon: React.ComponentProps<typeof FontAwesome5>["name"]; count: number }[] = [
    { id: "all", label: "Inbox", icon: "inbox", count: counts.all },
    { id: "trash", label: "Corbeille", icon: "trash-alt", count: counts.trash },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <FontAwesome5 name="arrow-left" size={18} color="#4F46E5" />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity onPress={load} disabled={loading} style={styles.refreshButton}>
          <FontAwesome5 name="sync-alt" size={16} color="#6B7280" style={loading ? { opacity: 0.4 } : undefined} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <FontAwesome5 name="search" size={16} color="#6B7280" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {filterTabs.map((tab) => {
          const active = filterType === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, active && styles.activeTab]}
              onPress={() => setFilterType(tab.id)}
            >
              <FontAwesome5 name={tab.icon} size={13} color={active ? "#FFFFFF" : "#6B7280"} />
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

      <ScrollView style={styles.messagesList}>
        {error ? (
          <View style={styles.emptyState}>
            <FontAwesome5 name="exclamation-circle" size={40} color="#EF4444" />
            <Text style={[styles.emptyStateText, { color: "#EF4444" }]}>{error}</Text>
            <TouchableOpacity onPress={load} style={{ marginTop: 12 }}>
              <Text style={{ color: "#4F46E5", fontWeight: "600" }}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text style={styles.loadingText}>Chargement des messages...</Text>
          </View>
        ) : filterType === "trash" ? (
          filteredMessages.length === 0 ? (
            <EmptyMessagesState searchTerm={searchTerm} />
          ) : (
            filteredMessages.map((m) => (
              <View key={m.id} style={styles.trashItem}>
                <View style={styles.trashAvatar}>
                  <Text style={styles.trashAvatarText}>{getInitials(m.destinataires?.[0])}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.trashSubject} numberOfLines={1}>{m.objet}</Text>
                  <Text style={styles.trashPreview} numberOfLines={1}>{stripQuoted(m.contenu)}</Text>
                </View>
                <TouchableOpacity onPress={() => handleRestore(m)} style={styles.restoreButton}>
                  <FontAwesome5 name="undo" size={14} color="#4F46E5" />
                </TouchableOpacity>
              </View>
            ))
          )
        ) : threads.length === 0 ? (
          <EmptyMessagesState searchTerm={searchTerm} />
        ) : (
          threads.map((thread) => (
            <TouchableOpacity key={thread.key} style={styles.conversationCard} onPress={() => openThread(thread)}>
              <View style={styles.conversationAvatarWrap}>
                <View style={styles.conversationAvatar}>
                  <Text style={styles.conversationAvatarText}>{getInitials(thread.partner)}</Text>
                </View>
                {thread.hasUnread && <View style={styles.unreadDot} />}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.conversationTopRow}>
                  <Text
                    style={[styles.conversationName, thread.hasUnread && styles.conversationNameUnread]}
                    numberOfLines={1}
                  >
                    {thread.partnerLabel}
                  </Text>
                  <Text style={styles.conversationTime}>{formatListDate(thread.latest.dateCreation)}</Text>
                </View>
                <Text style={styles.conversationSubject} numberOfLines={1}>
                  {thread.latest.objet}
                </Text>
                <Text style={styles.conversationPreview} numberOfLines={1}>
                  {stripQuoted(thread.latest.contenu)}
                </Text>
              </View>
              {thread.isConversation && (
                <View style={styles.threadCountWrap}>
                  <Text style={styles.threadCountText}>{thread.messages.length}</Text>
                  <FontAwesome5 name="chevron-right" size={12} color="#D1D5DB" />
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity style={styles.floatingButton} onPress={() => setShowCompose(true)}>
        <FontAwesome5 name="edit" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {showCompose && (
        <ComposeMessageModal
          onClose={() => setShowCompose(false)}
          onSend={() => {
            setShowCompose(false);
            load();
          }}
        />
      )}
    </View>
  );
};

const EmptyMessagesState = ({ searchTerm }: { searchTerm: string }) => (
  <View style={styles.emptyState}>
    <FontAwesome5 name="inbox" size={48} color="#D1D5DB" />
    <Text style={styles.emptyStateText}>{searchTerm ? "Aucun résultat trouvé" : "Aucun message"}</Text>
    {!searchTerm && <Text style={styles.emptyStateSubtext}>Vos conversations apparaîtront ici</Text>}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  backButton: { marginRight: 12, padding: 4 },
  headerTitle: { flex: 1, fontSize: 24, fontWeight: "800", color: "#111827" },
  refreshButton: { padding: 8, backgroundColor: "#FFFFFF", borderRadius: 10 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 14, color: "#111827" },
  tabsContainer: { flexGrow: 0, marginBottom: 12 },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  activeTab: { backgroundColor: "#4F46E5" },
  tabText: { fontSize: 12, fontWeight: "700", color: "#6B7280" },
  activeTabText: { color: "#FFFFFF" },
  tabBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, backgroundColor: "#F3F4F6" },
  tabBadgeActive: { backgroundColor: "rgba(255,255,255,0.25)" },
  tabBadgeText: { fontSize: 10, fontWeight: "700", color: "#6B7280" },
  tabBadgeTextActive: { color: "#FFFFFF" },
  messagesList: { flex: 1, paddingHorizontal: 16 },
  conversationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 14,
    marginBottom: 8,
    borderRadius: 20,
  },
  conversationAvatarWrap: { marginRight: 14 },
  conversationAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  conversationAvatarText: { fontSize: 16, fontWeight: "800", color: "#6B7280" },
  unreadDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#3B82F6",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  conversationTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  conversationName: { flex: 1, fontSize: 14, fontWeight: "600", color: "#374151", marginRight: 8 },
  conversationNameUnread: { fontWeight: "800", color: "#111827" },
  conversationTime: { fontSize: 10, fontWeight: "700", color: "#9CA3AF" },
  conversationSubject: { fontSize: 11, fontWeight: "700", color: "#4F46E5", marginTop: 1 },
  conversationPreview: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  threadCountWrap: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: 8 },
  threadCountText: { fontSize: 10, fontWeight: "700", color: "#9CA3AF" },
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyStateText: { fontSize: 15, fontWeight: "600", color: "#6B7280", marginTop: 12 },
  emptyStateSubtext: { fontSize: 12, color: "#9CA3AF", marginTop: 4 },
  loadingContainer: { alignItems: "center", paddingVertical: 60 },
  loadingText: { fontSize: 14, color: "#6B7280", marginTop: 12 },
  floatingButton: {
    position: "absolute",
    bottom: 120,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  // Trash
  trashItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 14,
    marginBottom: 8,
    borderRadius: 16,
  },
  trashAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  trashAvatarText: { fontSize: 13, fontWeight: "800", color: "#9CA3AF" },
  trashSubject: { fontSize: 13, fontWeight: "700", color: "#374151" },
  trashPreview: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  restoreButton: { padding: 8 },
  // Thread / chat view
  threadHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  threadBackButton: { padding: 6, marginRight: 6 },
  threadAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4F46E5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  threadAvatarText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  threadName: { fontSize: 15, fontWeight: "800", color: "#111827" },
  threadSubject: { fontSize: 11, fontWeight: "600", color: "#9CA3AF" },
  bubbleList: { flex: 1 },
  bubbleRow: { flexDirection: "row", justifyContent: "flex-start", marginBottom: 12 },
  bubbleRowMine: { justifyContent: "flex-end" },
  bubble: { maxWidth: "80%", padding: 14, borderRadius: 22 },
  bubbleTheirs: { backgroundColor: "#F3F4F6", borderBottomLeftRadius: 4 },
  bubbleMine: { backgroundColor: "#4F46E5", borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20, color: "#111827" },
  bubbleTextMine: { color: "#FFFFFF" },
  bubbleTime: { fontSize: 10, color: "#9CA3AF", marginTop: 4, textAlign: "right" },
  bubbleTimeMine: { color: "rgba(255,255,255,0.7)" },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    paddingBottom: 28,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  replyInput: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: "#111827",
  },
  replySendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#4F46E5",
    alignItems: "center",
    justifyContent: "center",
  },
  replySendButtonDisabled: { backgroundColor: "#E5E7EB" },
});

export default DashboardMessagesBody;
