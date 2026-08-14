import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Modal,
  Animated,
  Alert,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import AttachmentModal, { AttachmentType } from "./AttachmentModal";
import PromptSheet from "../../../../components/common/PromptSheet";
import { classService } from "../../../../services/classService";
import { messageService } from "../../../../services/messageService";
import { mediaService } from "../../../../services/api";
import { useUser } from "../../../../context/UserContext";
import { ClassEntity, ClassUser, MessageAttachment } from "../../../../types";

interface RecipientSuggestion {
  id: string;
  name: string;
  nom: string;
  prenom: string;
  email: string;
  type?: string;
}

interface ComposeMessageModalProps {
  onClose: () => void;
  onSend: () => void;
}

const ComposeMessageModal = ({ onClose, onSend }: ComposeMessageModalProps) => {
  const { user } = useUser();
  const [selectedClasses, setSelectedClasses] = useState<ClassEntity[]>([]);
  const [availableClasses, setAvailableClasses] = useState<ClassEntity[]>([]);
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [recipients, setRecipients] = useState<RecipientSuggestion[]>([]);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientSuggestions, setRecipientSuggestions] = useState<RecipientSuggestion[]>([]);
  const [ccRecipients, setCcRecipients] = useState<RecipientSuggestion[]>([]);
  const [ccSearch, setCcSearch] = useState("");
  const [ccSuggestions, setCcSuggestions] = useState<RecipientSuggestion[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isGroupMessage, setIsGroupMessage] = useState(false);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [showLinkPrompt, setShowLinkPrompt] = useState(false);
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');
  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
    loadClasses();
  }, []);

  const loadClasses = async () => {
    try {
      const classesData = await classService.getClassesWithPublicationRights(user?.userId as string);
      setAvailableClasses(classesData || []);
    } catch (error) {
      console.error('Error loading classes:', error);
      Alert.alert('Erreur', 'Impossible de charger les classes');
    }
  };

  const handleClassSelection = (classItem: ClassEntity) => {
    const isSelected = selectedClasses.find(c => c.id === classItem.id);
    if (isSelected) {
      setSelectedClasses(prev => prev.filter(c => c.id !== classItem.id));
    } else {
      setSelectedClasses(prev => [...prev, classItem]);
    }
    loadClassUsers();
  };

  const loadClassUsers = async () => {
    if (selectedClasses.length === 0) {
      setRecipientSuggestions([]);
      return;
    }

    try {
      const allUsers: ClassUser[] = [];
      for (const classItem of selectedClasses) {
        const users = await classService.getClassUsers(classItem.id);
        allUsers.push(...users);
      }

      // Remove duplicates and format
      const uniqueUsers: RecipientSuggestion[] = allUsers.filter((u, index, self) =>
        index === self.findIndex(other => other.id === u.id)
      ).map(u => ({
        id: u.id,
        name: `${u.prenom || ''} ${u.nom || ''}`.trim(),
        nom: u.nom || '',
        prenom: u.prenom || '',
        email: u.email || u.telephone || 'Non spécifié',
        type: u.type
      }));

      setRecipientSuggestions(uniqueUsers);
    } catch (error) {
      console.error('Error loading class users:', error);
    }
  };

  const loadModerators = async () => {
    if (selectedClasses.length === 0) {
      setCcSuggestions([]);
      return;
    }

    try {
      const allModerators: ClassUser[] = [];
      for (const classItem of selectedClasses) {
        const moderators = await classService.getClassModerators(classItem.id);
        allModerators.push(...moderators);
      }

      // Remove duplicates and format
      const uniqueModerators: RecipientSuggestion[] = allModerators.filter((mod, index, self) =>
        index === self.findIndex(m => m.id === mod.id)
      ).map(mod => ({
        id: mod.id,
        name: `${mod.prenom || ''} ${mod.nom || ''}`.trim(),
        nom: mod.nom || '',
        prenom: mod.prenom || '',
        email: mod.email || 'Non spécifié',
        type: mod.type
      }));

      setCcSuggestions(uniqueModerators);
    } catch (error) {
      console.error('Error loading moderators:', error);
    }
  };

  const addRecipient = (recipient: RecipientSuggestion) => {
    if (!recipients.find(r => r.id === recipient.id)) {
      setRecipients(prev => [...prev, recipient]);
    }
    setRecipientSearch('');
  };

  const removeRecipient = (userId: string) => {
    setRecipients(prev => prev.filter(r => r.id !== userId));
  };

  const addCcRecipient = (recipient: RecipientSuggestion) => {
    if (!ccRecipients.find(r => r.id === recipient.id)) {
      setCcRecipients(prev => [...prev, recipient]);
    }
    setCcSearch('');
  };

  const removeCcRecipient = (userId: string) => {
    setCcRecipients(prev => prev.filter(r => r.id !== userId));
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleAttach = async (type: AttachmentType) => {
    setShowAttachmentModal(false);

    if (type === "link") {
      setShowLinkPrompt(true);
      return;
    }

    if (!user?.userId) {
      Alert.alert("Erreur", "Utilisateur non identifié.");
      return;
    }

    try {
      if (type === "image") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert("Permission requise", "Autorisez l'accès à vos photos pour joindre une image.");
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
        if (result.canceled || !result.assets?.length) return;
        const asset = result.assets[0];
        const name = asset.fileName ?? `image_${Date.now()}.jpg`;

        setIsUploadingAttachment(true);
        const url = await mediaService.uploadFile({ uri: asset.uri, mimeType: "image/jpeg", name }, user.userId, "IMAGE");
        setAttachments((prev) => [...prev, { id: Date.now().toString(), name, uri: url, mimeType: "image/jpeg" }]);
      } else {
        const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
        if (result.canceled || !result.assets?.length) return;
        const asset = result.assets[0];

        setIsUploadingAttachment(true);
        const url = await mediaService.uploadFile(
          { uri: asset.uri, mimeType: asset.mimeType ?? "application/octet-stream", name: asset.name },
          user.userId,
          "DOCUMENT"
        );
        setAttachments((prev) => [...prev, { id: Date.now().toString(), name: asset.name, uri: url, mimeType: asset.mimeType }]);
      }
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec du téléversement de la pièce jointe.");
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const getFilteredRecipients = () => {
    return recipientSuggestions.filter(u =>
      u.name.toLowerCase().includes(recipientSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(recipientSearch.toLowerCase())
    );
  };

  const getFilteredModerators = () => {
    return ccSuggestions.filter(mod =>
      mod.name.toLowerCase().includes(ccSearch.toLowerCase()) ||
      mod.email.toLowerCase().includes(ccSearch.toLowerCase())
    );
  };

  /**
   * Message bodies render as plain RN <Text> (no HTML/webview renderer anywhere
   * downstream), so wrapping in an HTML <div style="..."> — as this used to do —
   * made the literal tags show up as garbled text in the recipient's inbox.
   * Attachments have no field on the backend Messages/GroupMessageDto models, so
   * they're folded into the plain-text body instead of being silently dropped.
   */
  const formatMessage = () => {
    let body = message.trim();
    if (attachments.length > 0) {
      const links = attachments.map((a) => `- ${a.name}: ${a.uri}`).join('\n');
      body = `${body}\n\nPièces jointes:\n${links}`;
    }
    return body;
  };

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: 600,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const handleSend = async () => {
    if (selectedClasses.length === 0 || !subject || !message) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs obligatoires.");
      return;
    }

    if (!isGroupMessage && recipients.length === 0) {
      Alert.alert("Erreur", "Veuillez sélectionner au moins un destinataire.");
      return;
    }

    setIsLoading(true);
    try {
      const formattedMessage = formatMessage();

      if (isGroupMessage) {
        // POST /messages/group — GroupMessageDto field names exactly: content (not contenu),
        // senderId (not expediteurId), classIds, copieRecipientIds (not ccRecipients). No
        // attachment field exists on this DTO server-side.
        await messageService.sendGroupMessage({
          objet: subject,
          content: formattedMessage,
          senderId: user?.userId,
          classIds: selectedClasses.map((c) => c.id),
          copieRecipientIds: ccRecipients.map((cc) => cc.id),
        } as any);
      } else {
        // POST /messages — the Messages model requires expediteur/destinataires as full
        // Utilisateurs objects (Jackson polymorphic "type" discriminator + @NonNull nom/prenom),
        // not bare id strings. "utilisateur" is always a valid type (the base class).
        const allRecipients = [...recipients, ...ccRecipients];

        await messageService.sendIndividualMessage({
          contenu: formattedMessage,
          objet: subject,
          dateCreation: new Date().toISOString(),
          etat: "envoyé",
          expediteur: {
            type: "utilisateur",
            id: user?.userId,
            nom: user?.nom || "",
            prenom: user?.prenom || "",
            email: user?.email || "",
            telephone: user?.telephone || "",
          },
          destinataires: allRecipients.map((recipient) => ({
            type: "utilisateur",
            id: recipient.id,
            nom: recipient.nom || "",
            prenom: recipient.prenom || "",
            email: recipient.email || "",
          })),
        } as any);
      }

      Alert.alert('Succès', 'Message envoyé avec succès');
      onSend();
      handleClose();
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer le message');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      transparent
      visible
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.composeModal,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.composeHeader}>
            <Text style={styles.composeTitle}>Nouveau message</Text>
            <TouchableOpacity onPress={handleClose}>
              <FontAwesome5 name="times" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.composeForm}>
            {/* Classes Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Classes *</Text>
              <TouchableOpacity
                style={styles.classSelector}
                onPress={() => setShowClassDropdown(!showClassDropdown)}
              >
                <Text style={styles.classSelectorText}>
                  {selectedClasses.length > 0
                    ? `${selectedClasses.length} classe(s) sélectionnée(s)`
                    : "Sélectionner les classes"}
                </Text>
                <FontAwesome5 name="chevron-down" size={16} color="#6B7280" />
              </TouchableOpacity>
              {showClassDropdown && (
                <View style={styles.classDropdown}>
                  {availableClasses.map((classItem) => (
                    <TouchableOpacity
                      key={classItem.id}
                      style={styles.classOption}
                      onPress={() => handleClassSelection(classItem)}
                    >
                      <View style={styles.classCheckbox}>
                        {selectedClasses.find(c => c.id === classItem.id) && (
                          <FontAwesome5 name="check" size={12} color="#4F46E5" />
                        )}
                      </View>
                      <Text style={styles.classOptionText}>{classItem.nom}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Group Message Toggle */}
            <View style={styles.inputGroup}>
              <TouchableOpacity
                style={styles.groupMessageButton}
                onPress={() => {
                  setIsGroupMessage(!isGroupMessage);
                  if (!isGroupMessage) {
                    setRecipients([]);
                    loadModerators();
                  }
                }}
              >
                <View style={styles.groupCheckbox}>
                  {isGroupMessage && <FontAwesome5 name="check" size={12} color="#FFFFFF" />}
                </View>
                <Text style={styles.groupMessageText}>
                  Message général (envoyé à tous les membres de la classe)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Recipients */}
            {!isGroupMessage && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>À: *</Text>
                <View style={styles.recipientsContainer}>
                  {recipients.map((recipient) => (
                    <View key={recipient.id} style={styles.recipientChip}>
                      <Text style={styles.recipientChipText}>{recipient.name}</Text>
                      <TouchableOpacity onPress={() => removeRecipient(recipient.id)}>
                        <FontAwesome5 name="times" size={12} color="#6B7280" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
                <TextInput
                  style={styles.textInput}
                  value={recipientSearch}
                  onChangeText={(text) => {
                    setRecipientSearch(text);
                    if (selectedClasses.length > 0) loadClassUsers();
                  }}
                  placeholder="Rechercher un destinataire..."
                />
                {recipientSearch && getFilteredRecipients().length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    {getFilteredRecipients().slice(0, 5).map((u) => (
                      <TouchableOpacity
                        key={u.id}
                        style={styles.suggestionItem}
                        onPress={() => addRecipient(u)}
                      >
                        <Text style={styles.suggestionName}>{u.name}</Text>
                        <Text style={styles.suggestionEmail}>{u.email}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* CC Recipients */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Copie (CC):</Text>
              <View style={styles.recipientsContainer}>
                {ccRecipients.map((recipient) => (
                  <View key={recipient.id} style={styles.recipientChip}>
                    <Text style={styles.recipientChipText}>{recipient.name}</Text>
                    <TouchableOpacity onPress={() => removeCcRecipient(recipient.id)}>
                      <FontAwesome5 name="times" size={12} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              <TextInput
                style={styles.textInput}
                value={ccSearch}
                onChangeText={(text) => {
                  setCcSearch(text);
                  if (selectedClasses.length > 0) loadModerators();
                }}
                placeholder="Rechercher un modérateur..."
              />
              {ccSearch && getFilteredModerators().length > 0 && (
                <View style={styles.suggestionsContainer}>
                  {getFilteredModerators().slice(0, 5).map((mod) => (
                    <TouchableOpacity
                      key={mod.id}
                      style={styles.suggestionItem}
                      onPress={() => addCcRecipient(mod)}
                    >
                      <Text style={styles.suggestionName}>{mod.name}</Text>
                      <Text style={styles.suggestionEmail}>{mod.email}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Sujet:</Text>
              <TextInput
                style={styles.textInput}
                value={subject}
                onChangeText={setSubject}
                placeholder="Objet du message"
              />
            </View>
            <View style={styles.inputGroup}>
              <View style={styles.attachmentsHeader}>
                <Text style={styles.inputLabel}>Message: *</Text>
                <TouchableOpacity onPress={() => setShowAttachmentModal(true)} disabled={isUploadingAttachment}>
                  {isUploadingAttachment ? (
                    <FontAwesome5 name="spinner" size={20} color="#6B7280" />
                  ) : (
                    <FontAwesome5 name="paperclip" size={20} color="#6B7280" />
                  )}
                </TouchableOpacity>
              </View>

              {attachments.length > 0 && (
                <View style={styles.recipientsContainer}>
                  {attachments.map((att) => (
                    <View key={att.id} style={styles.recipientChip}>
                      <FontAwesome5
                        name={att.mimeType === 'text/uri-list' ? 'link' : att.mimeType?.startsWith('image') ? 'image' : 'file-alt'}
                        size={12}
                        color="#4F46E5"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.recipientChipText} numberOfLines={1}>{att.name}</Text>
                      <TouchableOpacity onPress={() => removeAttachment(att.id as string)}>
                        <FontAwesome5 name="times" size={12} color="#6B7280" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Rich Text Editor Toolbar */}
              <View style={styles.editorToolbar}>
                <TouchableOpacity
                  style={[styles.toolbarButton, isBold && styles.activeToolbarButton]}
                  onPress={() => setIsBold(!isBold)}
                >
                  <FontAwesome5 name="bold" size={14} color={isBold ? "#FFFFFF" : "#6B7280"} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toolbarButton, isItalic && styles.activeToolbarButton]}
                  onPress={() => setIsItalic(!isItalic)}
                >
                  <FontAwesome5 name="italic" size={14} color={isItalic ? "#FFFFFF" : "#6B7280"} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toolbarButton, isUnderline && styles.activeToolbarButton]}
                  onPress={() => setIsUnderline(!isUnderline)}
                >
                  <FontAwesome5 name="underline" size={14} color={isUnderline ? "#FFFFFF" : "#6B7280"} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toolbarButton, textAlign === 'left' && styles.activeToolbarButton]}
                  onPress={() => setTextAlign('left')}
                >
                  <FontAwesome5 name="align-left" size={14} color={textAlign === 'left' ? "#FFFFFF" : "#6B7280"} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toolbarButton, textAlign === 'center' && styles.activeToolbarButton]}
                  onPress={() => setTextAlign('center')}
                >
                  <FontAwesome5 name="align-center" size={14} color={textAlign === 'center' ? "#FFFFFF" : "#6B7280"} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toolbarButton, textAlign === 'right' && styles.activeToolbarButton]}
                  onPress={() => setTextAlign('right')}
                >
                  <FontAwesome5 name="align-right" size={14} color={textAlign === 'right' ? "#FFFFFF" : "#6B7280"} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={[
                  styles.textInput,
                  styles.messageInput,
                  {
                    fontWeight: isBold ? 'bold' : 'normal',
                    fontStyle: isItalic ? 'italic' : 'normal',
                    textDecorationLine: isUnderline ? 'underline' : 'none',
                    textAlign: textAlign,
                  }
                ]}
                value={message}
                onChangeText={setMessage}
                placeholder="Tapez votre message ici..."
                multiline
                textAlignVertical="top"
              />
            </View>
          </ScrollView>
          <View style={styles.composeActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendButton, isLoading && styles.disabledButton]}
              onPress={handleSend}
              disabled={isLoading}
            >
              {isLoading ? (
                <FontAwesome5 name="spinner" size={16} color="#FFFFFF" />
              ) : (
                <FontAwesome5 name="paper-plane" size={16} color="#FFFFFF" />
              )}
              <Text style={styles.sendButtonText}>
                {isLoading ? 'Envoi...' : 'Envoyer'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
      {showAttachmentModal && (
        <AttachmentModal
          onClose={() => setShowAttachmentModal(false)}
          onAttach={handleAttach}
        />
      )}
      <PromptSheet
        visible={showLinkPrompt}
        title="Ajouter un lien"
        placeholder="https://..."
        submitLabel="Ajouter"
        onCancel={() => setShowLinkPrompt(false)}
        onSubmit={(url) => {
          setAttachments((prev) => [
            ...prev,
            { id: Date.now().toString(), name: url, uri: url, mimeType: "text/uri-list" },
          ]);
          setShowLinkPrompt(false);
        }}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  composeModal: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    height: "85%",
  },
  composeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  composeTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  composeForm: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#FFFFFF",
  },
  messageInput: {
    height: 120,
    textAlignVertical: "top",
  },
  composeActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#6B7280",
  },
  sendButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4F46E5",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#FFFFFF",
    marginLeft: 8,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  checkboxInner: {
    width: 12,
    height: 12,
    backgroundColor: "#4F46E5",
    borderRadius: 2,
  },
  checkboxLabel: {
    fontSize: 14,
    color: "#374151",
  },
  attachmentsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  classSelector: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  classSelectorText: {
    fontSize: 16,
    color: "#6B7280",
  },
  classDropdown: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    marginTop: 4,
    maxHeight: 200,
  },
  classOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  classCheckbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 4,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  classOptionText: {
    fontSize: 16,
    color: "#111827",
  },
  groupMessageButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4F46E5",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  groupCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  groupMessageText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    flex: 1,
  },
  recipientsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  recipientChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 4,
  },
  recipientChipText: {
    fontSize: 14,
    color: "#4F46E5",
    marginRight: 8,
  },
  suggestionsContainer: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    marginTop: 4,
    maxHeight: 150,
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  suggestionName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#111827",
  },
  suggestionEmail: {
    fontSize: 14,
    color: "#6B7280",
  },
  editorToolbar: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#D1D5DB",
  },
  toolbarButton: {
    width: 32,
    height: 32,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 4,
  },
  activeToolbarButton: {
    backgroundColor: "#4F46E5",
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default ComposeMessageModal;
