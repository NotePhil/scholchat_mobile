import React, { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

const CourseDetailsModal = ({
  visible,
  selectedCours,
  onClose,
  onUpdate,
  onShare,
}) => {
  const [activeTab, setActiveTab] = useState("details");

  const getStatusColor = (etat) => {
    switch (etat) {
      case "PUBLIE":
        return "#10B981";
      case "BROUILLON":
        return "#F59E0B";
      case "ARCHIVE":
        return "#6B7280";
      default:
        return "#6B7280";
    }
  };

  const getStatusBackground = (etat) => {
    switch (etat) {
      case "PUBLIE":
        return "#D1FAE5";
      case "BROUILLON":
        return "#FEF3C7";
      case "ARCHIVE":
        return "#F3F4F6";
      default:
        return "#F3F4F6";
    }
  };

  const getStatusText = (etat) => {
    switch (etat) {
      case "PUBLIE":
        return "Publié";
      case "BROUILLON":
        return "Brouillon";
      case "ARCHIVE":
        return "Archivé";
      default:
        return etat;
    }
  };

  const handleUpdate = () => {
    if (onUpdate) {
      onUpdate(selectedCours);
    }
    onClose();
  };

  const handleShare = () => {
    if (onShare) {
      onShare(selectedCours);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "details":
        return (
          <>
            {/* Course Information Section */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <FontAwesome5 name="info-circle" size={16} color="#4F46E5" />
                <Text style={styles.sectionTitle}>Informations du Cours</Text>
              </View>
              <View style={styles.courseInfoCard}>
                <View style={styles.courseInfoHeader}>
                  <Text style={styles.courseInfoTitle}>
                    {selectedCours.titre}
                  </Text>
                  <Text style={styles.courseInfoSubtitle}>
                    {selectedCours.matieres
                      ? selectedCours.matieres.join(", ")
                      : "Matière non définie"}
                  </Text>
                </View>

                <View style={styles.courseInfoDetails}>
                  {/* Creation date - first */}
                  <View style={styles.detailItem}>
                    <FontAwesome5
                      name="calendar-plus"
                      size={14}
                      color="#8B5CF6"
                    />
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Date de création</Text>
                      <Text style={styles.detailValue}>
                        {new Date(
                          selectedCours.dateCreation
                        ).toLocaleDateString("fr-FR")}{" "}
                        09:00
                      </Text>
                    </View>
                  </View>

                  {/* Start and End dates on same line */}
                  <View style={styles.detailRow}>
                    <View style={styles.detailItem}>
                      <FontAwesome5 name="calendar" size={14} color="#10B981" />
                      <View style={styles.detailContent}>
                        <Text style={styles.detailLabel}>Date de début</Text>
                        <Text style={styles.detailValue}>Non défini</Text>
                      </View>
                    </View>
                    <View style={styles.detailItem}>
                      <FontAwesome5 name="clock" size={14} color="#F59E0B" />
                      <View style={styles.detailContent}>
                        <Text style={styles.detailLabel}>Date de fin</Text>
                        <Text style={styles.detailValue}>Non défini</Text>
                      </View>
                    </View>
                  </View>

                  {/* Location and Professor on same line */}
                  <View style={styles.detailRow}>
                    <View style={styles.detailItem}>
                      <FontAwesome5
                        name="map-marker-alt"
                        size={14}
                        color="#F59E0B"
                      />
                      <View style={styles.detailContent}>
                        <Text style={styles.detailLabel}>Lieu</Text>
                        <Text style={styles.detailValue}>Non spécifié</Text>
                      </View>
                    </View>
                    <View style={styles.detailItem}>
                      <FontAwesome5 name="user" size={14} color="#6B7280" />
                      <View style={styles.detailContent}>
                        <Text style={styles.detailLabel}>Professeur</Text>
                        <Text style={styles.detailValue}>Non spécifié</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Description Section */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <FontAwesome5 name="align-left" size={16} color="#4F46E5" />
                <Text style={styles.sectionTitle}>Description</Text>
              </View>
              <Text style={styles.descriptionText}>
                {selectedCours.description ||
                  "Cours d'introduction aux concepts mathématiques de base"}
              </Text>
            </View>

            {/* References Section */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <FontAwesome5 name="book" size={16} color="#4F46E5" />
                <Text style={styles.sectionTitle}>Références</Text>
              </View>
              <Text style={styles.referencesText}>
                {selectedCours.references || "Aucune référence spécifiée"}
              </Text>
            </View>

            {/* Course ID */}
            <View style={styles.courseIdContainer}>
              <Text style={styles.courseIdText}>
                ID: {selectedCours.id || "660e8400-e29b-41d4-a716-446855441100"}
              </Text>
            </View>
          </>
        );

      case "documents":
        return (
          <View style={styles.noDataContainer}>
            <FontAwesome5 name="file-alt" size={48} color="#D1D5DB" />
            <Text style={styles.noDataTitle}>Aucun document trouvé</Text>
            <Text style={styles.noDataText}>
              Les documents associés à ce cours apparaîtront ici.
            </Text>
          </View>
        );

      case "history":
        return (
          <View style={styles.noDataContainer}>
            <FontAwesome5 name="history" size={48} color="#D1D5DB" />
            <Text style={styles.noDataTitle}>Aucun historique trouvé</Text>
            <Text style={styles.noDataText}>
              L'historique des modifications du cours apparaîtra ici.
            </Text>
          </View>
        );

      default:
        return null;
    }
  };

  if (!selectedCours) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.courseIcon}>
                <Text style={styles.courseIconText}>
                  {selectedCours.titre.substring(0, 2).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.modalTitle}>{selectedCours.titre}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
              <FontAwesome5 name="times" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === "details" && styles.activeTab]}
              onPress={() => setActiveTab("details")}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "details" && styles.activeTabText,
                ]}
              >
                Détails
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === "documents" && styles.activeTab,
              ]}
              onPress={() => setActiveTab("documents")}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "documents" && styles.activeTabText,
                ]}
              >
                Documents (0)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "history" && styles.activeTab]}
              onPress={() => setActiveTab("history")}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "history" && styles.activeTabText,
                ]}
              >
                Historique
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {renderTabContent()}
          </ScrollView>

          {/* Bottom Action Buttons */}
          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.updateButton]}
              onPress={handleUpdate}
            >
              <FontAwesome5 name="edit" size={14} color="#FFFFFF" />
              <Text style={styles.updateButtonText}>Modifier</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.shareButton]}
              onPress={handleShare}
            >
              <FontAwesome5 name="share-alt" size={14} color="#FFFFFF" />
              <Text style={styles.shareButtonText}>Partager</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.closeButton]}
              onPress={onClose}
            >
              <Text style={styles.closeButtonText}>Fermer</Text>
            </TouchableOpacity>
          </View>
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
    maxHeight: "85%",
    width: "90%",
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  courseIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  courseIconText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
  },
  modalCloseButton: {
    padding: 8,
  },
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 20,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: "#4F46E5",
  },
  tabText: {
    fontSize: 14,
    color: "#6B7280",
  },
  activeTabText: {
    color: "#4F46E5",
    fontWeight: "500",
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginLeft: 8,
  },
  courseInfoCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 20,
  },
  courseInfoHeader: {
    marginBottom: 20,
  },
  courseInfoTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  courseInfoSubtitle: {
    fontSize: 14,
    color: "#6B7280",
  },
  courseInfoDetails: {
    gap: 16,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
  },
  detailRow: {
    flexDirection: "row",
    gap: 20,
  },
  detailContent: {
    marginLeft: 12,
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "500",
  },
  descriptionText: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  referencesText: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  courseIdContainer: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    marginTop: 24,
  },
  courseIdText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  noDataContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  noDataTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 16,
    marginBottom: 8,
  },
  noDataText: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  bottomActions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    gap: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
  },
  updateButton: {
    backgroundColor: "#4F46E5",
  },
  shareButton: {
    backgroundColor: "#6B7280",
  },
  closeButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  updateButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 6,
  },
  shareButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 6,
  },
  closeButtonText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "500",
  },
});

export default CourseDetailsModal;
