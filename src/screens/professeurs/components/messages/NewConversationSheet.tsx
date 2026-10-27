import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FontAwesome5 } from "@expo/vector-icons";
import { useThemeColors } from "../../../../styles/theme";
import { useT } from "../../../../i18n";
import { messageService } from "../../../../services/messageService";
import { Conversation, conversationService } from "../../../../services/conversationService";
import { MessageContact } from "../../../../types";
import { ChatAvatar } from "./ConversationList";
import { participantInitials, participantName } from "./chatHelpers";
import { contactMatches, getRoleLabel } from "./messageHelpers";

type ThemeColors = ReturnType<typeof useThemeColors>;

interface Props {
  onClose: () => void;
  onCreated: (c: Conversation) => void;
}

/**
 * "Nouvelle discussion": pick one contact (find-or-create the DIRECT chat) or several
 * (new group, optional title). Contacts = GET /messages/contacts (who the caller may write to).
 */
const NewConversationSheet = ({ onClose, onCreated }: Props) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const insets = useSafeAreaInsets();

  const [contacts, setContacts] = useState<MessageContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [titre, setTitre] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let alive = true;
    messageService
      .getContacts()
      .then((list) => alive && setContacts(list))
      .catch((e) => alive && setError(e instanceof Error ? e.message : t("chat.errors.load")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(
    () => (search.trim() ? contacts.filter((c) => contactMatches(c, search)) : contacts),
    [contacts, search]
  );

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const create = async (ids: string[]) => {
    if (ids.length === 0 || creating) return;
    setCreating(true);
    try {
      const conv = await conversationService.create(ids, ids.length > 1 ? titre : undefined);
      onCreated(conv);
    } catch (e) {
      Alert.alert(t("common.error"), e instanceof Error ? e.message : t("chat.errors.create"));
    } finally {
      setCreating(false);
    }
  };

  const isGroup = selected.length > 1;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn} accessibilityLabel={t("common.back")}>
            <FontAwesome5 name="arrow-left" size={18} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t("chat.newChatSheet.title")}</Text>
            {selected.length > 0 ? (
              <Text style={styles.subtitle}>{t("chat.newChatSheet.selected", { count: selected.length })}</Text>
            ) : null}
          </View>
          {selected.length > 0 ? (
            <TouchableOpacity
              style={[styles.action, creating && { opacity: 0.6 }]}
              onPress={() => create(selected)}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.actionText}>
                  {isGroup ? t("chat.newChatSheet.createGroup") : t("chat.newChatSheet.start")}
                </Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>

        {isGroup ? (
          <TextInput
            style={styles.titleInput}
            placeholder={t("chat.newChatSheet.groupTitle")}
            placeholderTextColor={colors.textLight}
            value={titre}
            onChangeText={setTitre}
            maxLength={120}
          />
        ) : (
          <Text style={styles.hint}>{t("chat.newChatSheet.groupHint")}</Text>
        )}

        <View style={styles.searchBox}>
          <FontAwesome5 name="search" size={13} color={colors.textLight} style={{ marginRight: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder={t("chat.newChatSheet.searchContacts")}
            placeholderTextColor={colors.textLight}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.muted}>{t("chat.newChatSheet.loadingContacts")}</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={[styles.muted, { color: colors.danger }]}>{error}</Text>
          </View>
        ) : (
          <FlatList
            data={visible}
            keyExtractor={(c) => c.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.muted}>{search ? t("chat.noResults") : t("chat.newChatSheet.noContacts")}</Text>
              </View>
            }
            renderItem={({ item }) => {
              const checked = selected.includes(item.id);
              return (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => toggle(item.id)}
                  onLongPress={() => create([item.id])}
                  activeOpacity={0.7}
                >
                  <ChatAvatar label={participantInitials(item)} seed={item.id} size={44} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.name} numberOfLines={1}>
                      {participantName(item)}
                    </Text>
                    {getRoleLabel(item) ? <Text style={styles.role}>{getRoleLabel(item)}</Text> : null}
                  </View>
                  <View style={[styles.check, checked && styles.checkOn]}>
                    {checked ? <FontAwesome5 name="check" size={11} color={colors.white} /> : null}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
};

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 10,
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    iconBtn: { padding: 10 },
    title: { fontSize: 17, fontWeight: "800", color: c.text },
    subtitle: { fontSize: 12, color: c.textMuted },
    action: { backgroundColor: c.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, marginRight: 6 },
    actionText: { color: c.white, fontWeight: "800", fontSize: 13 },
    hint: { fontSize: 12, color: c.textMuted, marginHorizontal: 16, marginTop: 10 },
    titleInput: {
      marginHorizontal: 16,
      marginTop: 10,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === "ios" ? 11 : 7,
      color: c.text,
      fontSize: 14,
    },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      margin: 16,
      marginBottom: 6,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === "ios" ? 10 : 3,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
    },
    searchInput: { flex: 1, fontSize: 14, color: c.text },
    row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10 },
    name: { fontSize: 15, fontWeight: "600", color: c.text },
    role: { fontSize: 12, color: c.textMuted, marginTop: 1 },
    check: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    checkOn: { backgroundColor: c.primary, borderColor: c.primary },
    center: { alignItems: "center", padding: 32, gap: 8 },
    muted: { color: c.textMuted, fontSize: 13, textAlign: "center" },
  });

export default NewConversationSheet;
