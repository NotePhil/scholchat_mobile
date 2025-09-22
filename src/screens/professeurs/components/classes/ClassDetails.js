import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

const ClassDetails = ({
  selectedClass,
  onBack,
  activeDetailTab,
  setActiveDetailTab,
}) => {
  const getStateColor = (state) => {
    return state === "ACTIVE" ? "#10B981" : "#6B7280";
  };

  const getStateBackground = (state) => {
    return state === "ACTIVE" ? "#D1FAE5" : "#F3F4F6";
  };

  const getStateText = (state) => {
    return state === "ACTIVE" ? "Active" : "Inactive";
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.detailTitle}>Détails de la classe</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView style={styles.content}>
        {/* Class Info Card */}
        <View style={styles.classInfoCard}>
          <View style={styles.classIcon}>
            <Text style={styles.classIconText}>
              {selectedClass.name.substring(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={styles.classInfoContent}>
            <Text style={styles.className}>{selectedClass.name}</Text>
            <Text style={styles.classLevel}>Niveau: {selectedClass.level}</Text>
            <View style={styles.classMetaRow}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStateBackground(selectedClass.state) },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: getStateColor(selectedClass.state) },
                  ]}
                >
                  {getStateText(selectedClass.state)}
                </Text>
              </View>
              <Text style={styles.classDate}>
                Créée le{" "}
                {new Date(selectedClass.creationDate).toLocaleDateString(
                  "fr-FR"
                )}
              </Text>
            </View>
          </View>
        </View>
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <FontAwesome5 name="user-graduate" size={24} color="#4F46E5" />
            <Text style={styles.statNumber}>{selectedClass.studentsCount}</Text>
            <Text style={styles.statLabel}>Étudiants</Text>
          </View>
          <View style={styles.statCard}>
            <FontAwesome5 name="users" size={24} color="#10B981" />
            <Text style={styles.statNumber}>{selectedClass.parentsCount}</Text>
            <Text style={styles.statLabel}>Parents</Text>
          </View>
          <View style={styles.statCard}>
            <FontAwesome5 name="clock" size={24} color="#F59E0B" />
            <Text style={styles.statNumber}>
              {selectedClass.accessRequests.length}
            </Text>
            <Text style={styles.statLabel}>Demandes</Text>
          </View>
        </View>
        {/* Detail Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeDetailTab === "info" && styles.activeTab]}
            onPress={() => setActiveDetailTab("info")}
          >
            <Text
              style={[
                styles.tabText,
                activeDetailTab === "info" && styles.activeTabText,
              ]}
            >
              Informations
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeDetailTab === "manage" && styles.activeTab,
            ]}
            onPress={() => setActiveDetailTab("manage")}
          >
            <Text
              style={[
                styles.tabText,
                activeDetailTab === "manage" && styles.activeTabText,
              ]}
            >
              Gestion
            </Text>
          </TouchableOpacity>
        </View>
        {/* Tab Content */}
        {activeDetailTab === "info" && (
          <View style={styles.tabContent}>
            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Informations générales</Text>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Modérateur:</Text>
                <Text style={styles.infoValue}>{selectedClass.moderator}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Droits:</Text>
                <Text style={styles.infoValue}>
                  {selectedClass.teacherRights}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Établissement:</Text>
                <Text style={styles.infoValue}>
                  {selectedClass.etablissement}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Description:</Text>
                <Text style={styles.infoValue}>
                  {selectedClass.description}
                </Text>
              </View>
            </View>
          </View>
        )}
        {activeDetailTab === "manage" && (
          <View style={styles.tabContent}>
            {/* Students Section */}
            <View style={styles.manageSection}>
              <View style={styles.manageSectionHeader}>
                <FontAwesome5 name="user-graduate" size={16} color="#4F46E5" />
                <Text style={styles.manageSectionTitle}>
                  Étudiants ({selectedClass.students.length})
                </Text>
              </View>
              {selectedClass.students.length > 0 ? (
                selectedClass.students.map((student) => (
                  <View key={student.id} style={styles.listItem}>
                    <View style={styles.listItemAvatar}>
                      <FontAwesome5
                        name="user-graduate"
                        size={14}
                        color="#4F46E5"
                      />
                    </View>
                    <View style={styles.listItemInfo}>
                      <Text style={styles.listItemName}>{student.name}</Text>
                      <Text style={styles.listItemEmail}>{student.email}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>Aucun étudiant trouvé</Text>
              )}
            </View>
            {/* Parents Section */}
            <View style={styles.manageSection}>
              <View style={styles.manageSectionHeader}>
                <FontAwesome5 name="users" size={16} color="#10B981" />
                <Text style={styles.manageSectionTitle}>
                  Parents ({selectedClass.parents.length})
                </Text>
              </View>
              {selectedClass.parents.length > 0 ? (
                selectedClass.parents.map((parent) => (
                  <View key={parent.id} style={styles.listItem}>
                    <View style={styles.listItemAvatar}>
                      <FontAwesome5 name="user" size={14} color="#10B981" />
                    </View>
                    <View style={styles.listItemInfo}>
                      <Text style={styles.listItemName}>{parent.name}</Text>
                      <Text style={styles.listItemEmail}>{parent.phone}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>Aucun parent trouvé</Text>
              )}
            </View>
            {/* Access Requests Section */}
            <View style={styles.manageSection}>
              <View style={styles.manageSectionHeader}>
                <FontAwesome5 name="user-plus" size={16} color="#F59E0B" />
                <Text style={styles.manageSectionTitle}>
                  Demandes d'accès ({selectedClass.accessRequests.length})
                </Text>
              </View>
              {selectedClass.accessRequests.length > 0 ? (
                selectedClass.accessRequests.map((request) => (
                  <View key={request.id} style={styles.requestItem}>
                    <View style={styles.listItemAvatar}>
                      <FontAwesome5
                        name="user-clock"
                        size={14}
                        color="#F59E0B"
                      />
                    </View>
                    <View style={styles.listItemInfo}>
                      <Text style={styles.listItemName}>{request.name}</Text>
                      <Text style={styles.listItemEmail}>
                        {request.role} • {request.date}
                      </Text>
                    </View>
                    <View style={styles.requestActions}>
                      <TouchableOpacity style={styles.acceptButton}>
                        <FontAwesome5 name="check" size={12} color="#FFFFFF" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.rejectButton}>
                        <FontAwesome5 name="times" size={12} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>Aucune demande d'accès</Text>
              )}
            </View>
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingTop: 50,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 16,
  },
  headerSpacer: {
    width: 40,
  },
  classInfoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    marginVertical: 20,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  classIcon: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  classIconText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  classInfoContent: {
    flex: 1,
  },
  className: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  classLevel: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 8,
  },
  classMetaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  classDate: {
    fontSize: 12,
    color: "#9CA3AF",
    marginLeft: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center",
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: "#4F46E5",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  activeTabText: {
    color: "#FFFFFF",
  },
  tabContent: {
    marginBottom: 20,
  },
  infoSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: "row",
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
    width: 120,
  },
  infoValue: {
    fontSize: 14,
    color: "#111827",
    flex: 1,
  },
  manageSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  manageSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  manageSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginLeft: 8,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  listItemAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  listItemInfo: {
    flex: 1,
  },
  listItemName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
    marginBottom: 2,
  },
  listItemEmail: {
    fontSize: 12,
    color: "#6B7280",
  },
  requestItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  requestActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  acceptButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  rejectButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    paddingVertical: 16,
  },
});

export default ClassDetails;
