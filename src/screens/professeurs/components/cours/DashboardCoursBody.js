import React, { useState, useRef } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

const DashboardCoursBody = ({ onNavigateToCreate, onCreateCours }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("tous");
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedCours, setSelectedCours] = useState(null);
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [cours, setCours] = useState([
    {
      id: "1",
      titre: "Introduction aux Mathématiques",
      description:
        "Cours de base sur les concepts fondamentaux des mathématiques pour débutants",
      dateCreation: "2024-01-15",
      etat: "PUBLIE",
      references: "Manuel de mathématiques niveau 1",
      restriction: "PUBLIC",
      chapitres: ["Algèbre de base", "Géométrie", "Probabilités"],
      matieres: ["Mathématiques"],
      redacteurId: "prof_001",
    },
    {
      id: "2",
      titre: "Physique Quantique Avancée",
      description:
        "Exploration approfondie des principes de la mécanique quantique et de ses applications modernes",
      dateCreation: "2024-02-10",
      etat: "BROUILLON",
      references: "Principes de physique quantique - Griffiths",
      restriction: "PRIVE",
      chapitres: [
        "Équation de Schrödinger",
        "Particules dans un potentiel",
        "Moment angulaire",
      ],
      matieres: ["Physique"],
      redacteurId: "prof_002",
    },
    {
      id: "3",
      titre: "Histoire Contemporaine",
      description:
        "Étude des événements historiques du 20ème siècle et leur impact sur le monde actuel",
      dateCreation: "2024-03-05",
      etat: "PUBLIE",
      references: "Histoire du monde contemporain",
      restriction: "PUBLIC",
      chapitres: ["Guerres mondiales", "Guerre froide", "Mondialisation"],
      matieres: ["Histoire"],
      redacteurId: "prof_003",
    },
    {
      id: "4",
      titre: "Programmation Web",
      description:
        "Développement d'applications web modernes avec HTML, CSS et JavaScript",
      dateCreation: "2024-03-20",
      etat: "ARCHIVE",
      references: "MDN Web Docs, JavaScript Guide",
      restriction: "PUBLIC",
      chapitres: ["HTML/CSS", "JavaScript", "Frameworks modernes"],
      matieres: ["Informatique"],
      redacteurId: "prof_004",
    },
  ]);

  // Animation values
  const fabAnimation = useRef(new Animated.Value(0)).current;
  const createCoursAnimation = useRef(new Animated.Value(0)).current;
  const programCoursAnimation = useRef(new Animated.Value(0)).current;

  const filters = [
    { id: "tous", label: "Tous" },
    { id: "publies", label: "Publiés" },
    { id: "brouillons", label: "Brouillons" },
    { id: "archives", label: "Archivés" },
  ];

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

  const handleViewDetails = (coursItem) => {
    setSelectedCours(coursItem);
    setShowDetailsModal(true);
  };

  const toggleFab = () => {
    const toValue = isFabOpen ? 0 : 1;

    Animated.parallel([
      Animated.spring(fabAnimation, {
        toValue,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.stagger(50, [
        Animated.spring(createCoursAnimation, {
          toValue,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.spring(programCoursAnimation, {
          toValue,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
      ]),
    ]).start();

    setIsFabOpen(!isFabOpen);
  };

  const closeFab = () => {
    if (isFabOpen) {
      toggleFab();
    }
  };

  const handleCreateCours = () => {
    console.log("Creating new cours...");
    closeFab();
    onNavigateToCreate();
  };

  const addNewCours = (newCours) => {
    setCours([newCours, ...cours]);
    if (onCreateCours) {
      onCreateCours(newCours);
    }
  };

  const handleProgramCours = () => {
    console.log("Programming new cours...");
    closeFab();
    // Add navigation logic here
  };

  // Filter courses based on search and active filter only
  const filteredCours = cours.filter((item) => {
    const matchesSearch =
      item.titre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      activeFilter === "tous" ||
      (activeFilter === "publies" && item.etat === "PUBLIE") ||
      (activeFilter === "brouillons" && item.etat === "BROUILLON") ||
      (activeFilter === "archives" && item.etat === "ARCHIVE");

    return matchesSearch && matchesFilter;
  });

  // Count cours by status
  const totalCours = cours.length;
  const brouillonCount = cours.filter((c) => c.etat === "BROUILLON").length;
  const publieCount = cours.filter((c) => c.etat === "PUBLIE").length;

  // Animation styles
  const fabRotation = fabAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  const createCoursTranslateY = createCoursAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -100],
  });

  const programCoursTranslateY = programCoursAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -180],
  });

  const optionScale = createCoursAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <TouchableWithoutFeedback onPress={closeFab}>
      <View style={coursStyles.container}>
        <ScrollView style={coursStyles.content}>
          {/* Header Section */}
          <View style={coursStyles.pageHeader}>
            <Text style={coursStyles.pageTitle}>Mes Cours</Text>
            <Text style={coursStyles.pageSubtitle}>
              Gérez vos cours et suivez vos programmes d'enseignement
            </Text>
          </View>

          {/* Statistics Cards */}
          <View style={coursStyles.statsContainer}>
            <View style={[coursStyles.statCard, coursStyles.totalCard]}>
              <FontAwesome5 name="book" size={24} color="#4F46E5" />
              <Text style={coursStyles.statNumber}>{totalCours}</Text>
              <Text style={coursStyles.statLabel}>Total Cours</Text>
            </View>
            <View style={[coursStyles.statCard, coursStyles.brouillonCard]}>
              <FontAwesome5 name="edit" size={24} color="#F59E0B" />
              <Text style={coursStyles.statNumber}>{brouillonCount}</Text>
              <Text style={coursStyles.statLabel}>Brouillons</Text>
            </View>
            <View style={[coursStyles.statCard, coursStyles.publieCard]}>
              <FontAwesome5 name="check-circle" size={24} color="#10B981" />
              <Text style={coursStyles.statNumber}>{publieCount}</Text>
              <Text style={coursStyles.statLabel}>Publiés</Text>
            </View>
          </View>

          {/* Filter Tabs */}
          <View style={coursStyles.filterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {filters.map((filter) => (
                <TouchableOpacity
                  key={filter.id}
                  style={[
                    coursStyles.filterTab,
                    activeFilter === filter.id && coursStyles.activeFilterTab,
                  ]}
                  onPress={() => setActiveFilter(filter.id)}
                >
                  <Text
                    style={[
                      coursStyles.filterTabText,
                      activeFilter === filter.id &&
                        coursStyles.activeFilterTabText,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Search Bar Only */}
          <View style={coursStyles.searchContainer}>
            <FontAwesome5
              name="search"
              size={16}
              color="#6B7280"
              style={coursStyles.searchIcon}
            />
            <TextInput
              style={coursStyles.searchInput}
              placeholder="Rechercher un cours..."
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Cours List */}
          <View style={coursStyles.coursList}>
            {filteredCours.map((coursItem) => (
              <View key={coursItem.id} style={coursStyles.coursCard}>
                <View style={coursStyles.coursContent}>
                  <View style={coursStyles.coursHeader}>
                    <Text style={coursStyles.coursTitle}>
                      {coursItem.titre}
                    </Text>
                    <View
                      style={[
                        coursStyles.statusBadge,
                        {
                          backgroundColor: getStatusBackground(coursItem.etat),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          coursStyles.statusText,
                          { color: getStatusColor(coursItem.etat) },
                        ]}
                      >
                        {getStatusText(coursItem.etat)}
                      </Text>
                    </View>
                  </View>
                  <Text style={coursStyles.coursDescription} numberOfLines={2}>
                    {coursItem.description}
                  </Text>
                  <Text style={coursStyles.coursDate}>
                    Créé le{" "}
                    {new Date(coursItem.dateCreation).toLocaleDateString(
                      "fr-FR"
                    )}
                  </Text>
                </View>
                {/* Action Buttons */}
                <View style={coursStyles.actionButtons}>
                  <TouchableOpacity
                    style={[coursStyles.actionButton, coursStyles.viewButton]}
                    onPress={() => handleViewDetails(coursItem)}
                  >
                    <FontAwesome5 name="eye" size={16} color="#4F46E5" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[coursStyles.actionButton, coursStyles.editButton]}
                  >
                    <FontAwesome5 name="edit" size={16} color="#F59E0B" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[coursStyles.actionButton, coursStyles.deleteButton]}
                  >
                    <FontAwesome5 name="trash" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          {/* Empty State */}
          {filteredCours.length === 0 && (
            <View style={coursStyles.emptyState}>
              <FontAwesome5 name="book-open" size={48} color="#D1D5DB" />
              <Text style={coursStyles.emptyTitle}>Aucun cours trouvé</Text>
              <Text style={coursStyles.emptyText}>
                Essayez de modifier vos critères de recherche ou créez un
                nouveau cours
              </Text>
            </View>
          )}

          {/* Extra space for bottom navigation */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Animated Floating Action Buttons */}
        <View style={coursStyles.fabContainer}>
          {/* Program Course Option - appears first (higher) */}
          <Animated.View
            style={[
              coursStyles.fabOption,
              {
                transform: [
                  { translateY: programCoursTranslateY },
                  { scale: optionScale },
                ],
              },
            ]}
          >
            <TouchableOpacity
              style={[coursStyles.optionButton, coursStyles.programButton]}
              onPress={handleProgramCours}
            >
              <FontAwesome5 name="calendar-alt" size={18} color="#FFFFFF" />
              <Text style={coursStyles.optionText}>Programmer un cours</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Create Course Option - appears second (lower) */}
          <Animated.View
            style={[
              coursStyles.fabOption,
              {
                transform: [
                  { translateY: createCoursTranslateY },
                  { scale: optionScale },
                ],
              },
            ]}
          >
            <TouchableOpacity
              style={[coursStyles.optionButton, coursStyles.createButton]}
              onPress={handleCreateCours}
            >
              <FontAwesome5 name="plus" size={18} color="#FFFFFF" />
              <Text style={coursStyles.optionText}>Créer un cours</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Main FAB */}
          <Animated.View
            style={[
              coursStyles.floatingButton,
              {
                transform: [{ rotate: fabRotation }],
              },
            ]}
          >
            <TouchableOpacity
              style={coursStyles.fabTouchable}
              onPress={toggleFab}
            >
              <FontAwesome5 name="plus" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Details Modal */}
        <Modal
          visible={showDetailsModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowDetailsModal(false)}
        >
          <View style={coursStyles.modalOverlay}>
            <View style={coursStyles.modalContainer}>
              <View style={coursStyles.modalHeader}>
                <Text style={coursStyles.modalTitle}>Détails du Cours</Text>
                <TouchableOpacity
                  onPress={() => setShowDetailsModal(false)}
                  style={coursStyles.modalCloseButton}
                >
                  <FontAwesome5 name="times" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
              {selectedCours && (
                <ScrollView style={coursStyles.modalContent}>
                  <View style={coursStyles.detailRow}>
                    <Text style={coursStyles.detailLabel}>Titre:</Text>
                    <Text style={coursStyles.detailValue}>
                      {selectedCours.titre}
                    </Text>
                  </View>
                  <View style={coursStyles.detailRow}>
                    <Text style={coursStyles.detailLabel}>Description:</Text>
                    <Text style={coursStyles.detailValue}>
                      {selectedCours.description}
                    </Text>
                  </View>
                  <View style={coursStyles.detailRow}>
                    <Text style={coursStyles.detailLabel}>
                      Date de création:
                    </Text>
                    <Text style={coursStyles.detailValue}>
                      {new Date(selectedCours.dateCreation).toLocaleDateString(
                        "fr-FR"
                      )}
                    </Text>
                  </View>
                  <View style={coursStyles.detailRow}>
                    <Text style={coursStyles.detailLabel}>État:</Text>
                    <View
                      style={[
                        coursStyles.statusBadge,
                        {
                          backgroundColor: getStatusBackground(
                            selectedCours.etat
                          ),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          coursStyles.statusText,
                          { color: getStatusColor(selectedCours.etat) },
                        ]}
                      >
                        {getStatusText(selectedCours.etat)}
                      </Text>
                    </View>
                  </View>
                  <View style={coursStyles.detailRow}>
                    <Text style={coursStyles.detailLabel}>Références:</Text>
                    <Text style={coursStyles.detailValue}>
                      {selectedCours.references}
                    </Text>
                  </View>
                  <View style={coursStyles.detailRow}>
                    <Text style={coursStyles.detailLabel}>Restriction:</Text>
                    <Text style={coursStyles.detailValue}>
                      {selectedCours.restriction}
                    </Text>
                  </View>
                  <View style={coursStyles.detailRow}>
                    <Text style={coursStyles.detailLabel}>Chapitres:</Text>
                    <Text style={coursStyles.detailValue}>
                      {selectedCours.chapitres.join(", ")}
                    </Text>
                  </View>
                  <View style={coursStyles.detailRow}>
                    <Text style={coursStyles.detailLabel}>Matières:</Text>
                    <Text style={coursStyles.detailValue}>
                      {selectedCours.matieres.join(", ")}
                    </Text>
                  </View>
                  <View style={coursStyles.detailRow}>
                    <Text style={coursStyles.detailLabel}>ID Rédacteur:</Text>
                    <Text style={coursStyles.detailValue}>
                      {selectedCours.redacteurId}
                    </Text>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
};

const coursStyles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  pageHeader: {
    marginTop: 20,
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 16,
    color: "#6B7280",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
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
  totalCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#4F46E5",
  },
  brouillonCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#F59E0B",
  },
  publieCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#10B981",
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
  filterContainer: {
    marginBottom: 16,
  },
  filterTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    marginRight: 12,
    backgroundColor: "#F3F4F6",
  },
  activeFilterTab: {
    backgroundColor: "#4F46E5",
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  activeFilterTabText: {
    color: "#FFFFFF",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
  },
  coursList: {
    marginBottom: 20,
  },
  coursCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  coursContent: {
    flex: 1,
  },
  coursHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  coursTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
    marginRight: 12,
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
  coursDescription: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 8,
    lineHeight: 20,
  },
  coursDate: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
    borderRadius: 6,
  },
  viewButton: {
    backgroundColor: "#EEF2FF",
  },
  editButton: {
    backgroundColor: "#FFFBEB",
  },
  deleteButton: {
    backgroundColor: "#FEF2F2",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  fabContainer: {
    position: "absolute",
    bottom: 120,
    right: 20,
    alignItems: "flex-end",
  },
  fabOption: {
    position: "absolute",
    bottom: 0,
    right: 0,
    marginBottom: 8,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    minWidth: 180,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  createButton: {
    backgroundColor: "#10B981",
  },
  programButton: {
    backgroundColor: "#8B5CF6",
  },
  optionText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 12,
    textAlign: "center",
  },
  floatingButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#4F46E5",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabTouchable: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
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
    maxHeight: "80%",
    width: "90%",
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
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  detailRow: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
});

export default DashboardCoursBody;
