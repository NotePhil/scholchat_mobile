import React, { useState, useRef } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
  TextInput,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

const DashboardExercisesBody = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("tous");
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [exercises, setExercises] = useState([
    {
      id: 1,
      nom: "Équations du second degré",
      description:
        "Résolution d'équations quadratiques avec méthode discriminant",
      dateCreation: "15/12/2024",
      etat: "Actif",
      restriction: "Niveau 3ème uniquement",
      niveau: "3ème",
    },
    {
      id: 2,
      nom: "Analyse grammaticale",
      description:
        "Identification des fonctions grammaticales dans une phrase complexe",
      dateCreation: "12/12/2024",
      etat: "Programmé",
      restriction: "Classes A et B",
      niveau: "2nde",
    },
    {
      id: 3,
      nom: "Réactions chimiques",
      description:
        "Équilibrage d'équations chimiques et calculs stœchiométriques",
      dateCreation: "10/12/2024",
      etat: "Terminé",
      restriction: "Aucune",
      niveau: "1ère S",
    },
    {
      id: 4,
      nom: "Théorème de Pythagore",
      description:
        "Application du théorème dans des situations géométriques variées",
      dateCreation: "08/12/2024",
      etat: "Brouillon",
      restriction: "Groupes de soutien",
      niveau: "4ème",
    },
  ]);

  // Animation values
  const fabAnimation = useRef(new Animated.Value(0)).current;
  const createExerciseAnimation = useRef(new Animated.Value(0)).current;
  const programExerciseAnimation = useRef(new Animated.Value(0)).current;

  const filters = [
    { id: "tous", label: "Tous" },
    { id: "actifs", label: "Actifs" },
    { id: "programmes", label: "Programmés" },
    { id: "brouillons", label: "Brouillons" },
    { id: "termines", label: "Terminés" },
  ];

  const getStatusColor = (etat) => {
    switch (etat.toLowerCase()) {
      case "actif":
        return "#10B981";
      case "programmé":
        return "#3B82F6";
      case "terminé":
        return "#6B7280";
      case "brouillon":
        return "#F59E0B";
      default:
        return "#6B7280";
    }
  };

  const getStatusBackground = (etat) => {
    switch (etat.toLowerCase()) {
      case "actif":
        return "#D1FAE5";
      case "programmé":
        return "#DBEAFE";
      case "terminé":
        return "#F3F4F6";
      case "brouillon":
        return "#FEF3C7";
      default:
        return "#F3F4F6";
    }
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
        Animated.spring(createExerciseAnimation, {
          toValue,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.spring(programExerciseAnimation, {
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

  const handleCreateExercise = () => {
    console.log("Creating new exercise...");
    closeFab();
    // Add navigation logic here
  };

  const handleProgramExercise = () => {
    console.log("Programming new exercise...");
    closeFab();
    // Add navigation logic here
  };

  // Animation styles
  const fabRotation = fabAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  const createExerciseTranslateY = createExerciseAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -100],
  });

  const programExerciseTranslateY = programExerciseAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -180],
  });

  const optionScale = createExerciseAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  // Filter exercises based on search and active filter
  const filteredExercises = exercises.filter((item) => {
    const matchesSearch =
      item.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.niveau.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      activeFilter === "tous" ||
      (activeFilter === "actifs" && item.etat.toLowerCase() === "actif") ||
      (activeFilter === "programmes" &&
        item.etat.toLowerCase() === "programmé") ||
      (activeFilter === "brouillons" &&
        item.etat.toLowerCase() === "brouillon") ||
      (activeFilter === "termines" && item.etat.toLowerCase() === "terminé");

    return matchesSearch && matchesFilter;
  });

  return (
    <TouchableWithoutFeedback onPress={closeFab}>
      <View style={exercisesStyles.container}>
        <ScrollView style={exercisesStyles.content}>
          {/* Header Section */}
          <View style={exercisesStyles.pageHeader}>
            <Text style={exercisesStyles.pageTitle}>Exercices</Text>
            <Text style={exercisesStyles.pageSubtitle}>
              Gérez vos exercices et devoirs
            </Text>
          </View>

          {/* Filter Tabs */}
          <View style={exercisesStyles.filterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {filters.map((filter) => (
                <TouchableOpacity
                  key={filter.id}
                  style={[
                    exercisesStyles.filterTab,
                    activeFilter === filter.id &&
                      exercisesStyles.activeFilterTab,
                  ]}
                  onPress={() => setActiveFilter(filter.id)}
                >
                  <Text
                    style={[
                      exercisesStyles.filterTabText,
                      activeFilter === filter.id &&
                        exercisesStyles.activeFilterTabText,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Search Bar */}
          <View style={exercisesStyles.searchContainer}>
            <FontAwesome5
              name="search"
              size={16}
              color="#6B7280"
              style={exercisesStyles.searchIcon}
            />
            <TextInput
              style={exercisesStyles.searchInput}
              placeholder="Rechercher un exercice..."
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Exercises List */}
          <View style={exercisesStyles.exercisesList}>
            {filteredExercises.map((exercise) => (
              <View key={exercise.id} style={exercisesStyles.exerciseCard}>
                {/* Exercise Header */}
                <View style={exercisesStyles.exerciseHeader}>
                  <Text style={exercisesStyles.exerciseName}>
                    {exercise.nom}
                  </Text>
                  <View
                    style={[
                      exercisesStyles.statusBadge,
                      { backgroundColor: getStatusBackground(exercise.etat) },
                    ]}
                  >
                    <Text
                      style={[
                        exercisesStyles.statusText,
                        { color: getStatusColor(exercise.etat) },
                      ]}
                    >
                      {exercise.etat}
                    </Text>
                  </View>
                </View>

                {/* Exercise Description */}
                <Text style={exercisesStyles.exerciseDescription}>
                  {exercise.description}
                </Text>

                {/* Exercise Details */}
                <View style={exercisesStyles.exerciseDetails}>
                  <View style={exercisesStyles.detailRow}>
                    <FontAwesome5
                      name="calendar-alt"
                      size={14}
                      color="#6B7280"
                    />
                    <Text style={exercisesStyles.detailText}>
                      Créé le {exercise.dateCreation}
                    </Text>
                  </View>

                  <View style={exercisesStyles.detailRow}>
                    <FontAwesome5
                      name="graduation-cap"
                      size={14}
                      color="#6B7280"
                    />
                    <Text style={exercisesStyles.detailText}>
                      Niveau: {exercise.niveau}
                    </Text>
                  </View>

                  <View style={exercisesStyles.detailRow}>
                    <FontAwesome5 name="lock" size={14} color="#6B7280" />
                    <Text style={exercisesStyles.detailText}>
                      {exercise.restriction}
                    </Text>
                  </View>
                </View>

                {/* Exercise Actions */}
                <View style={exercisesStyles.exerciseActions}>
                  <TouchableOpacity style={exercisesStyles.actionButton}>
                    <FontAwesome5 name="edit" size={16} color="#4F46E5" />
                    <Text style={exercisesStyles.actionButtonText}>
                      Modifier
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={exercisesStyles.actionButton}>
                    <FontAwesome5 name="eye" size={16} color="#10B981" />
                    <Text style={exercisesStyles.actionButtonText}>Voir</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={exercisesStyles.actionButton}>
                    <FontAwesome5 name="trash" size={16} color="#EF4444" />
                    <Text style={exercisesStyles.actionButtonText}>
                      Supprimer
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          {/* Empty State */}
          {filteredExercises.length === 0 && (
            <View style={exercisesStyles.emptyState}>
              <FontAwesome5 name="clipboard-list" size={48} color="#D1D5DB" />
              <Text style={exercisesStyles.emptyTitle}>
                Aucun exercice trouvé
              </Text>
              <Text style={exercisesStyles.emptyText}>
                Essayez de modifier vos critères de recherche ou créez un
                nouveau exercice
              </Text>
            </View>
          )}

          {/* Extra space for bottom navigation */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Animated Floating Action Buttons */}
        <View style={exercisesStyles.fabContainer}>
          {/* Program Exercise Option - appears first (higher) */}
          <Animated.View
            style={[
              exercisesStyles.fabOption,
              {
                transform: [
                  { translateY: programExerciseTranslateY },
                  { scale: optionScale },
                ],
              },
            ]}
          >
            <TouchableOpacity
              style={[
                exercisesStyles.optionButton,
                exercisesStyles.programButton,
              ]}
              onPress={handleProgramExercise}
            >
              <FontAwesome5 name="clock" size={18} color="#FFFFFF" />
              <Text style={exercisesStyles.optionText}>
                Programmer un exercice
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Create Exercise Option - appears second (lower) */}
          <Animated.View
            style={[
              exercisesStyles.fabOption,
              {
                transform: [
                  { translateY: createExerciseTranslateY },
                  { scale: optionScale },
                ],
              },
            ]}
          >
            <TouchableOpacity
              style={[
                exercisesStyles.optionButton,
                exercisesStyles.createButton,
              ]}
              onPress={handleCreateExercise}
            >
              <FontAwesome5 name="plus-circle" size={18} color="#FFFFFF" />
              <Text style={exercisesStyles.optionText}>Créer un exercice</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Main FAB */}
          <Animated.View
            style={[
              exercisesStyles.floatingButton,
              {
                transform: [{ rotate: fabRotation }],
              },
            ]}
          >
            <TouchableOpacity
              style={exercisesStyles.fabTouchable}
              onPress={toggleFab}
            >
              <FontAwesome5 name="plus" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
};

const exercisesStyles = StyleSheet.create({
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
  exercisesList: {
    marginBottom: 20,
  },
  exerciseCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  exerciseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  exerciseDescription: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
    marginBottom: 16,
  },
  exerciseDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  detailText: {
    fontSize: 13,
    color: "#6B7280",
    marginLeft: 8,
  },
  exerciseActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: "#F9FAFB",
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 6,
    color: "#374151",
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
    minWidth: 200,
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
});

export default DashboardExercisesBody;
