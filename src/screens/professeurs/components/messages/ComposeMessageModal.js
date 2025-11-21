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
  FlatList,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import AttachmentModal from "./AttachmentModal";
import { classService } from "../../../../services/classService";
import { messageService } from "../../../../services/messageService";
import { useUser } from "../../../../context/UserContext";

const ComposeMessageModal = ({ onClose, onSend }) => {
  const { user } = useUser();
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [recipients, setRecipients] = useState([]);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientSuggestions, setRecipientSuggestions] = useState([]);
  const [ccRecipients, setCcRecipients] = useState([]);
  const [ccSearch, setCcSearch] = useState("");
  const [ccSuggestions, setCcSuggestions] = useState([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isGroupMessage, setIsGroupMessage] = useState(false);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [textAlign, setTextAlign] = useState('left');
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
      const classesData = await classService.getClassesWithPublicationRights(user?.userId);
      setAvailableClasses(classesData || []);
    } catch (error) {
      console.error('Error loading classes:', error);
      Alert.alert('Erreur', 'Impossible de charger les classes');
    }
  };

  const handleClassSelection = (classItem) => {
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
      const allUsers = [];
      for (const classItem of selectedClasses) {
        const users = await classService.getClassUsers(classItem.id);
        allUsers.push(...users);
      }
      
      // Remove duplicates and format
      const uniqueUsers = allUsers.filter((user, index, self) => 
        index === self.findIndex(u => u.id === user.id)
      ).map(user => ({
        id: user.id,
        name: `${user.prenom || ''} ${user.nom || ''}`.trim(),
        email: user.email || user.telephone || 'Non spécifié',
        type: user.type
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
      const allModerators = [];
      for (const classItem of selectedClasses) {
        const moderators = await classService.getClassModerators(classItem.id);
        allModerators.push(...moderators);
      }
      
      // Remove duplicates and format
      const uniqueModerators = allModerators.filter((mod, index, self) => 
        index === self.findIndex(m => m.id === mod.id)
      ).map(mod => ({
        id: mod.id,
        name: `${mod.prenom || ''} ${mod.nom || ''}`.trim(),
        email: mod.email || 'Non spécifié',
        type: mod.type
      }));
      
      setCcSuggestions(uniqueModerators);
    } catch (error) {
      console.error('Error loading moderators:', error);
    }
  };

  const addRecipient = (user) => {
    if (!recipients.find(r => r.id === user.id)) {
      setRecipients(prev => [...prev, user]);
    }
    setRecipientSearch('');
  };

  const removeRecipient = (userId) => {
    setRecipients(prev => prev.filter(r => r.id !== userId));
  };

  const addCcRecipient = (user) => {
    if (!ccRecipients.find(r => r.id === user.id)) {
      setCcRecipients(prev => [...prev, user]);
    }
    setCcSearch('');
  };

  const removeCcRecipient = (userId) => {
    setCcRecipients(prev => prev.filter(r => r.id !== userId));
  };

  const getFilteredRecipients = () => {
    return recipientSuggestions.filter(user => 
      user.name.toLowerCase().includes(recipientSearch.toLowerCase()) ||
      user.email.toLowerCase().includes(recipientSearch.toLowerCase())
    );
  };

  const getFilteredModerators = () => {
    return ccSuggestions.filter(mod => 
      mod.name.toLowerCase().includes(ccSearch.toLowerCase()) ||
      mod.email.toLowerCase().includes(ccSearch.toLowerCase())
    );
  };

  const formatMessage = () => {
    let style = '';
    if (isBold) style += 'font-weight: bold; ';
    if (isItalic) style += 'font-style: italic; ';
    if (isUnderline) style += 'text-decoration: underline; ';
    style += `text-align: ${textAlign}; `;
    
    return `<div style="${style}">${message.replace(/\n/g, '<br>')}</div>`;
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
        // Send group message to all class members
        const allClassUsers = [];
        for (const classItem of selectedClasses) {
          const users = await classService.getClassUsers(classItem.id);
          allClassUsers.push(...users);
        }
        
        const uniqueUserIds = [...new Set(allClassUsers.map(u => u.id))];
        const allRecipientIds = [...uniqueUserIds, ...ccRecipients.map(cc => cc.id)];
        
        await messageService.sendGroupMessage({
          contenu: formattedMessage,
          objet: subject,
          expediteurId: user.userId,
          destinataireIds: allRecipientIds
        });
      } else {
        // Send individual message
        const allRecipients = [...recipients, ...ccRecipients];
        
        await messageService.sendIndividualMessage({
          contenu: formattedMessage,
          objet: subject,
          expediteur: { type: user.type || "professeur", id: user.userId },
          destinataires: allRecipients.map(recipient => ({ type: recipient.type, id: recipient.id }))
        });
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
                    {getFilteredRecipients().slice(0, 5).map((user) => (
                      <TouchableOpacity
                        key={user.id}
                        style={styles.suggestionItem}
                        onPress={() => addRecipient(user)}
                      >
                        <Text style={styles.suggestionName}>{user.name}</Text>
                        <Text style={styles.suggestionEmail}>{user.email}</Text>
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
                <TouchableOpacity onPress={() => setShowAttachmentModal(true)}>
                  <FontAwesome5 name="paperclip" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
              
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
          onAttach={(type) => {
            Alert.alert("Attachment", `Adding ${type}...`);
            setShowAttachmentModal(false);
          }}
        />
      )}
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
