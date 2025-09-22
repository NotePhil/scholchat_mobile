import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

const AttachmentModal = ({ onClose, onAttach }) => {
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <TouchableOpacity
            style={styles.attachmentOption}
            onPress={() => onAttach("link")}
          >
            <FontAwesome5 name="link" size={20} color="#4F46E5" />
            <Text style={styles.attachmentText}>Lien</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.attachmentOption}
            onPress={() => onAttach("image")}
          >
            <FontAwesome5 name="image" size={20} color="#4F46E5" />
            <Text style={styles.attachmentText}>Image</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.attachmentOption}
            onPress={() => onAttach("file")}
          >
            <FontAwesome5 name="file-alt" size={20} color="#4F46E5" />
            <Text style={styles.attachmentText}>Fichier</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    width: "80%",
  },
  attachmentOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  attachmentText: {
    marginLeft: 12,
    fontSize: 16,
    color: "#111827",
  },
  cancelButton: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "500",
  },
});

export default AttachmentModal;
