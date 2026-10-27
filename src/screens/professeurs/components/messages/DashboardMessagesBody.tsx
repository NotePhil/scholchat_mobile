import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import { useHardwareBack } from "../../../../hooks/useHardwareBack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "../../../../context/UserContext";
import { useUiStore } from "../../../../store/useUiStore";
import { subscribeMessagesStream, useMessagesStore } from "../../../../store/useMessagesStore";
import { translate } from "../../../../i18n";
import { ChatMessage, ChatTrash, Conversation, conversationService } from "../../../../services/conversationService";
import ConversationList from "./ConversationList";
import ChatView from "./ChatView";
import ComposeMessageModal from "./ComposeMessageModal";
import { MessageItem } from "../../../../types";
import ChatActionSheet from "./ChatActionSheet";
import {
  ConversationFilter,
  conversationTitle,
  isUnreadConversation,
  mediaSummary,
  sortConversations,
} from "./chatHelpers";

/** Height of the shared floating MobileFooterNav above the bottom safe-area inset. */
const FOOTER_NAV_HEIGHT = 64;

interface DashboardMessagesBodyProps {
  onBack?: () => void;
}

/**
 * Messages tab — WhatsApp-like chat: conversation list ⇄ chat view.
 * Data: ConversationsApi (/conversations…); live updates on /topic/messages/{userId}
 * (shared STOMP socket, see useMessagesRealtime) — no polling.
 */
const DashboardMessagesBody = ({ onBack }: DashboardMessagesBodyProps) => {
  const { user } = useUser();
  // The login response carries `userId`, not `id`.
  const userId = (user?.userId ?? user?.id) as string | undefined;
  const insets = useSafeAreaInsets();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [openFallback, setOpenFallback] = useState<Conversation | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [menuFor, setMenuFor] = useState<Conversation | null>(null);
  // List filters: Tous / Non lus / Favoris / Général / Envoyés / Corbeille
  const [filter, setFilter] = useState<ConversationFilter>("all");
  const [trash, setTrash] = useState<ChatTrash>({ conversations: [], messages: [] });
  const [trashLoading, setTrashLoading] = useState(true);
  const [trashMenu, setTrashMenu] = useState<
    { kind: "conversation"; item: Conversation } | { kind: "message"; item: ChatMessage } | null
  >(null);

  const openIdRef = useRef<string | null>(null);
  openIdRef.current = openId;
  const conversationsRef = useRef<Conversation[]>([]);
  conversationsRef.current = conversations;
  const loadSeqRef = useRef(0);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshBadge = useCallback(() => {
    useMessagesStore.getState().refresh(userId);
  }, [userId]);

  const load = useCallback(
    async (silent = false) => {
      if (!userId) {
        setLoading(false);
        return;
      }
      const seq = ++loadSeqRef.current;
      if (!silent) setLoading(true);
      try {
        const list = await conversationService.list();
        if (seq !== loadSeqRef.current) return;
        setConversations(sortConversations(list));
        setError("");
      } catch (e) {
        if (seq !== loadSeqRef.current) return;
        if (!silent) setError(e instanceof Error ? e.message : translate("chat.errors.load"));
      } finally {
        if (seq === loadSeqRef.current) setLoading(false);
      }
    },
    [userId]
  );

  /** My trash (deleted conversations and messages); secondary: errors keep the current one. */
  const loadTrash = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await conversationService.trash();
      setTrash(data);
    } catch {
      // keep the current trash
    } finally {
      setTrashLoading(false);
    }
  }, [userId]);

  const scheduleReload = useCallback(() => {
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = setTimeout(() => {
      load(true);
      loadTrash();
    }, 400);
  }, [load, loadTrash]);

  useEffect(() => {
    load();
    loadTrash();
    return () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    };
  }, [load, loadTrash]);

  const patchConversation = useCallback((id: string, fn: (c: Conversation) => Conversation) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? fn(c) : c)));
    setOpenFallback((c) => (c && c.id === id ? fn(c) : c));
  }, []);

  /** Puts a just-sent / just-received message on top of the list as the conversation preview. */
  const applyMessageToList = useCallback(
    (m: ChatMessage) => {
      if (!conversationsRef.current.some((c) => c.id === m.conversationId)) {
        // Unknown (new conversation, or one hidden for me) → fetch the list once.
        scheduleReload();
        return;
      }
      setConversations((prev) => {
        const next = prev.map((c) => {
          if (c.id !== m.conversationId) return c;
          const fromOther = m.expediteurId !== userId;
          const isOpen = openIdRef.current === c.id;
          const alreadyLast = c.dernierMessage?.id === m.id;
          const text = (m.contenu ?? "").trim();
          return {
            ...c,
            lastMessageAt: m.date,
            nonLus: fromOther && !isOpen && !alreadyLast ? (c.nonLus ?? 0) + 1 : isOpen ? 0 : c.nonLus,
            dernierMessage: {
              id: m.id,
              contenu: m.supprimePourTous ? "" : text || (m.medias?.length ? translate("chat.attachment") : mediaSummary(m.medias)),
              expediteurId: m.expediteurId,
              expediteurPrenom: m.expediteurPrenom,
              expediteurNom: m.expediteurNom,
              date: m.date,
              supprime: !!m.supprimePourTous,
            },
          };
        });
        return sortConversations(next);
      });
    },
    [userId, scheduleReload]
  );

  // Live updates of the list (the open ChatView handles its own messages).
  useEffect(
    () =>
      subscribeMessagesStream((evt) => {
        if (evt.type === "RESYNC") {
          load(true);
          loadTrash();
          return;
        }
        const e = evt as any;
        if (e.type === "NEW_MESSAGE") {
          if (e.chat?.conversationId) applyMessageToList(e.chat as ChatMessage);
          else scheduleReload();
        } else if (e.type === "CONVERSATION_READ" && e.conversationId) {
          if (e.lecteurId === userId) {
            patchConversation(e.conversationId, (c) => ({ ...c, nonLus: 0 }));
          } else if (e.lecteurId) {
            patchConversation(e.conversationId, (c) => ({
              ...c,
              participants: (c.participants ?? []).map((p) =>
                p.id === e.lecteurId ? { ...p, lastReadAt: e.luJusqua ?? new Date().toISOString() } : p
              ),
            }));
          }
        } else if (
          e.type === "MESSAGE_DELETED" ||
          e.type === "MESSAGE_RESTORED" ||
          // my own view changed elsewhere: favourite, marked unread, muted, trash
          e.type === "CONVERSATION_UPDATED" ||
          e.type === "CORBEILLE_UPDATED"
        ) {
          scheduleReload();
        }
      }),
    [userId, load, loadTrash, scheduleReload, applyMessageToList, patchConversation]
  );

  const openConversation = useCallback((c: Conversation) => {
    setOpenFallback(c);
    setOpenId(c.id);
  }, []);

  const closeConversation = useCallback(() => {
    setOpenId(null);
    setOpenFallback(null);
  }, []);

  // Hardware back closes the open chat first.
  useHardwareBack(closeConversation, !!openId);

  // Opened from a notification tap (MESSAGE_SENT → useUiStore.requestConversation): the conversation
  // of that message, else the direct chat with its sender.
  const pendingConversation = useUiStore((s) => s.pendingConversation);
  useEffect(() => {
    if (!pendingConversation || !userId) return;
    useUiStore.getState().clearPendingConversation();
    const { messageId, partnerId } = pendingConversation;
    (async () => {
      let conv: Conversation | null = null;
      if (messageId) conv = await conversationService.byMessage(messageId).catch(() => null);
      if (!conv && partnerId && partnerId !== userId) conv = await conversationService.create([partnerId]).catch(() => null);
      if (!conv) {
        Alert.alert(translate("notifications.unavailableTitle"), translate("chat.unavailable"));
        return;
      }
      const found = conv;
      setConversations((prev) => (prev.some((c) => c.id === found.id) ? prev : sortConversations([found, ...prev])));
      openConversation(found);
    })();
  }, [pendingConversation, userId, openConversation]);

  /**
   * Original "Nouveau message" flow (individuel / à une classe): after the send, refresh the list and
   * open the conversation the backend put the message in.
   */
  const handleComposeSent = useCallback(
    async (sent?: MessageItem) => {
      setShowNew(false);
      load(true);
      refreshBadge();
      if (!sent) return;
      let conv: Conversation | null = null;
      if (sent.conversationId) conv = await conversationService.get(sent.conversationId).catch(() => null);
      if (!conv && sent.id) conv = await conversationService.byMessage(String(sent.id)).catch(() => null);
      if (!conv) return;
      const found = conv;
      setConversations((prev) => sortConversations([found, ...prev.filter((c) => c.id !== found.id)]));
      openConversation(found);
    },
    [load, refreshBadge, openConversation]
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(true), loadTrash()]);
    setRefreshing(false);
  };

  const onRead = useCallback(
    (id: string) => {
      patchConversation(id, (c) => ({ ...c, nonLus: 0, marqueNonLu: false }));
      refreshBadge();
    },
    [patchConversation, refreshBadge]
  );

  const hideConversation = async (c: Conversation) => {
    try {
      await conversationService.hide(c.id);
      setConversations((prev) => prev.filter((x) => x.id !== c.id));
      refreshBadge();
      loadTrash();
    } catch (e) {
      Alert.alert(translate("common.error"), e instanceof Error ? e.message : translate("chat.errors.delete"));
    }
  };

  const toggleFavorite = async (c: Conversation) => {
    const next = !c.favori;
    patchConversation(c.id, (x) => ({ ...x, favori: next }));
    try {
      await conversationService.setFavorite(c.id, next);
    } catch (e) {
      patchConversation(c.id, (x) => ({ ...x, favori: !next }));
      Alert.alert(translate("common.error"), e instanceof Error ? e.message : translate("chat.errors.generic"));
    }
  };

  /** "Marquer comme non lu" (also from the open chat, which is then closed so it stays unread). */
  const markUnread = async (c: Conversation) => {
    patchConversation(c.id, (x) => ({ ...x, marqueNonLu: true }));
    if (openIdRef.current === c.id) closeConversation();
    try {
      await conversationService.markUnread(c.id);
    } catch (e) {
      patchConversation(c.id, (x) => ({ ...x, marqueNonLu: false }));
      Alert.alert(translate("common.error"), e instanceof Error ? e.message : translate("chat.errors.generic"));
    }
    refreshBadge();
  };

  const markRead = async (c: Conversation) => {
    patchConversation(c.id, (x) => ({ ...x, nonLus: 0, marqueNonLu: false }));
    try {
      await conversationService.markRead(c.id);
    } catch {
      // the badge is refreshed on the next load
    }
    refreshBadge();
  };

  // ── Corbeille ──────────────────────────────────────────────────────────
  const dropFromTrash = (kind: "conversation" | "message", id: string) =>
    setTrash((prev) => ({
      conversations: kind === "conversation" ? prev.conversations.filter((c) => c.id !== id) : prev.conversations,
      messages: kind === "message" ? prev.messages.filter((m) => m.id !== id) : prev.messages,
    }));

  const restoreFromTrash = async (kind: "conversation" | "message", id: string) => {
    try {
      if (kind === "conversation") await conversationService.restoreConversation(id);
      else await conversationService.restoreMessage(id);
      dropFromTrash(kind, id);
      load(true);
      loadTrash();
      refreshBadge();
    } catch (e) {
      Alert.alert(translate("common.error"), e instanceof Error ? e.message : translate("chat.errors.restore"));
    }
  };

  const purgeFromTrash = (kind: "conversation" | "message", id: string) => {
    Alert.alert(
      kind === "conversation" ? translate("chat.trash.purgeChatTitle") : translate("chat.trash.purgeMessageTitle"),
      translate("chat.trash.purgeConfirm"),
      [
        { text: translate("common.cancel"), style: "cancel" },
        {
          text: translate("chat.trash.purge"),
          style: "destructive",
          onPress: async () => {
            try {
              if (kind === "conversation") await conversationService.purgeConversation(id);
              else await conversationService.purgeMessage(id);
              dropFromTrash(kind, id);
              loadTrash();
            } catch (e) {
              Alert.alert(translate("common.error"), e instanceof Error ? e.message : translate("chat.errors.delete"));
            }
          },
        },
      ]
    );
  };

  const emptyTrash = () => {
    Alert.alert(translate("chat.trash.emptyTitle"), translate("chat.trash.emptyConfirm"), [
      { text: translate("common.cancel"), style: "cancel" },
      {
        text: translate("chat.trash.empty"),
        style: "destructive",
        onPress: async () => {
          try {
            await conversationService.emptyTrash();
            setTrash({ conversations: [], messages: [] });
            loadTrash();
          } catch (e) {
            Alert.alert(translate("common.error"), e instanceof Error ? e.message : translate("chat.errors.delete"));
          }
        },
      },
    ]);
  };

  const toggleMute = async (c: Conversation) => {
    try {
      await conversationService.setMuted(c.id, !c.muted);
      patchConversation(c.id, (x) => ({ ...x, muted: !c.muted }));
    } catch (e) {
      Alert.alert(translate("common.error"), e instanceof Error ? e.message : translate("chat.errors.generic"));
    }
  };

  const footerClearance = Math.max(insets.bottom, 12) + FOOTER_NAV_HEIGHT;
  const open = useMemo(
    () => (openId ? conversations.find((c) => c.id === openId) ?? openFallback : null),
    [openId, conversations, openFallback]
  );

  if (open) {
    return (
      <ChatView
        conversation={open}
        userId={userId}
        me={{ prenom: user?.prenom as string | undefined, nom: user?.nom as string | undefined }}
        bottomClearance={footerClearance}
        onBack={closeConversation}
        onRead={onRead}
        onSent={applyMessageToList}
        onConversationChange={(c) => patchConversation(c.id, () => c)}
        onHidden={(id) => {
          setConversations((prev) => prev.filter((x) => x.id !== id));
          closeConversation();
          refreshBadge();
          loadTrash();
        }}
        onMarkUnread={markUnread}
      />
    );
  }

  return (
    <>
      <ConversationList
        conversations={conversations}
        userId={userId}
        loading={loading}
        error={error}
        refreshing={refreshing}
        bottomClearance={footerClearance}
        onBack={onBack}
        onRefresh={handleRefresh}
        onRetry={() => load()}
        onOpen={openConversation}
        onLongPress={setMenuFor}
        onNew={() => setShowNew(true)}
        filter={filter}
        onFilterChange={setFilter}
        trash={trash}
        trashLoading={trashLoading}
        onTrashItemPress={(kind, item) =>
          setTrashMenu(
            kind === "conversation"
              ? { kind, item: item as Conversation }
              : { kind: "message", item: item as ChatMessage }
          )
        }
        onEmptyTrash={emptyTrash}
      />
      {showNew && <ComposeMessageModal onClose={() => setShowNew(false)} onSend={handleComposeSent} />}
      {menuFor && (
        <ChatActionSheet
          title={conversationTitle(menuFor, userId)}
          onClose={() => setMenuFor(null)}
          actions={[
            isUnreadConversation(menuFor)
              ? { key: "read", label: translate("chat.markRead"), icon: "envelope-open", onPress: () => markRead(menuFor) }
              : { key: "unread", label: translate("chat.markUnread"), icon: "envelope", onPress: () => markUnread(menuFor) },
            {
              key: "favorite",
              label: menuFor.favori ? translate("chat.removeFavorite") : translate("chat.addFavorite"),
              icon: "star",
              onPress: () => toggleFavorite(menuFor),
            },
            {
              key: "mute",
              label: menuFor.muted ? translate("chat.unmute") : translate("chat.mute"),
              icon: menuFor.muted ? "bell" : "bell-slash",
              onPress: () => toggleMute(menuFor),
            },
            {
              key: "hide",
              label: translate("chat.deleteChat"),
              icon: "trash-alt",
              destructive: true,
              onPress: () => {
                const target = menuFor;
                Alert.alert(translate("chat.deleteChat"), translate("chat.deleteChatConfirm"), [
                  { text: translate("common.cancel"), style: "cancel" },
                  { text: translate("common.delete"), style: "destructive", onPress: () => hideConversation(target) },
                ]);
              },
            },
          ]}
        />
      )}
      {trashMenu && (
        <ChatActionSheet
          title={
            trashMenu.kind === "conversation"
              ? conversationTitle(trashMenu.item, userId)
              : (trashMenu.item.contenu ?? "").replace(/\s+/g, " ").trim().slice(0, 100) ||
                mediaSummary(trashMenu.item.medias) ||
                translate("chat.attachment")
          }
          onClose={() => setTrashMenu(null)}
          actions={[
            {
              key: "restore",
              label: translate("chat.trash.restore"),
              icon: "undo",
              onPress: () => restoreFromTrash(trashMenu.kind, trashMenu.item.id),
            },
            {
              key: "purge",
              label: translate("chat.trash.purge"),
              icon: "trash-alt",
              destructive: true,
              onPress: () => purgeFromTrash(trashMenu.kind, trashMenu.item.id),
            },
          ]}
        />
      )}
    </>
  );
};

export default DashboardMessagesBody;
