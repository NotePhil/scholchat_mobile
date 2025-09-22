import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  Animated,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

const AccessRequestModal = ({
  visible,
  onClose,
  onCancel,
  onValidate,
  tokenValue,
  setTokenValue,
  isLoading,
  showSuccess,
  loadingAnimation,
  successAnimation,
}) => {
  const loadingRotation = loadingAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {!isLoading && !showSuccess && (
            <>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Demande d'accès à une classe
                </Text>
                <TouchableOpacity
                  onPress={onCancel}
                  style={styles.modalCloseButton}
                >
                  <FontAwesome5 name="times" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <View style={styles.modalContent}>
                <Text style={styles.modalDescription}>
                  Entrez votre token d'accès
                </Text>
                <TextInput
                  style={styles.tokenInput}
                  placeholder="Token d'accès"
                  value={tokenValue}
                  onChangeText={setTokenValue}
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={onCancel}
                >
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.validateButton}
                  onPress={onValidate}
                >
                  <Text style={styles.validateButtonText}>Valider</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
          {isLoading && (
            <View style={styles.loadingContainer}>
              <Animated.View
                style={[
                  styles.loadingSpinner,
                  { transform: [{ rotate: loadingRotation }] },
                ]}
              >
                <FontAwesome5 name="spinner" size={32} color="#4F46E5" />
              </Animated.View>
              <Text style={styles.loadingText}>
                Traitement de votre demande...
              </Text>
            </View>
          )}
          {showSuccess && (
            <Animated.View
              style={[styles.successContainer, { opacity: successAnimation }]}
            >
              <View style={styles.successIcon}>
                <FontAwesome5 name="check" size={32} color="#FFFFFF" />
              </View>
              <Text style={styles.successText}>
                Demande envoyée avec succès!
              </Text>
            </Animated.View>
          )}
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
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    margin: 20,
    width: "90%",
    maxWidth: 400,
    minHeight: 200,
    justifyContent: "center",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  modalDescription: {
    fontSize: 16,
    color: "#6B7280",
    marginBottom: 16,
    textAlign: "center",
  },
  tokenInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
    textAlign: "center",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#374151",
    fontSize: 16,
    fontWeight: "500",
  },
  validateButton: {
    flex: 1,
    backgroundColor: "#4F46E5",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  validateButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingSpinner: {
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  successText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#10B981",
    textAlign: "center",
  },
});

export default AccessRequestModal;
