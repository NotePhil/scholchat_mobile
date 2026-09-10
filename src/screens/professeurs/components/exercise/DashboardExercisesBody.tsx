import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
  TextInput,
  Alert,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useUser } from "../../../../context/UserContext";
import { exerciseService } from "../../../../services/api";
import { LoadingSpinner } from "../../../../components/ui";
import CreateExerciseView from "./CreateExerciseView";
import ScheduleExerciseView from "./ScheduleExerciseView";
import ExerciseCorrectionsView from "./ExerciseCorrectionsView";
import ExerciseDetailView from "./ExerciseDetailView";

interface Exercise {
  id: string;
  titre: string;
  nom: string;
  description: string;
  dateCreation: string;
  etat: string;
  restriction: string;
  niveau: string;
}

const mapApiExercise = (raw: Record<string, any>): Exercise => ({
  id: raw.id,
  titre: raw.titre ?? raw.nom ?? "Sans titre",
  nom: raw.titre ?? raw.nom ?? "Sans titre",
  description: raw.description ?? "",
  dateCreation: raw.dateCreation
    ? new Date(raw.dateCreation).toLocaleDateString("fr-FR")
    : new Date().toLocaleDateString("fr-FR"),
  etat: raw.etat ?? "BROUILLON",
  restriction: raw.restriction ?? "Aucune",
  niveau: raw.niveau ?? "-",
});

const DashboardExercisesBody = () => {
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("tous");
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  type ViewMode = "list" | "create" | "schedule" | "corrections" | "detail";
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);

  const loadExercises = useCallback(async () => {
    if (!user?.userId) return;
    setLoading(true);
    setError("");
    try {
      const data = await exerciseService.getByProfessor(user.userId);
      setExercises(data.map(mapApiExercise));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du chargement des exercices.");
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    loadExercises();
  }, [loadExercises]);

  const handleDeleteExercise = (exercise: Exercise) => {
    Alert.alert("Supprimer l'exercice", `Voulez-vous vraiment supprimer "${exercise.nom}" ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await exerciseService.remove(exercise.id);
            setExercises((prev) => prev.filter((e) => e.id !== exercise.id));
          } catch (err) {
            Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la suppression.");
          }
        },
      },
    ]);
  };

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

  const getStatusColor = (etat: string) => {
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

  const getStatusBackground = (etat: string) => {
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
    closeFab();
    setEditingExercise(null);
    setViewMode("create");
  };

  const handleProgramExercise = () => {
    closeFab();
    setViewMode("schedule");
  };

  // Animation styles
  const fabRotation = fabAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  const createExerciseTranslateY = createExerciseAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -68],
  });

  const programExerciseTranslateY = programExerciseAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -136],
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

    const etat = item.etat.toLowerCase();
    const matchesFilter =
      activeFilter === "tous" ||
      (activeFilter === "actifs" && etat === "actif") ||
      (activeFilter === "programmes" && etat.startsWith("programm")) ||
      (activeFilter === "brouillons" && etat === "brouillon") ||
      (activeFilter === "termines" && etat.startsWith("termin"));

    return matchesSearch && matchesFilter;
  });

  if (viewMode === "create") {
    return (
      <CreateExerciseView
        editingExercise={editingExercise}
        onBack={() => {
          setEditingExercise(null);
          setViewMode("list");
        }}
        onCreated={() => {
          setEditingExercise(null);
          setViewMode("list");
          loadExercises();
        }}
      />
    );
  }

  if (viewMode === "schedule") {
    return (
      <ScheduleExerciseView
        exercises={exercises}
        onBack={() => setViewMode("list")}
        onScheduled={() => {
          setViewMode("list");
          loadExercises();
        }}
      />
    );
  }

  if (viewMode === "corrections") {
    return (
      <ExerciseCorrectionsView
        onBack={() => setViewMode("list")}
      />
    );
  }

  if (viewMode === "detail" && selectedExercise) {
    return (
      <ExerciseDetailView
        exercise={selectedExercise}
        onBack={() => {
          setSelectedExercise(null);
          setViewMode("list");
        }}
        onEdit={() => {
          setEditingExercise(selectedExercise);
          setViewMode("create");
        }}
        onSchedule={() => {
          setViewMode("schedule");
        }}
        onDelete={() => {
          handleDeleteExercise(selectedExercise);
          setSelectedExercise(null);
          setViewMode("list");
        }}
      />
    );
  }

  return (
    <View style={exercisesStyles.container}>
      <ScrollView
        style={exercisesStyles.content}
        contentContainerStyle={{ paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
      >
          {/* Header Section */}
          <View style={exercisesStyles.pageHeader}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <Text style={exercisesStyles.pageTitle}>Exercices</Text>
                <Text style={exercisesStyles.pageSubtitle}>
                  Gérez vos exercices et devoirs
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setViewMode("corrections")}
                style={{ padding: 8, backgroundColor: "#EEF2FF", borderRadius: 20 }}
              >
                <FontAwesome5 name="clipboard-check" size={18} color="#4F46E5" />
              </TouchableOpacity>
            </View>
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

          {error ? <Text style={{ color: "#EF4444", marginBottom: 12 }}>{error}</Text> : null}
          {loading ? <LoadingSpinner label="Chargement des exercices..." /> : null}

          {/* Exercises List */}
          <View style={exercisesStyles.exercisesList}>
            {!loading && filteredExercises.map((exercise) => (
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
                  <TouchableOpacity
                    style={exercisesStyles.actionButton}
                    onPress={() => {
                      setEditingExercise(exercise);
                      setViewMode("create");
                    }}
                  >
                    <FontAwesome5 name="edit" size={16} color="#4F46E5" />
                    <Text style={exercisesStyles.actionButtonText}>
                      Modifier
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={exercisesStyles.actionButton}
                    onPress={() => {
                      setSelectedExercise(exercise);
                      setViewMode("detail");
                    }}
                  >
                    <FontAwesome5 name="eye" size={16} color="#10B981" />
                    <Text style={exercisesStyles.actionButtonText}>Voir</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={exercisesStyles.actionButton}
                    onPress={() => handleDeleteExercise(exercise)}
                  >
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
          {!loading && filteredExercises.length === 0 && (
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

      {/* FAB Backdrop */}
      {isFabOpen && (
        <TouchableWithoutFeedback onPress={closeFab}>
          <View style={exercisesStyles.fabBackdrop} />
        </TouchableWithoutFeedback>
      )}

      {/* Animated Floating Action Buttons */}
      <View style={exercisesStyles.fabContainer} pointerEvents="box-none">
        {/* Program Exercise Option */}
        <Animated.View
          style={[
            exercisesStyles.fabOption,
            {
              transform: [
                { translateY: programExerciseTranslateY },
                { scale: optionScale },
              ],
              opacity: optionScale,
            },
          ]}
          pointerEvents={isFabOpen ? "auto" : "none"}
        >
          <TouchableOpacity
            style={exercisesStyles.speedDialCard}
            onPress={handleProgramExercise}
            activeOpacity={0.85}
          >
            <View style={[exercisesStyles.speedDialIconBadge, { backgroundColor: "#F3F4F6", borderColor: "#E5E7EB" }]}>
              <FontAwesome5 name="calendar-alt" size={14} color="#0D9488" />
            </View>
            <View style={exercisesStyles.speedDialTextContainer}>
              <Text style={exercisesStyles.speedDialTitle}>Programmer un exercice</Text>
              <Text style={exercisesStyles.speedDialSubtitle}>Assigner à une classe</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={10} color="#CBD5E1" />
          </TouchableOpacity>
        </Animated.View>

        {/* Create Exercise Option */}
        <Animated.View
          style={[
            exercisesStyles.fabOption,
            {
              transform: [
                { translateY: createExerciseTranslateY },
                { scale: optionScale },
              ],
              opacity: optionScale,
            },
          ]}
          pointerEvents={isFabOpen ? "auto" : "none"}
        >
          <TouchableOpacity
            style={exercisesStyles.speedDialCard}
            onPress={handleCreateExercise}
            activeOpacity={0.85}
          >
            <View style={[exercisesStyles.speedDialIconBadge, { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }]}>
              <FontAwesome5 name="plus" size={14} color="#059669" />
            </View>
            <View style={exercisesStyles.speedDialTextContainer}>
              <Text style={exercisesStyles.speedDialTitle}>Créer un exercice</Text>
              <Text style={exercisesStyles.speedDialSubtitle}>QCM ou devoir à faire</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={10} color="#CBD5E1" />
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
            activeOpacity={0.85}
          >
            <FontAwesome5 name="plus" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
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
  fabBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    zIndex: 10,
  },
  fabContainer: {
    position: "absolute",
    bottom: 110,
    right: 20,
    alignItems: "flex-end",
    zIndex: 20,
  },
  fabOption: {
    position: "absolute",
    bottom: 0,
    right: 0,
  },
  speedDialCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
    gap: 12,
    minWidth: 235,
  },
  speedDialIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  speedDialTextContainer: {
    flex: 1,
  },
  speedDialTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  speedDialSubtitle: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 1,
  },
  floatingButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#4F46E5",
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
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
