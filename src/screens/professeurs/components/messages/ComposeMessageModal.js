import React, { useState, useRef } from "react";
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
import AttachmentModal from "./AttachmentModal";

const ComposeMessageModal = ({ onClose, onSend }) => {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [cc, setCc] = useState("");
  const [sendToAllClasses, setSendToAllClasses] = useState(false);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const slideAnim = useRef(new Animated.Value(600)).current;

  React.useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: 600,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const handleSend = () => {
    if (!to || !subject || !message) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs.");
      return;
    }
    onSend({
      recipient: to,
      subject: subject,
      preview: message.substring(0, 50) + "...",
      fullMessage: message,
      avatar: to
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase(),
    });
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
            <View style={styles.inputGroup}>
              <View style={styles.checkboxContainer}>
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => setSendToAllClasses(!sendToAllClasses)}
                >
                  {sendToAllClasses && <View style={styles.checkboxInner} />}
                </TouchableOpacity>
                <Text style={styles.checkboxLabel}>
                  Envoyer à toutes les classes
                </Text>
              </View>
              <Text style={styles.inputLabel}>À:</Text>
              <TextInput
                style={styles.textInput}
                value={to}
                onChangeText={setTo}
                placeholder="Nom du destinataire"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>CC:</Text>
              <TextInput
                style={styles.textInput}
                value={cc}
                onChangeText={setCc}
                placeholder="Ajouter des destinataires en copie"
              />
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
                <Text style={styles.inputLabel}>Message:</Text>
                <TouchableOpacity onPress={() => setShowAttachmentModal(true)}>
                  <FontAwesome5 name="paperclip" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.textInput, styles.messageInput]}
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
            <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
              <FontAwesome5 name="paper-plane" size={16} color="#FFFFFF" />
              <Text style={styles.sendButtonText}>Envoyer</Text>
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
});

export default ComposeMessageModal;
