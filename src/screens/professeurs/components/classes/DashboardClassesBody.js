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
  Alert,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import ClassCard from "./ClassCard";
import AccessRequestModal from "./AccessRequestModal";
import ClassDetails from "./ClassDetails";

const DashboardClassesBody = () => {
  const [activeFilter, setActiveFilter] = useState("toutes");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [tokenValue, setTokenValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [currentView, setCurrentView] = useState("list"); // 'list', 'details', 'create'
  const [selectedClass, setSelectedClass] = useState(null);
  const [activeDetailTab, setActiveDetailTab] = useState("info");

  // Create Class Modal State
  const [showCreateClassModal, setShowCreateClassModal] = useState(false);
  const [className, setClassName] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [selectedEstablishment, setSelectedEstablishment] = useState("");
  const [selectedModerator, setSelectedModerator] = useState("");
  const [showLevelDropdown, setShowLevelDropdown] = useState(false);
  const [showEstablishmentDropdown, setShowEstablishmentDropdown] =
    useState(false);
  const [showModeratorDropdown, setShowModeratorDropdown] = useState(false);

  // Animation values
  const loadingAnimation = useRef(new Animated.Value(0)).current;
  const successAnimation = useRef(new Animated.Value(0)).current;

  const levels = [
    "CP (Cours Préparatoire)",
    "CE1 (Cours Élémentaire 1)",
    "CE2 (Cours Élémentaire 2)",
    "CM1 (Cours Moyen 1)",
    "CM2 (Cours Moyen 2)",
    "6ème",
    "5ème",
    "4ème",
    "3ème",
    "2nde (Seconde)",
    "1ère (Première)",
    "Terminale",
  ];

  const establishments = [
    "Aucun établissement (Optionnel)",
    "Etablissement A - Yaoundé",
    "Etablissement B - Douala",
  ];

  const moderators = [
    "Aucun modérateur (Optionnel)",
    "Marie Dupont",
    "Lucas Martin",
    "Isabelle Lefevre",
    "Test Professor",
  ];

  const [classes, setClasses] = useState([
    {
      id: "1",
      name: "Terminale C1",
      level: "Terminale",
      state: "ACTIVE",
      studentsCount: 35,
      parentsCount: 28,
      creationDate: "2024-01-15",
      description: "Classe de Terminale spécialisée en sciences",
      etablissement: "Lycée Jean-Baptiste Nzeyimana",
      moderator: "Prof. Marie Dupont",
      teacherRights: "Droit de publication",
      students: [
        { id: 1, name: "Jean Mballa", email: "jean.mballa@student.edu" },
        { id: 2, name: "Sarah Fouda", email: "sarah.fouda@student.edu" },
        { id: 3, name: "Pierre Ngomo", email: "pierre.ngomo@student.edu" },
      ],
      parents: [
        { id: 1, name: "Dr. Mballa Senior", phone: "+237 123 456 789" },
        { id: 2, name: "Mme Fouda Catherine", phone: "+237 987 654 321" },
        { id: 3, name: "M. Ngomo Paul", phone: "+237 555 123 456" },
      ],
      accessRequests: [
        {
          id: 1,
          name: "Prof. Antoine Biya",
          role: "Professeur",
          date: "2024-03-20",
          status: "pending",
        },
        {
          id: 2,
          name: "Mme Essomba Marie",
          role: "Parent",
          date: "2024-03-19",
          status: "pending",
        },
      ],
    },
    {
      id: "2",
      name: "Seconde A2",
      level: "Seconde",
      state: "ACTIVE",
      studentsCount: 42,
      parentsCount: 38,
      creationDate: "2024-02-10",
      description: "Classe de Seconde générale",
      etablissement: "Lycée Jean-Baptiste Nzeyimana",
      moderator: "Prof. Paul Martin",
      teacherRights: "Lecture seule",
      students: [],
      parents: [],
      accessRequests: [],
    },
    {
      id: "3",
      name: "Première D1",
      level: "Première",
      state: "INACTIVE",
      studentsCount: 28,
      parentsCount: 25,
      creationDate: "2024-01-20",
      description: "Classe de Première spécialisée en littérature",
      etablissement: "Lycée Jean-Baptiste Nzeyimana",
      moderator: "Prof. Sophie Bernard",
      teacherRights: "Droit de publication",
      students: [],
      parents: [],
      accessRequests: [],
    },
  ]);

  const filters = [
    { id: "toutes", label: "Toutes" },
    { id: "actives", label: "Actives" },
    { id: "inactives", label: "Inactives" },
    { id: "mes-classes", label: "Mes Classes" },
  ];

  const getStateColor = (state) => {
    return state === "ACTIVE" ? "#10B981" : "#6B7280";
  };

  const getStateBackground = (state) => {
    return state === "ACTIVE" ? "#D1FAE5" : "#F3F4F6";
  };

  const getStateText = (state) => {
    return state === "ACTIVE" ? "Active" : "Inactive";
  };

  const handleRequestAccess = () => {
    setShowAccessModal(true);
  };

  const handleCancelRequest = () => {
    setShowAccessModal(false);
    setTokenValue("");
    setIsLoading(false);
    setShowSuccess(false);
  };

  const handleValidateToken = () => {
    if (!tokenValue.trim()) {
      Alert.alert("Erreur", "Veuillez entrer un token valide");
      return;
    }
    setIsLoading(true);
    // Start loading animation
    Animated.loop(
      Animated.timing(loadingAnimation, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setShowSuccess(true);
      // Start success animation
      Animated.sequence([
        Animated.timing(successAnimation, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.delay(2000),
        Animated.timing(successAnimation, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowAccessModal(false);
        setTokenValue("");
        setShowSuccess(false);
        loadingAnimation.setValue(0);
        successAnimation.setValue(0);
      });
    }, 3000);
  };

  const handleViewDetails = (classItem) => {
    setSelectedClass(classItem);
    setCurrentView("details");
  };

  const handleManageClass = (classItem) => {
    setSelectedClass(classItem);
    setCurrentView("details");
    setActiveDetailTab("manage");
  };

  const handleBackToList = () => {
    setCurrentView("list");
    setSelectedClass(null);
    setActiveDetailTab("info");
  };

  const handleCreateClass = () => {
    setShowCreateClassModal(true);
  };

  const generateActivationCode = () => {
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    setActivationCode(randomCode);
  };

  const handleCreateNewClass = () => {
    if (!className.trim() || !selectedLevel || !activationCode.trim()) {
      Alert.alert(
        "Erreur",
        "Veuillez remplir tous les champs obligatoires (*)"
      );
      return;
    }

    const newClass = {
      id: Date.now().toString(),
      name: className,
      level: selectedLevel,
      state: "PENDING_APPROVAL",
      activationCode,
      etablissement: selectedEstablishment || "Non spécifié",
      moderator: selectedModerator || "Non spécifié",
      studentsCount: 0,
      parentsCount: 0,
      creationDate: new Date().toISOString(),
      description: "",
      students: [],
      parents: [],
      accessRequests: [],
    };

    setClasses((prevClasses) => [newClass, ...prevClasses]);
    setShowCreateClassModal(false);
    setClassName("");
    setSelectedLevel("");
    setActivationCode("");
    setSelectedEstablishment("");
    setSelectedModerator("");
  };

  // Filter classes
  const filteredClasses = classes.filter((classItem) => {
    const matchesSearch =
      classItem.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      classItem.level.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      activeFilter === "toutes" ||
      (activeFilter === "actives" && classItem.state === "ACTIVE") ||
      (activeFilter === "inactives" && classItem.state === "INACTIVE") ||
      (activeFilter === "mes-classes" && true);
    return matchesSearch && matchesFilter;
  });

  // Loading animation styles
  const loadingRotation = loadingAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  if (currentView === "details" && selectedClass) {
    return (
      <ClassDetails
        selectedClass={selectedClass}
        onBack={handleBackToList}
        activeDetailTab={activeDetailTab}
        setActiveDetailTab={setActiveDetailTab}
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Header Section */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Mes Classes</Text>
          <Text style={styles.pageSubtitle}>
            Gérez et supervisez les classes auxquelles vous avez accès
          </Text>
        </View>
        {/* Access Request Button */}
        <TouchableOpacity
          style={styles.accessButton}
          onPress={handleRequestAccess}
        >
          <FontAwesome5 name="key" size={16} color="#FFFFFF" />
          <Text style={styles.accessButtonText}>
            Demander l'accès à une classe
          </Text>
        </TouchableOpacity>
        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {filters.map((filter) => (
              <TouchableOpacity
                key={filter.id}
                style={[
                  styles.filterTab,
                  activeFilter === filter.id && styles.activeFilterTab,
                ]}
                onPress={() => setActiveFilter(filter.id)}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    activeFilter === filter.id && styles.activeFilterTabText,
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <FontAwesome5
            name="search"
            size={16}
            color="#6B7280"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une classe..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholderTextColor="#9CA3AF"
          />
        </View>
        {/* Classes List */}
        <View style={styles.classesList}>
          {filteredClasses.map((classItem) => (
            <ClassCard
              key={classItem.id}
              classItem={classItem}
              onViewDetails={handleViewDetails}
              onManageClass={handleManageClass}
            />
          ))}
        </View>
        {/* Empty State */}
        {filteredClasses.length === 0 && (
          <View style={styles.emptyState}>
            <FontAwesome5 name="school" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Aucune classe trouvée</Text>
            <Text style={styles.emptyText}>
              Essayez de modifier vos critères de recherche ou demandez l'accès
              à une nouvelle classe
            </Text>
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={handleCreateClass}
      >
        <FontAwesome5 name="plus" size={24} color="#FFFFFF" />
      </TouchableOpacity>
      {/* Access Request Modal */}
      <AccessRequestModal
        visible={showAccessModal}
        onClose={handleCancelRequest}
        onCancel={handleCancelRequest}
        onValidate={handleValidateToken}
        tokenValue={tokenValue}
        setTokenValue={setTokenValue}
        isLoading={isLoading}
        showSuccess={showSuccess}
        loadingAnimation={loadingAnimation}
        successAnimation={successAnimation}
      />
      {/* Create Class Modal */}
      <Modal
        visible={showCreateClassModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowCreateClassModal(false)}
      >
        <View style={styles.createModalContainer}>
          <ScrollView contentContainerStyle={styles.createModalScrollContainer}>
            {/* Header */}
            <View style={styles.createModalHeader}>
              <Text style={styles.createModalTitle}>Créer une Classe</Text>
              <Text style={styles.createModalSubtitle}>
                Ajoutez une nouvelle classe à votre système
              </Text>
              <TouchableOpacity
                style={styles.createModalCloseButton}
                onPress={() => setShowCreateClassModal(false)}
              >
                <FontAwesome5 name="times" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Form Fields */}
            <View style={styles.createFormContainer}>
              {/* Class Name */}
              <View style={styles.createFormField}>
                <Text style={styles.createFieldLabel}>Nom de la classe *</Text>
                <TextInput
                  style={styles.createTextInput}
                  placeholder="Ex: Terminale C1"
                  value={className}
                  onChangeText={setClassName}
                />
              </View>

              {/* Level Selection */}
              <View style={styles.createFormField}>
                <Text style={styles.createFieldLabel}>Niveau *</Text>
                <TouchableOpacity
                  style={styles.createDropdownButton}
                  onPress={() => setShowLevelDropdown(!showLevelDropdown)}
                >
                  <Text style={styles.createDropdownText}>
                    {selectedLevel || "Sélectionner un niveau"}
                  </Text>
                  <FontAwesome5 name="chevron-down" size={16} color="#6B7280" />
                </TouchableOpacity>
                {showLevelDropdown && (
                  <View style={styles.createDropdownOptions}>
                    {levels.map((level) => (
                      <TouchableOpacity
                        key={level}
                        style={styles.createDropdownOption}
                        onPress={() => {
                          setSelectedLevel(level);
                          setShowLevelDropdown(false);
                        }}
                      >
                        <Text style={styles.createDropdownOptionText}>
                          {level}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Activation Code */}
              <View style={styles.createFormField}>
                <Text style={styles.createFieldLabel}>Code d'activation *</Text>
                <View style={styles.createCodeContainer}>
                  <TextInput
                    style={styles.createTextInput}
                    placeholder="Code d'activation"
                    value={activationCode}
                    onChangeText={setActivationCode}
                  />
                  <TouchableOpacity
                    style={styles.createGenerateButton}
                    onPress={generateActivationCode}
                  >
                    <Text style={styles.createGenerateButtonText}>Générer</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Establishment Selection */}
              <View style={styles.createFormField}>
                <Text style={styles.createFieldLabel}>
                  Établissement (Optionnel)
                </Text>
                <TouchableOpacity
                  style={styles.createDropdownButton}
                  onPress={() =>
                    setShowEstablishmentDropdown(!showEstablishmentDropdown)
                  }
                >
                  <Text style={styles.createDropdownText}>
                    {selectedEstablishment || "Aucun établissement (Optionnel)"}
                  </Text>
                  <FontAwesome5 name="chevron-down" size={16} color="#6B7280" />
                </TouchableOpacity>
                {showEstablishmentDropdown && (
                  <View style={styles.createDropdownOptions}>
                    {establishments.map((establishment) => (
                      <TouchableOpacity
                        key={establishment}
                        style={styles.createDropdownOption}
                        onPress={() => {
                          setSelectedEstablishment(establishment);
                          setShowEstablishmentDropdown(false);
                        }}
                      >
                        <Text style={styles.createDropdownOptionText}>
                          {establishment}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Moderator Selection */}
              <View style={styles.createFormField}>
                <Text style={styles.createFieldLabel}>
                  Modérateur (Optionnel)
                </Text>
                <TouchableOpacity
                  style={styles.createDropdownButton}
                  onPress={() =>
                    setShowModeratorDropdown(!showModeratorDropdown)
                  }
                >
                  <Text style={styles.createDropdownText}>
                    {selectedModerator || "Aucun modérateur (Optionnel)"}
                  </Text>
                  <FontAwesome5 name="chevron-down" size={16} color="#6B7280" />
                </TouchableOpacity>
                {showModeratorDropdown && (
                  <View style={styles.createDropdownOptions}>
                    {moderators.map((moderator) => (
                      <TouchableOpacity
                        key={moderator}
                        style={styles.createDropdownOption}
                        onPress={() => {
                          setSelectedModerator(moderator);
                          setShowModeratorDropdown(false);
                        }}
                      >
                        <Text style={styles.createDropdownOptionText}>
                          {moderator}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Important Information */}
              <View style={styles.createInfoBox}>
                <Text style={styles.createInfoTitle}>
                  Information importante
                </Text>
                <Text style={styles.createInfoText}>
                  • La classe sera créée avec le statut "En attente
                  d'approbation"
                </Text>
                <Text style={styles.createInfoText}>
                  • Le code d'activation permet aux utilisateurs de rejoindre la
                  classe
                </Text>
                <Text style={styles.createInfoText}>
                  • Vous pourrez ajouter des parents et élèves après la création
                </Text>
                <Text style={styles.createInfoText}>
                  • Vous recevrez automatiquement les droits de publication pour
                  cette classe
                </Text>
                <Text style={styles.createInfoText}>
                  • Les champs marqués avec * sont obligatoires
                </Text>
              </View>

              {/* Create Button */}
              <TouchableOpacity
                style={styles.createButton}
                onPress={handleCreateNewClass}
              >
                <Text style={styles.createButtonText}>Créer la classe</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
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
  accessButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4F46E5",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  accessButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
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
  classesList: {
    marginBottom: 20,
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
    lineHeight: 20,
  },
  floatingButton: {
    position: "absolute",
    bottom: 120,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  // Create Class Modal Styles
  createModalContainer: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    padding: 20,
  },
  createModalScrollContainer: {
    paddingBottom: 20,
  },
  createModalHeader: {
    marginBottom: 20,
  },
  createModalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  createModalSubtitle: {
    fontSize: 16,
    color: "#6B7280",
  },
  createModalCloseButton: {
    position: "absolute",
    top: 10,
    right: 10,
    padding: 8,
  },
  createFormContainer: {
    marginBottom: 20,
  },
  createFormField: {
    marginBottom: 16,
  },
  createFieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  createTextInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#111827",
  },
  createDropdownButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  createDropdownText: {
    fontSize: 16,
    color: "#6B7280",
  },
  createDropdownOptions: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    marginTop: 8,
    maxHeight: 200,
    overflow: "hidden",
  },
  createDropdownOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  createDropdownOptionText: {
    fontSize: 16,
    color: "#111827",
  },
  createCodeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  createGenerateButton: {
    backgroundColor: "#4F46E5",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 8,
  },
  createGenerateButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  createInfoBox: {
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  createInfoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  createInfoText: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  createButton: {
    backgroundColor: "#4F46E5",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  createButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default DashboardClassesBody;
