import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useThemeColors } from "../../../../styles/theme";
import { useT } from "../../../../i18n";
import { ChatMessage, ChatTrash, Conversation } from "../../../../services/conversationService";
import {
  CONVERSATION_FILTERS,
  ConversationFilter,
  avatarColor,
  conversationBadgeKey,
  conversationInitials,
  conversationMatchesFilter,
  conversationPreview,
  conversationTitle,
  isFavoriteConversation,
  isUnreadConversation,
  listTime,
  mediaSummary,
  otherParticipants,
  participantName,
} from "./chatHelpers";
import { normalizeSearch } from "./messageHelpers";

type ThemeColors = ReturnType<typeof useThemeColors>;

interface Props {
  conversations: Conversation[];
  userId?: string;
  loading: boolean;
  error: string;
  refreshing: boolean;
  bottomClearance: number;
  onBack?: () => void;
  onRefresh: () => void;
  onRetry: () => void;
  onOpen: (c: Conversation) => void;
  onLongPress: (c: Conversation) => void;
  onNew: () => void;
  filter: ConversationFilter;
  onFilterChange: (f: ConversationFilter) => void;
  trash: ChatTrash;
  trashLoading: boolean;
  /** Tap on a trash item: restore / delete permanently. */
  onTrashItemPress: (kind: "conversation" | "message", item: Conversation | ChatMessage) => void;
  onEmptyTrash: () => void;
}

type TrashRow =
  | { kind: "conversation"; id: string; date?: string | null; item: Conversation }
  | { kind: "message"; id: string; date?: string | null; item: ChatMessage };

const EMPTY_KEYS: Record<Exclude<ConversationFilter, "trash">, Parameters<ReturnType<typeof useT>["t"]>[0]> = {
  all: "chat.empty",
  unread: "chat.emptyFilters.unread",
  favorites: "chat.emptyFilters.favorites",
  general: "chat.emptyFilters.general",
  sent: "chat.emptyFilters.sent",
};

export const ChatAvatar = ({
  label,
  seed,
  group,
  classe,
  size = 50,
}: {
  label: string;
  seed?: string | null;
  group?: boolean;
  /** Class conversation (GROUPE with classeId): chalkboard icon instead of initials. */
  classe?: boolean;
  size?: number;
}) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: avatarColor(seed),
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    {classe ? (
      <FontAwesome5 name="chalkboard-teacher" size={size * 0.34} color="#fff" />
    ) : group && label === "#" ? (
      <FontAwesome5 name="users" size={size * 0.36} color="#fff" />
    ) : (
      <Text style={{ color: "#fff", fontWeight: "800", fontSize: size * 0.36 }}>{label}</Text>
    )}
  </View>
);

const ConversationList = ({
  conversations,
  userId,
  loading,
  error,
  refreshing,
  bottomClearance,
  onBack,
  onRefresh,
  onRetry,
  onOpen,
  onLongPress,
  onNew,
  filter,
  onFilterChange,
  trash,
  trashLoading,
  onTrashItemPress,
  onEmptyTrash,
}: Props) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const [search, setSearch] = useState("");

  const counts = useMemo(() => {
    const r: Record<ConversationFilter, number> = {
      all: 0,
      unread: 0,
      favorites: 0,
      general: 0,
      sent: 0,
      trash: 0,
    };
    // Chip badges count only conversations with unread messages (never totals); no badge on the trash.
    (["all", "unread", "favorites", "general", "sent"] as const).forEach((f) => {
      r[f] = conversations.filter((c) => isUnreadConversation(c) && conversationMatchesFilter(c, f, userId)).length;
    });
    return r;
  }, [conversations, userId]);
  const trashCount = trash.conversations.length + trash.messages.length;

  const filtered = useMemo(() => {
    const q = normalizeSearch(search);
    return conversations.filter(
      (c) =>
        conversationMatchesFilter(c, filter, userId) &&
        (!q ||
          normalizeSearch(conversationTitle(c, userId)).includes(q) ||
          otherParticipants(c, userId).some((p) => normalizeSearch(participantName(p)).includes(q)) ||
          normalizeSearch(c.dernierMessage?.contenu).includes(q))
    );
  }, [conversations, search, userId, filter]);

  const trashRows = useMemo<TrashRow[]>(() => {
    const q = normalizeSearch(search);
    const rows: TrashRow[] = [
      ...trash.conversations.map((c) => ({ kind: "conversation" as const, id: c.id, date: c.supprimeLe, item: c })),
      ...trash.messages.map((m) => ({ kind: "message" as const, id: m.id, date: m.supprimeLe ?? m.date, item: m })),
    ];
    const text = (r: TrashRow) =>
      r.kind === "conversation"
        ? `${conversationTitle(r.item, userId)} ${r.item.dernierMessage?.contenu ?? ""}`
        : `${r.item.conversationTitre ?? ""} ${r.item.contenu ?? ""}`;
    return rows
      .filter((r) => !q || normalizeSearch(text(r)).includes(q))
      .sort((a, b) => (Date.parse(b.date ?? "") || 0) - (Date.parse(a.date ?? "") || 0));
  }, [trash, search, userId]);

  const renderTrashItem = ({ item: row }: { item: TrashRow }) => {
    let title: string;
    let detail: string;
    let body: string;
    if (row.kind === "conversation") {
      const c = row.item;
      title = conversationTitle(c, userId);
      detail = c.reapparue ? t("chat.trash.olderHistory") : t("chat.trash.deletedChat");
      body = c.dernierMessage ? conversationPreview(c, userId) : "";
    } else {
      const m = row.item;
      title = m.conversationTitre || t("chat.title");
      const sender = m.expediteurId === userId ? t("chat.you") : participantName({ prenom: m.expediteurPrenom, nom: m.expediteurNom });
      detail = t("chat.trash.messageFrom", { name: sender }) + (m.supprimePourTous ? ` · ${t("chat.trash.deletedForAll")}` : "");
      body = (m.contenu ?? "").replace(/\s+/g, " ").trim() || mediaSummary(m.medias) || t("chat.attachment");
    }
    return (
      <TouchableOpacity style={styles.row} onPress={() => onTrashItemPress(row.kind, row.item)} activeOpacity={0.7}>
        {row.kind === "conversation" ? (
          <ChatAvatar
            label={conversationInitials(row.item, userId)}
            seed={row.item.id}
            group={row.item.type === "GROUPE"}
            classe={row.item.type === "GROUPE" && !!row.item.classeId}
            size={44}
          />
        ) : (
          <View style={styles.trashMsgIcon}>
            <FontAwesome5 name="comment" size={18} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={styles.name} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.time}>{listTime(row.date)}</Text>
          </View>
          <Text style={styles.trashDetail} numberOfLines={1}>
            {detail}
          </Text>
          {body ? (
            <Text style={styles.preview} numberOfLines={1}>
              {body}
            </Text>
          ) : null}
        </View>
        <FontAwesome5 name="ellipsis-v" size={14} color={colors.textLight} style={{ marginLeft: 10 }} />
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: Conversation }) => {
    const unread = isUnreadConversation(item);
    const title = conversationTitle(item, userId);
    const badgeKey = conversationBadgeKey(item);
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => onOpen(item)}
        onLongPress={() => onLongPress(item)}
        activeOpacity={0.7}
      >
        <ChatAvatar
          label={conversationInitials(item, userId)}
          seed={item.id}
          group={item.type === "GROUPE"}
          classe={item.type === "GROUPE" && !!item.classeId}
        />
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={[styles.name, unread && styles.nameUnread]} numberOfLines={1}>
              {title}
            </Text>
            {badgeKey ? (
              <View style={styles.classBadge}>
                <Text style={styles.classBadgeText}>{t(badgeKey)}</Text>
              </View>
            ) : null}
            <Text style={[styles.time, unread && { color: colors.primary, fontWeight: "700" }]}>
              {listTime(item.dernierMessage?.date ?? item.lastMessageAt)}
            </Text>
          </View>
          <View style={styles.rowBottom}>
            {item.type === "GROUPE" ? (
              <FontAwesome5 name="users" size={10} color={colors.textLight} style={{ marginRight: 5 }} />
            ) : null}
            <Text
              style={[styles.preview, unread && styles.previewUnread, item.dernierMessage?.supprime && styles.previewDeleted]}
              numberOfLines={1}
            >
              {conversationPreview(item, userId)}
            </Text>
            {isFavoriteConversation(item) ? (
              <FontAwesome5
                name="star"
                solid
                size={10}
                color={item.favori ? "#f59e0b" : colors.textLight}
                style={{ marginLeft: 6 }}
              />
            ) : null}
            {item.muted ? <FontAwesome5 name="bell-slash" size={11} color={colors.textLight} style={{ marginLeft: 6 }} /> : null}
            {unread ? (
              <View style={[styles.badge, item.nonLus <= 0 && styles.badgeDot]}>
                <Text style={styles.badgeText}>{item.nonLus > 0 ? (item.nonLus > 99 ? "99+" : item.nonLus) : ""}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity style={styles.back} onPress={onBack} accessibilityLabel={t("common.back")}>
            <FontAwesome5 name="arrow-left" size={18} color={colors.primary} />
          </TouchableOpacity>
        ) : null}
        <Text style={styles.headerTitle}>{t("chat.title")}</Text>
        <TouchableOpacity onPress={onRefresh} disabled={loading} style={styles.refresh} accessibilityLabel={t("chat.refresh")}>
          <FontAwesome5 name="sync-alt" size={15} color={colors.textMuted} style={loading ? { opacity: 0.4 } : undefined} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <FontAwesome5 name="search" size={14} color={colors.textLight} style={{ marginRight: 10 }} />
        <TextInput
          style={styles.searchInput}
          placeholder={t("chat.search")}
          placeholderTextColor={colors.textLight}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
            <FontAwesome5 name="times-circle" size={14} color={colors.textLight} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chips}
        keyboardShouldPersistTaps="handled"
      >
        {CONVERSATION_FILTERS.map((f) => {
          const active = filter === f.id;
          const count = counts[f.id];
          return (
            <TouchableOpacity
              key={f.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onFilterChange(f.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              {f.id === "trash" ? (
                <FontAwesome5 name="trash-alt" size={11} color={active ? colors.white : colors.textMuted} style={{ marginRight: 6 }} />
              ) : null}
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(f.labelKey)}</Text>
              {count > 0 ? (
                <View style={[styles.chipCount, active && styles.chipCountActive]}>
                  <Text style={[styles.chipCountText, active && styles.chipTextActive]}>{count > 99 ? "99+" : count}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {filter === "trash" ? (
        <>
          <View style={styles.trashBar}>
            <Text style={styles.trashHint} numberOfLines={2}>
              {t("chat.trash.hint")}
            </Text>
            <TouchableOpacity
              style={[styles.emptyTrashBtn, trashCount === 0 && { opacity: 0.4 }]}
              onPress={onEmptyTrash}
              disabled={trashCount === 0}
            >
              <FontAwesome5 name="trash-alt" size={12} color={colors.white} style={{ marginRight: 6 }} />
              <Text style={styles.emptyTrashText}>{t("chat.trash.empty")}</Text>
            </TouchableOpacity>
          </View>
          {trashLoading && trashCount === 0 ? (
            <View style={styles.empty}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={trashRows}
              keyExtractor={(r) => `${r.kind}-${r.id}`}
              renderItem={renderTrashItem}
              contentContainerStyle={{ paddingBottom: bottomClearance + 90 }}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <View style={styles.emptyIcon}>
                    <FontAwesome5 name="trash-alt" size={30} color={colors.textLight} />
                  </View>
                  <Text style={styles.emptyTitle}>{search ? t("chat.noResults") : t("chat.trash.isEmpty")}</Text>
                </View>
              }
            />
          )}
        </>
      ) : error && conversations.length === 0 ? (
        <View style={styles.empty}>
          <FontAwesome5 name="exclamation-circle" size={38} color={colors.danger} />
          <Text style={[styles.emptyTitle, { color: colors.danger }]}>{error}</Text>
          <TouchableOpacity onPress={onRetry} style={styles.retry}>
            <Text style={styles.retryText}>{t("chat.retry")}</Text>
          </TouchableOpacity>
        </View>
      ) : loading && conversations.length === 0 ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.emptySub}>{t("chat.loading")}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: bottomClearance + 90 }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <FontAwesome5 name={search ? "search" : "comments"} size={30} color={colors.textLight} />
              </View>
              <Text style={styles.emptyTitle}>{search ? t("chat.noResults") : t(EMPTY_KEYS[filter as Exclude<ConversationFilter, "trash">] ?? "chat.empty")}</Text>
              {!search && filter === "all" ? <Text style={styles.emptySub}>{t("chat.emptySub")}</Text> : null}
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { bottom: bottomClearance + 20 }]}
        onPress={onNew}
        accessibilityLabel={t("chat.newChat")}
      >
        <FontAwesome5 name="comment-medical" size={20} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
    back: { marginRight: 12, padding: 4 },
    headerTitle: { flex: 1, fontSize: 22, fontWeight: "800", color: c.text },
    refresh: { padding: 9, backgroundColor: c.surface, borderRadius: 10, borderWidth: 1, borderColor: c.border },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      marginHorizontal: 16,
      marginBottom: 8,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === "ios" ? 11 : 4,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
    },
    searchInput: { flex: 1, fontSize: 14, color: c.text },
    row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 11, backgroundColor: c.background },
    rowBody: { flex: 1, minWidth: 0, marginLeft: 12 },
    rowTop: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
    name: { flex: 1, fontSize: 15, fontWeight: "600", color: c.text, marginRight: 8 },
    nameUnread: { fontWeight: "800" },
    classBadge: { backgroundColor: c.primary + "1A", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, marginRight: 8 },
    classBadgeText: { fontSize: 10, fontWeight: "700", color: c.primary },
    time: { fontSize: 11, color: c.textLight },
    rowBottom: { flexDirection: "row", alignItems: "center", marginTop: 3 },
    preview: { flex: 1, fontSize: 13, color: c.textMuted },
    previewUnread: { color: c.text, fontWeight: "600" },
    previewDeleted: { fontStyle: "italic" },
    badge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 6,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 8,
    },
    badgeText: { color: c.white, fontSize: 11, fontWeight: "800" },
    badgeDot: { minWidth: 12, width: 12, height: 12, borderRadius: 6, paddingHorizontal: 0 },
    chipsScroll: { flexGrow: 0, flexShrink: 0 },
    chips: { paddingHorizontal: 16, paddingBottom: 8, gap: 8, flexDirection: "row", alignItems: "center" },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 13,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { fontSize: 13, fontWeight: "600", color: c.textMuted },
    chipTextActive: { color: c.white },
    chipCount: {
      marginLeft: 6,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 5,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.surfaceElevated,
    },
    chipCountActive: { backgroundColor: "rgba(255,255,255,0.25)" },
    chipCountText: { fontSize: 11, fontWeight: "700", color: c.textMuted },
    trashBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
    trashHint: { flex: 1, fontSize: 11, color: c.textMuted },
    emptyTrashBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.danger,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
    },
    emptyTrashText: { color: c.white, fontSize: 12, fontWeight: "700" },
    trashDetail: { fontSize: 11, color: c.textLight, marginTop: 2 },
    trashMsgIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
    },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: 78 },
    empty: { alignItems: "center", paddingVertical: 56, paddingHorizontal: 24 },
    emptyIcon: { padding: 22, borderRadius: 999, backgroundColor: c.surfaceElevated, marginBottom: 4 },
    emptyTitle: { fontSize: 15, fontWeight: "700", color: c.text, marginTop: 12, textAlign: "center" },
    emptySub: { fontSize: 12, color: c.textMuted, marginTop: 4, textAlign: "center" },
    retry: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: c.primaryLight },
    retryText: { color: c.primaryDark, fontWeight: "700" },
    fab: {
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
  });

export default ConversationList;
