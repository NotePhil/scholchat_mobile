import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
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
import AttachmentModal, { AttachmentType } from "./AttachmentModal";
import PromptSheet from "../../../../components/common/PromptSheet";
import { messageService } from "../../../../services/messageService";
import { useUser } from "../../../../context/UserContext";
import { useThemeColors } from "../../../../styles/theme";
import { MessageContact, MessageContactClass } from "../../../../types";
import { contactMatches, getInitials, getRoleLabel, toUtilisateurPayload } from "./messageHelpers";
import { PendingAttachmentsBar, useMessageAttachments } from "./messageMedia";

type ThemeColors = ReturnType<typeof useThemeColors>;

interface Recipient {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: string;
}

interface ComposeMessageModalProps {
  onClose: () => void;
  onSend: () => void;
}

const toRecipient = (u: MessageContact): Recipient => ({
  id: u.id,
  nom: u.nom || "",
  prenom: u.prenom || "",
  email: u.email || "",
  role: getRoleLabel(u),
});

const recipientName = (r: Recipient) => `${r.prenom} ${r.nom}`.trim() || r.email || "Utilisateur";

const dedupeById = <T extends { id: string }>(items: T[]) => {
  const seen = new Set<string>();
  return items.filter((i) => i?.id && !seen.has(i.id) && seen.add(i.id));
};

/** Autocomplete results: nothing until the user types; already-picked people excluded. */
const filterSuggestions = (contacts: Recipient[], query: string, excluded: Set<string>) =>
  query.trim() ? contacts.filter((m) => !excluded.has(m.id) && contactMatches(m, query)).slice(0, 30) : [];

/**
 * New message. Who can be messaged comes straight from the server
 * (GET /messages/contacts for individual recipients, GET /messages/contacts/classes
 * for group messages) — the server enforces the same rule on send (403).
 * Photos/videos/documents upload as soon as they're picked and go out as `medias`.
 */
const ComposeMessageModal = ({ onClose, onSend }: ComposeMessageModalProps) => {
  const { user } = useUser();
  const userId = (user?.userId ?? user?.id) as string | undefined;
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [contacts, setContacts] = useState<Recipient[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsError, setContactsError] = useState("");

  const [availableClasses, setAvailableClasses] = useState<MessageContactClass[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState("");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [showClassDropdown, setShowClassDropdown] = useState(false);

  const [isGroupMessage, setIsGroupMessage] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [ccRecipients, setCcRecipients] = useState<Recipient[]>([]);
  const [activeField, setActiveField] = useState<"to" | "cc" | null>(null);
  const [toQuery, setToQuery] = useState("");
  const [ccQuery, setCcQuery] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const fieldY = useRef<{ to: number; cc: number }>({ to: 0, cc: 0 });

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [showLinkPrompt, setShowLinkPrompt] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const attachments = useMessageAttachments(userId);
  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start();
  }, [slideAnim]);

  useEffect(() => {
    let cancelled = false;
    messageService
      .getContacts()
      .then((list) => {
        if (cancelled) return;
        setContacts(
          dedupeById(list.filter((u) => u?.id && u.id !== userId).map(toRecipient)).sort((a, b) =>
            recipientName(a).localeCompare(recipientName(b), "fr")
          )
        );
      })
      .catch((err) => !cancelled && setContactsError(err instanceof Error ? err.message : "Impossible de charger les contacts."))
      .finally(() => !cancelled && setContactsLoading(false));
    messageService
      .getContactClasses()
      .then((list) => !cancelled && setAvailableClasses(dedupeById(list)))
      .catch((err) => !cancelled && setClassesError(err instanceof Error ? err.message : "Impossible de charger les classes."))
      .finally(() => !cancelled && setClassesLoading(false));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const toggleClass = (id: string) =>
    setSelectedClassIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  /** Contacts matching the typed query, minus anyone already in À or CC. */
  const selectedIds = useMemo(
    () => new Set([...recipients, ...ccRecipients].map((r) => r.id)),
    [recipients, ccRecipients]
  );
  const toSuggestions = useMemo(() => filterSuggestions(contacts, toQuery, selectedIds), [contacts, toQuery, selectedIds]);
  const ccSuggestions = useMemo(() => filterSuggestions(contacts, ccQuery, selectedIds), [contacts, ccQuery, selectedIds]);

  const addRecipient = (target: "to" | "cc", person: Recipient) => {
    const setter = target === "cc" ? setCcRecipients : setRecipients;
    setter((prev) => (prev.some((p) => p.id === person.id) ? prev : [...prev, person]));
    if (target === "cc") setCcQuery("");
    else setToQuery("");
  };

  /** Keep the field (and its suggestion list) in the visible area above the keyboard. */
  const scrollToField = (target: "to" | "cc") => {
    const y = Math.max(fieldY.current[target] - 8, 0);
    setTimeout(() => scrollRef.current?.scrollTo({ y, animated: true }), 120);
  };

  const handleAttach = async (type: AttachmentType) => {
    setShowAttachmentModal(false);
    if (type === "link") {
      setShowLinkPrompt(true);
      return;
    }
    try {
      if (type === "media") await attachments.pickMedia();
      else await attachments.pickDocument();
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Impossible d'ajouter la pièce jointe.");
    }
  };

  /** Plain-text body; links are appended (rendered as tappable links in the thread). */
  const buildBody = () => {
    let body = message.trim();
    if (links.length > 0) body = `${body}${body ? "\n\n" : ""}${links.join("\n")}`;
    return body;
  };

  const animateOut = (after: () => void) => {
    Animated.timing(slideAnim, { toValue: 600, duration: 250, useNativeDriver: true }).start(() => after());
  };

  const handleSend = async () => {
    if (!userId) {
      Alert.alert("Erreur", "Utilisateur non identifié.");
      return;
    }
    if (isGroupMessage && selectedClassIds.length === 0) {
      Alert.alert("Champs manquants", "Sélectionnez au moins une classe.");
      return;
    }
    if (!isGroupMessage && recipients.length === 0) {
      Alert.alert("Champs manquants", "Sélectionnez au moins un destinataire.");
      return;
    }
    if (attachments.isUploading) {
      Alert.alert("Patientez", "Les pièces jointes sont en cours de téléversement.");
      return;
    }
    if (attachments.hasErrors) {
      Alert.alert("Pièces jointes", "Certaines pièces jointes n'ont pas pu être téléversées. Retirez-les ou réessayez.");
      return;
    }
    const body = buildBody();
    const medias = attachments.toPayload();
    if (!body && medias.length === 0) {
      Alert.alert("Champs manquants", "Écrivez un message ou joignez un fichier.");
      return;
    }

    setIsSending(true);
    try {
      if (isGroupMessage) {
        await messageService.sendGroupMessage({
          classIds: selectedClassIds,
          objet: subject.trim() || undefined,
          content: body,
          copieRecipientIds: ccRecipients.map((cc) => cc.id),
          medias: medias.length ? medias : undefined,
        });
      } else {
        await messageService.sendIndividualMessage({
          objet: subject.trim() || undefined,
          contenu: body,
          destinataires: dedupeById([...recipients, ...ccRecipients]).map((r) => toUtilisateurPayload(r)),
          medias: medias.length ? medias : undefined,
        });
      }
      animateOut(onSend);
    } catch (error) {
      Alert.alert("Erreur", error instanceof Error ? error.message : "Impossible d'envoyer le message.");
    } finally {
      setIsSending(false);
    }
  };

  const renderChips = (list: Recipient[], onRemove: (id: string) => void) =>
    list.length > 0 ? (
      <View style={styles.chipsRow}>
        {list.map((r) => (
          <View key={r.id} style={styles.chip}>
            <Text style={styles.chipText} numberOfLines={1}>
              {recipientName(r)}
            </Text>
            <TouchableOpacity onPress={() => onRemove(r.id)} hitSlop={8}>
              <FontAwesome5 name="times" size={11} color={colors.primary} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    ) : null;

  const renderAutocomplete = (target: "to" | "cc") => {
    const query = target === "cc" ? ccQuery : toQuery;
    const setQuery = target === "cc" ? setCcQuery : setToQuery;
    const picked = target === "cc" ? ccRecipients : recipients;
    const suggestions = target === "cc" ? ccSuggestions : toSuggestions;
    const showList = activeField === target && query.trim().length > 0;
    return (
      <View onLayout={(e) => (fieldY.current[target] = e.nativeEvent.layout.y)}>
        <Text style={styles.inputLabel}>{target === "cc" ? "Copie (CC)" : "À *"}</Text>
        {renderChips(picked, (id) =>
          (target === "cc" ? setCcRecipients : setRecipients)((p) => p.filter((r) => r.id !== id))
        )}
        <View style={[styles.selector, activeField === target && styles.selectorFocused]}>
          <FontAwesome5 name="search" size={13} color={colors.textLight} />
          <TextInput
            style={styles.autoInput}
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              if (text.trim()) scrollToField(target);
            }}
            onFocus={() => {
              setActiveField(target);
              scrollToField(target);
            }}
            // Deferred so a tap on a suggestion still lands if the input blurs first.
            onBlur={() => setTimeout(() => setActiveField((prev) => (prev === target ? null : prev)), 150)}
            onSubmitEditing={() => suggestions[0] && addRecipient(target, suggestions[0])}
            blurOnSubmit={false}
            placeholder={
              contactsLoading
                ? "Chargement des contacts..."
                : target === "cc"
                  ? "Ajouter en copie : nom ou e-mail"
                  : "Tapez un nom ou un e-mail"
            }
            placeholderTextColor={colors.textLight}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            accessibilityLabel={target === "cc" ? "Rechercher un contact en copie" : "Rechercher un destinataire"}
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={8} accessibilityLabel="Effacer">
              <FontAwesome5 name="times-circle" size={14} color={colors.textLight} solid />
            </TouchableOpacity>
          ) : null}
        </View>
        {activeField === target && contactsError ? (
          <Text style={[styles.pickerEmpty, { color: colors.danger }]}>{contactsError}</Text>
        ) : null}
        {showList && !contactsError ? (
          <View style={styles.pickerBox}>
            {contactsLoading ? (
              <ActivityIndicator color={colors.primary} style={{ paddingVertical: 16 }} />
            ) : suggestions.length === 0 ? (
              <Text style={styles.pickerEmpty}>Aucun contact trouvé</Text>
            ) : (
              <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled keyboardShouldPersistTaps="always">
                {suggestions.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={styles.pickerItem}
                    onPress={() => addRecipient(target, m)}
                    accessibilityLabel={`Ajouter ${recipientName(m)}`}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{getInitials(m)}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.pickerName} numberOfLines={1}>
                        {recipientName(m)}
                      </Text>
                      {m.email ? (
                        <Text style={styles.pickerSub} numberOfLines={1}>
                          {m.email}
                        </Text>
                      ) : null}
                    </View>
                    {m.role ? (
                      <View style={styles.roleBadge}>
                        <Text style={styles.roleBadgeText}>{m.role}</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        ) : null}
      </View>
    );
  };

  const sendDisabled = isSending || attachments.isUploading;

  return (
    <Modal transparent visible animationType="none" onRequestClose={() => animateOut(onClose)}>
      <View style={styles.modalOverlay}>
        <Animated.View style={[styles.composeModal, { transform: [{ translateY: slideAnim }] }]}>
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.composeHeader}>
              <Text style={styles.composeTitle}>Nouveau message</Text>
              <TouchableOpacity onPress={() => animateOut(onClose)} hitSlop={10} accessibilityLabel="Fermer">
                <FontAwesome5 name="times" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={scrollRef}
              style={styles.flex}
              contentContainerStyle={styles.composeForm}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="none"
            >
              {/* Group toggle */}
              <TouchableOpacity
                style={[styles.groupToggle, { marginTop: 0 }, isGroupMessage && styles.groupToggleActive]}
                onPress={() => {
                  setIsGroupMessage((v) => !v);
                  setRecipients([]);
                  setToQuery("");
                }}
              >
                <View style={[styles.checkbox, isGroupMessage && styles.checkboxChecked]}>
                  {isGroupMessage && <FontAwesome5 name="check" size={10} color={colors.white} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.groupToggleTitle}>Message général</Text>
                  <Text style={styles.groupToggleSub}>Envoyé à tous les membres des classes sélectionnées</Text>
                </View>
                <FontAwesome5 name="users" size={14} color={isGroupMessage ? colors.primary : colors.textLight} />
              </TouchableOpacity>

              {isGroupMessage ? (
                <>
                  {/* Classes */}
                  <Text style={styles.inputLabel}>Classes *</Text>
                  <TouchableOpacity style={styles.selector} onPress={() => setShowClassDropdown((v) => !v)}>
                    <Text style={[styles.selectorText, selectedClassIds.length > 0 && { color: colors.text }]} numberOfLines={1}>
                      {selectedClassIds.length > 0
                        ? availableClasses
                            .filter((c) => selectedClassIds.includes(c.id))
                            .map((c) => c.nom)
                            .join(", ")
                        : "Sélectionner les classes"}
                    </Text>
                    <FontAwesome5 name={showClassDropdown ? "chevron-up" : "chevron-down"} size={13} color={colors.textMuted} />
                  </TouchableOpacity>
                  {showClassDropdown && (
                    <View style={styles.dropdown}>
                      {classesLoading ? (
                        <ActivityIndicator color={colors.primary} style={{ paddingVertical: 14 }} />
                      ) : classesError ? (
                        <Text style={[styles.pickerEmpty, { color: colors.danger }]}>{classesError}</Text>
                      ) : availableClasses.length === 0 ? (
                        <Text style={styles.pickerEmpty}>Aucune classe à laquelle vous pouvez écrire.</Text>
                      ) : (
                        <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                          {availableClasses.map((c) => {
                            const checked = selectedClassIds.includes(c.id);
                            return (
                              <TouchableOpacity key={c.id} style={styles.pickerItem} onPress={() => toggleClass(c.id)}>
                                <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                                  {checked && <FontAwesome5 name="check" size={10} color={colors.white} />}
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.pickerName}>{c.nom}</Text>
                                  {c.niveau ? <Text style={styles.pickerSub}>{c.niveau}</Text> : null}
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      )}
                    </View>
                  )}
                </>
              ) : (
                <>
                  {/* To */}
                  {renderAutocomplete("to")}
                </>
              )}

              {/* CC */}
              {renderAutocomplete("cc")}

              {/* Subject */}
              <Text style={styles.inputLabel}>Objet</Text>
              <TextInput
                style={styles.textInput}
                value={subject}
                onChangeText={setSubject}
                placeholder="Objet du message (facultatif)"
                placeholderTextColor={colors.textLight}
                maxLength={255}
              />

              {/* Body */}
              <View style={styles.bodyHeader}>
                <Text style={[styles.inputLabel, { marginTop: 0 }]}>Message</Text>
                <TouchableOpacity
                  onPress={() => setShowAttachmentModal(true)}
                  style={styles.attachButton}
                  accessibilityLabel="Joindre"
                >
                  <FontAwesome5 name="paperclip" size={15} color={colors.primary} />
                </TouchableOpacity>
              </View>
              <PendingAttachmentsBar items={attachments.items} onRemove={attachments.remove} onRetry={attachments.retry} />
              {links.length > 0 && (
                <View style={styles.chipsRow}>
                  {links.map((href) => (
                    <View key={href} style={styles.chip}>
                      <FontAwesome5 name="link" size={11} color={colors.primary} />
                      <Text style={[styles.chipText, { maxWidth: 200 }]} numberOfLines={1}>
                        {href}
                      </Text>
                      <TouchableOpacity onPress={() => setLinks((p) => p.filter((l) => l !== href))} hitSlop={8}>
                        <FontAwesome5 name="times" size={11} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <TextInput
                style={[styles.textInput, styles.messageInput]}
                value={message}
                onChangeText={setMessage}
                placeholder="Tapez votre message ici..."
                placeholderTextColor={colors.textLight}
                multiline
                textAlignVertical="top"
              />
            </ScrollView>

            <View style={[styles.composeActions, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
              {attachments.isUploading ? (
                <Text style={styles.uploadingText}>Téléversement… {Math.round(attachments.overallProgress * 100)}%</Text>
              ) : null}
              <TouchableOpacity style={styles.cancelButton} onPress={() => animateOut(onClose)}>
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendButton, sendDisabled && styles.disabledButton]}
                onPress={handleSend}
                disabled={sendDisabled}
              >
                {isSending || attachments.isUploading ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <FontAwesome5 name="paper-plane" size={14} color={colors.white} />
                )}
                <Text style={styles.sendButtonText}>{isSending ? "Envoi..." : "Envoyer"}</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
      {showAttachmentModal && (
        <AttachmentModal allowLink onClose={() => setShowAttachmentModal(false)} onAttach={handleAttach} />
      )}
      <PromptSheet
        visible={showLinkPrompt}
        title="Ajouter un lien"
        placeholder="https://..."
        submitLabel="Ajouter"
        onCancel={() => setShowLinkPrompt(false)}
        onSubmit={(url) => {
          const trimmed = url.trim();
          if (trimmed) {
            const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
            setLinks((prev) => (prev.includes(href) ? prev : [...prev, href]));
          }
          setShowLinkPrompt(false);
        }}
      />
    </Modal>
  );
};

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)", justifyContent: "flex-end" },
    composeModal: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: "90%" },
    composeHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    composeTitle: { fontSize: 18, fontWeight: "700", color: c.text },
    composeForm: { padding: 20, paddingBottom: 32 },
    inputLabel: { fontSize: 13, fontWeight: "700", color: c.textMuted, marginBottom: 6, marginTop: 16 },
    selector: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: c.background,
      gap: 8,
    },
    selectorText: { flex: 1, fontSize: 15, color: c.textLight },
    selectorFocused: { borderColor: c.primary },
    autoInput: { flex: 1, fontSize: 15, color: c.text, paddingVertical: Platform.OS === "ios" ? 2 : 0 },
    avatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.primaryLight,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarText: { fontSize: 13, fontWeight: "700", color: c.primaryDark },
    roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: c.background },
    roleBadgeText: { fontSize: 11, fontWeight: "600", color: c.textMuted },
    dropdown: { borderWidth: 1, borderColor: c.border, borderRadius: 12, backgroundColor: c.surface, marginTop: 6, overflow: "hidden" },
    textInput: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: c.text,
      backgroundColor: c.background,
    },
    messageInput: { minHeight: 140, textAlignVertical: "top" },
    bodyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16, marginBottom: 6 },
    attachButton: { padding: 8, borderRadius: 10, backgroundColor: c.primaryLight },
    groupToggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 16,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.background,
    },
    groupToggleActive: { borderColor: c.primary },
    groupToggleTitle: { fontSize: 14, fontWeight: "700", color: c.text },
    groupToggleSub: { fontSize: 11, color: c.textMuted, marginTop: 1 },
    chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: c.primaryLight,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      maxWidth: "100%",
    },
    chipText: { fontSize: 13, color: c.primaryDark, fontWeight: "600", flexShrink: 1 },
    pickerBox: { marginTop: 6, borderWidth: 1, borderColor: c.border, borderRadius: 12, backgroundColor: c.surface, overflow: "hidden" },
    pickerEmpty: { padding: 14, fontSize: 13, color: c.textMuted, textAlign: "center" },
    pickerItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    pickerName: { fontSize: 14, fontWeight: "600", color: c.text },
    pickerSub: { fontSize: 12, color: c.textMuted, marginTop: 1 },
    checkbox: {
      width: 20,
      height: 20,
      borderWidth: 1.5,
      borderColor: c.grayMid,
      borderRadius: 6,
      justifyContent: "center",
      alignItems: "center",
    },
    checkboxChecked: { backgroundColor: c.primary, borderColor: c.primary },
    composeActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: c.border,
      gap: 12,
    },
    cancelButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
    cancelButtonText: { fontSize: 15, fontWeight: "600", color: c.textMuted },
    sendButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: c.primary,
      paddingHorizontal: 20,
      paddingVertical: 11,
      borderRadius: 12,
    },
    sendButtonText: { fontSize: 15, fontWeight: "700", color: c.white },
    disabledButton: { opacity: 0.6 },
    uploadingText: { flex: 1, fontSize: 12, color: c.textMuted },
  });

export default ComposeMessageModal;
