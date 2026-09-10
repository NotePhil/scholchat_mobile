import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
  Alert,
  Share,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useUser } from "../../../../context/UserContext";
import { coursService } from "../../../../services/api";
import { LoadingSpinner } from "../../../../components/ui";
import { CoursProgrammerScreen } from "./CoursProgrammerScreen";
import CourseDetailView from "./CourseDetailView";

export interface ChapitreImage {
  id: string;
  uri: string;
  name: string;
}

export interface ChapitreLink {
  id: string;
  url: string;
  title: string;
}

export interface Chapitre {
  id: number | string;
  title: string;
  description: string;
  content: string;
  images: ChapitreImage[];
  links: ChapitreLink[];
  isExpanded: boolean;
}

export interface Cours {
  id: string;
  titre: string;
  description: string;
  dateCreation: string;
  etat: string;
  references: string;
  restriction: string;
  chapitres: string[];
  chapitresDetailles?: Chapitre[];
  matieres: string[];
  redacteurId: string;
}

interface DashboardCoursBodyProps {
  onNavigateToCreate: () => void;
  onCreateCours?: (cours: Cours) => void;
  onEditCours: (cours: Cours) => void;
}

/** Backend Cours shape isn't guaranteed field-for-field, so map defensively. */
const mapApiCoursToUiCours = (raw: Record<string, any>): Cours => ({
  id: raw.id,
  titre: raw.titre ?? raw.nom ?? "Sans titre",
  description: raw.description ?? "",
  dateCreation: raw.dateCreation ?? raw.createdAt ?? new Date().toISOString(),
  etat: raw.etat ?? "BROUILLON",
  references: raw.references ?? "",
  restriction: raw.restriction ?? "PUBLIC",
  chapitres: Array.isArray(raw.chapitres)
    ? raw.chapitres.map((c: any) => (typeof c === "string" ? c : c?.titre ?? ""))
    : [],
  matieres: Array.isArray(raw.matieres)
    ? raw.matieres
    : raw.matiereId
    ? [raw.matiereId]
    : [],
  redacteurId: raw.redacteurId ?? raw.professeurId ?? "",
});

const getInitials = (title: string): string => {
  if (!title) return "CO";
  const words = title.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return title.slice(0, 2).toUpperCase();
};

const DashboardCoursBody = ({ onNavigateToCreate, onEditCours }: DashboardCoursBodyProps) => {
  const { user } = useUser();
  const navigation = useNavigation<any>();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("tous");
  type CoursViewMode = "list" | "detail" | "schedule";
  const [viewMode, setViewMode] = useState<CoursViewMode>("list");
  const [selectedCours, setSelectedCours] = useState<Cours | null>(null);
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [cours, setCours] = useState<Cours[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCours = useCallback(async () => {
    if (!user?.userId) return;
    setLoading(true);
    setError("");
    try {
      const data = await coursService.getByProfessor(user.userId);
      setCours(data.map(mapApiCoursToUiCours));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du chargement des cours.");
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    loadCours();
  }, [loadCours]);

  const handleDeleteCours = (coursItem: Cours) => {
    Alert.alert("Supprimer le cours", `Voulez-vous vraiment supprimer "${coursItem.titre}" ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await coursService.remove(coursItem.id);
            setCours((prev) => prev.filter((c) => c.id !== coursItem.id));
          } catch (err) {
            Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la suppression.");
          }
        },
      },
    ]);
  };

  const handleShareCours = async (coursItem: Cours) => {
    try {
      await Share.share({
        title: coursItem.titre,
        message: `Cours : ${coursItem.titre}\n${coursItem.description || ""}`,
      });
    } catch {
      // ignore
    }
  };

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

  const getStatusBadge = (etat: string) => {
    switch (etat) {
      case "PUBLIE":
        return {
          text: "Publié",
          color: "#059669",
          bg: "#ECFDF5",
          border: "#A7F3D0",
          icon: "check-circle",
        };
      case "BROUILLON":
        return {
          text: "Brouillon",
          color: "#D97706",
          bg: "#FFFBEB",
          border: "#FDE68A",
          icon: "file-alt",
        };
      case "ARCHIVE":
        return {
          text: "Archivé",
          color: "#64748B",
          bg: "#F1F5F9",
          border: "#CBD5E1",
          icon: "archive",
        };
      default:
        return {
          text: etat,
          color: "#64748B",
          bg: "#F8FAFC",
          border: "#E2E8F0",
          icon: "info-circle",
        };
    }
  };

  const handleViewDetails = (coursItem: Cours) => {
    setSelectedCours(coursItem);
    setViewMode("detail");
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
    closeFab();
    onNavigateToCreate();
  };

  const handleProgramCours = () => {
    closeFab();
    setViewMode("schedule");
  };

  if (viewMode === "detail" && selectedCours) {
    return (
      <CourseDetailView
        cours={selectedCours}
        onBack={() => {
          setSelectedCours(null);
          setViewMode("list");
        }}
        onEdit={(c) => {
          setSelectedCours(null);
          setViewMode("list");
          onEditCours(c);
        }}
        onDelete={(c) => {
          setSelectedCours(null);
          setViewMode("list");
          handleDeleteCours(c);
        }}
        onProgram={() => {
          setViewMode("schedule");
        }}
      />
    );
  }

  if (viewMode === "schedule") {
    return (
      <CoursProgrammerScreen
        coursList={cours}
        onClose={() => setViewMode("list")}
        onScheduled={loadCours}
      />
    );
  }

  // Filter courses based on search and active filter
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

  // Animation interpolations
  const fabRotation = fabAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  const createCoursTranslateY = createCoursAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -70],
  });

  const programCoursTranslateY = programCoursAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -135],
  });

  const optionScale = createCoursAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={coursStyles.container}>
      {/* Scrollable Content */}
      <ScrollView
        style={coursStyles.scrollView}
        contentContainerStyle={coursStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Section with Gradient-like Badge */}
        <View style={coursStyles.pageHeader}>
          <View style={coursStyles.headerTopRow}>
            <View style={coursStyles.headerIconBadge}>
              <FontAwesome5 name="graduation-cap" size={20} color="#FFFFFF" />
            </View>
            <View style={coursStyles.headerTextContainer}>
              <Text style={coursStyles.pageTitle}>Mes Cours</Text>
              <Text style={coursStyles.pageSubtitle}>
                Gérez vos cours et suivez vos programmes d'enseignement
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setViewMode("schedule")}
              style={coursStyles.scheduleQuickBtn}
              activeOpacity={0.7}
            >
              <FontAwesome5 name="calendar-alt" size={16} color="#4F46E5" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Statistics Cards - Interactive Filter */}
        <View style={coursStyles.statsContainer}>
          <TouchableOpacity
            style={[
              coursStyles.statCard,
              activeFilter === "tous" && coursStyles.statCardActive,
            ]}
            onPress={() => setActiveFilter("tous")}
            activeOpacity={0.8}
          >
            <View style={coursStyles.statTopRow}>
              <Text style={coursStyles.statLabel}>Total Cours</Text>
              <View style={[coursStyles.statIconBadge, { backgroundColor: "#EEF2FF" }]}>
                <FontAwesome5 name="book-open" size={14} color="#4F46E5" />
              </View>
            </View>
            <Text style={[coursStyles.statNumber, { color: "#0F172A" }]}>{totalCours}</Text>
            <View style={coursStyles.statBottomRow}>
              <FontAwesome5 name="chart-line" size={10} color="#94A3B8" style={{ marginRight: 4 }} />
              <Text style={coursStyles.statSubText}>Tous les cours</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              coursStyles.statCard,
              activeFilter === "brouillons" && coursStyles.statCardActiveAmber,
            ]}
            onPress={() => setActiveFilter(activeFilter === "brouillons" ? "tous" : "brouillons")}
            activeOpacity={0.8}
          >
            <View style={coursStyles.statTopRow}>
              <Text style={coursStyles.statLabel}>Brouillons</Text>
              <View style={[coursStyles.statIconBadge, { backgroundColor: "#FEF3C7" }]}>
                <FontAwesome5 name="file-alt" size={14} color="#D97706" />
              </View>
            </View>
            <Text style={[coursStyles.statNumber, { color: "#D97706" }]}>{brouillonCount}</Text>
            <View style={coursStyles.statBottomRow}>
              <FontAwesome5 name="clock" size={10} color="#94A3B8" style={{ marginRight: 4 }} />
              <Text style={coursStyles.statSubText}>Non publiés</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              coursStyles.statCard,
              activeFilter === "publies" && coursStyles.statCardActiveGreen,
            ]}
            onPress={() => setActiveFilter(activeFilter === "publies" ? "tous" : "publies")}
            activeOpacity={0.8}
          >
            <View style={coursStyles.statTopRow}>
              <Text style={coursStyles.statLabel}>Publiés</Text>
              <View style={[coursStyles.statIconBadge, { backgroundColor: "#ECFDF5" }]}>
                <FontAwesome5 name="check-circle" size={14} color="#059669" />
              </View>
            </View>
            <Text style={[coursStyles.statNumber, { color: "#059669" }]}>{publieCount}</Text>
            <View style={coursStyles.statBottomRow}>
              <FontAwesome5 name="star" size={10} color="#94A3B8" style={{ marginRight: 4 }} />
              <Text style={coursStyles.statSubText}>Disponibles</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={coursStyles.searchContainer}>
          <FontAwesome5 name="search" size={15} color="#94A3B8" style={coursStyles.searchIcon} />
          <TextInput
            style={coursStyles.searchInput}
            placeholder="Rechercher un cours par titre ou description..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholderTextColor="#94A3B8"
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm("")} style={coursStyles.clearSearchBtn}>
              <FontAwesome5 name="times-circle" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Pills */}
        <View style={coursStyles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {filters.map((filter) => {
              const isActive = activeFilter === filter.id;
              const count =
                filter.id === "tous"
                  ? totalCours
                  : filter.id === "publies"
                  ? publieCount
                  : filter.id === "brouillons"
                  ? brouillonCount
                  : cours.filter((c) => c.etat === "ARCHIVE").length;

              return (
                <TouchableOpacity
                  key={filter.id}
                  style={[coursStyles.filterTab, isActive && coursStyles.activeFilterTab]}
                  onPress={() => setActiveFilter(filter.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[coursStyles.filterTabText, isActive && coursStyles.activeFilterTabText]}>
                    {filter.label}
                  </Text>
                  <View
                    style={[
                      coursStyles.filterBadge,
                      isActive ? coursStyles.filterBadgeActive : coursStyles.filterBadgeInactive,
                    ]}
                  >
                    <Text
                      style={[
                        coursStyles.filterBadgeText,
                        isActive ? coursStyles.filterBadgeTextActive : coursStyles.filterBadgeTextInactive,
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Feedback / Loading */}
        {error ? (
          <View style={coursStyles.errorBox}>
            <FontAwesome5 name="exclamation-circle" size={16} color="#EF4444" />
            <Text style={coursStyles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? <LoadingSpinner label="Chargement des cours..." /> : null}

        {/* Cours List */}
        {!loading && (
          <View style={coursStyles.coursList}>
            {filteredCours.map((coursItem) => {
              const badge = getStatusBadge(coursItem.etat);
              const initials = getInitials(coursItem.titre);

              return (
                <View key={coursItem.id} style={coursStyles.coursCard}>
                  {/* Card Header */}
                  <View style={coursStyles.cardHeader}>
                    {/* Course Initials Avatar with overlay */}
                    <View style={coursStyles.avatarContainer}>
                      <View style={coursStyles.avatarBox}>
                        <Text style={coursStyles.avatarText}>{initials}</Text>
                      </View>
                      <View style={[coursStyles.statusDotBadge, { backgroundColor: badge.color }]}>
                        <FontAwesome5 name={badge.icon} size={8} color="#FFFFFF" />
                      </View>
                    </View>

                    {/* Title and Subject */}
                    <View style={coursStyles.cardHeaderText}>
                      <Text style={coursStyles.cardTitle} numberOfLines={2}>
                        {coursItem.titre}
                      </Text>
                      <Text style={coursStyles.cardSubject} numberOfLines={1}>
                        {coursItem.matieres && coursItem.matieres.length > 0
                          ? `Matière : ${coursItem.matieres[0]}`
                          : "Enseignement général"}
                      </Text>
                    </View>

                    {/* Status Pill Badge */}
                    <View
                      style={[
                        coursStyles.statusBadge,
                        { backgroundColor: badge.bg, borderColor: badge.border },
                      ]}
                    >
                      <Text style={[coursStyles.statusBadgeText, { color: badge.color }]}>
                        {badge.text}
                      </Text>
                    </View>
                  </View>

                  {/* Description */}
                  {coursItem.description ? (
                    <Text style={coursStyles.cardDescription} numberOfLines={2}>
                      {coursItem.description}
                    </Text>
                  ) : (
                    <Text style={[coursStyles.cardDescription, { fontStyle: "italic", color: "#94A3B8" }]}>
                      Aucune description disponible
                    </Text>
                  )}

                  {/* Meta Details Row */}
                  <View style={coursStyles.cardMetaRow}>
                    <View style={coursStyles.metaItem}>
                      <FontAwesome5 name="calendar-alt" size={12} color="#94A3B8" />
                      <Text style={coursStyles.metaText}>
                        Créé le {new Date(coursItem.dateCreation).toLocaleDateString("fr-FR")}
                      </Text>
                    </View>
                    {coursItem.chapitres && coursItem.chapitres.length > 0 && (
                      <View style={coursStyles.metaItem}>
                        <FontAwesome5 name="book" size={12} color="#94A3B8" />
                        <Text style={coursStyles.metaText}>
                          {coursItem.chapitres.length} chapitre{coursItem.chapitres.length > 1 ? "s" : ""}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Actions Bar with border-t */}
                  <View style={coursStyles.cardActionsBar}>
                    {/* Live Button (Host live) */}
                    <TouchableOpacity
                      style={coursStyles.liveButton}
                      onPress={() =>
                        navigation.navigate("LiveSession", { coursId: coursItem.id, isHost: true })
                      }
                      activeOpacity={0.8}
                    >
                      <FontAwesome5 name="video" size={12} color="#059669" />
                      <Text style={coursStyles.liveButtonText}>Direct</Text>
                    </TouchableOpacity>

                    <View style={coursStyles.rightActionButtons}>
                      {/* View Details */}
                      <TouchableOpacity
                        style={[coursStyles.actionIconButton, { backgroundColor: "#EEF2FF" }]}
                        onPress={() => handleViewDetails(coursItem)}
                        accessibilityLabel="Détails"
                        activeOpacity={0.7}
                      >
                        <FontAwesome5 name="eye" size={14} color="#4F46E5" />
                      </TouchableOpacity>

                      {/* Edit */}
                      <TouchableOpacity
                        style={[coursStyles.actionIconButton, { backgroundColor: "#FEF3C7" }]}
                        onPress={() => onEditCours(coursItem)}
                        accessibilityLabel="Modifier"
                        activeOpacity={0.7}
                      >
                        <FontAwesome5 name="pen" size={14} color="#D97706" />
                      </TouchableOpacity>

                      {/* Schedule */}
                      <TouchableOpacity
                        style={[coursStyles.actionIconButton, { backgroundColor: "#F3E8FF" }]}
                        onPress={() => {
                          setSelectedCours(coursItem);
                          setViewMode("schedule");
                        }}
                        accessibilityLabel="Programmer"
                        activeOpacity={0.7}
                      >
                        <FontAwesome5 name="calendar-plus" size={14} color="#7C3AED" />
                      </TouchableOpacity>

                      {/* Share */}
                      <TouchableOpacity
                        style={[coursStyles.actionIconButton, { backgroundColor: "#F1F5F9" }]}
                        onPress={() => handleShareCours(coursItem)}
                        accessibilityLabel="Partager"
                        activeOpacity={0.7}
                      >
                        <FontAwesome5 name="share-alt" size={14} color="#64748B" />
                      </TouchableOpacity>

                      {/* Delete */}
                      <TouchableOpacity
                        style={[coursStyles.actionIconButton, { backgroundColor: "#FEE2E2" }]}
                        onPress={() => handleDeleteCours(coursItem)}
                        accessibilityLabel="Supprimer"
                        activeOpacity={0.7}
                      >
                        <FontAwesome5 name="trash" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Modern Empty State */}
        {!loading && filteredCours.length === 0 && (
          <View style={coursStyles.emptyStateContainer}>
            <View style={coursStyles.emptyIconCircle}>
              <FontAwesome5 name="book-open" size={32} color="#6366F1" />
            </View>
            <Text style={coursStyles.emptyTitle}>
              {searchTerm ? "Aucun résultat trouvé" : "Aucun cours disponible"}
            </Text>
            <Text style={coursStyles.emptySubtitle}>
              {searchTerm
                ? "Essayez d'ajuster votre recherche ou filtre."
                : "Commencez par créer votre premier cours ou programmer une session."}
            </Text>
            <TouchableOpacity
              style={coursStyles.emptyCreateButton}
              onPress={handleCreateCours}
              activeOpacity={0.8}
            >
              <FontAwesome5 name="plus" size={14} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={coursStyles.emptyCreateButtonText}>Créer un cours</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* FAB Backdrop (when open) */}
      {isFabOpen && (
        <TouchableWithoutFeedback onPress={closeFab}>
          <View style={coursStyles.fabBackdrop} />
        </TouchableWithoutFeedback>
      )}

      {/* Animated Floating Action Buttons */}
      <View style={coursStyles.fabContainer} pointerEvents="box-none">
        {/* Program Course Option */}
        <Animated.View
          style={[
            coursStyles.fabOption,
            {
              transform: [{ translateY: programCoursTranslateY }, { scale: optionScale }],
              opacity: optionScale,
            },
          ]}
          pointerEvents={isFabOpen ? "auto" : "none"}
        >
          <TouchableOpacity
            style={coursStyles.speedDialCard}
            onPress={handleProgramCours}
            activeOpacity={0.85}
          >
            <View style={[coursStyles.speedDialIconBadge, { backgroundColor: "#F3F4F6", borderColor: "#E5E7EB" }]}>
              <FontAwesome5 name="calendar-alt" size={14} color="#0D9488" />
            </View>
            <View style={coursStyles.speedDialTextContainer}>
              <Text style={coursStyles.speedDialTitle}>Programmer un cours</Text>
              <Text style={coursStyles.speedDialSubtitle}>Planifier une séance de classe</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={10} color="#CBD5E1" />
          </TouchableOpacity>
        </Animated.View>

        {/* Create Course Option */}
        <Animated.View
          style={[
            coursStyles.fabOption,
            {
              transform: [{ translateY: createCoursTranslateY }, { scale: optionScale }],
              opacity: optionScale,
            },
          ]}
          pointerEvents={isFabOpen ? "auto" : "none"}
        >
          <TouchableOpacity
            style={coursStyles.speedDialCard}
            onPress={handleCreateCours}
            activeOpacity={0.85}
          >
            <View style={[coursStyles.speedDialIconBadge, { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }]}>
              <FontAwesome5 name="plus" size={14} color="#059669" />
            </View>
            <View style={coursStyles.speedDialTextContainer}>
              <Text style={coursStyles.speedDialTitle}>Créer un cours</Text>
              <Text style={coursStyles.speedDialSubtitle}>Nouveau support pédagogique</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={10} color="#CBD5E1" />
          </TouchableOpacity>
        </Animated.View>

        {/* Main Trigger FAB */}
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
            activeOpacity={0.85}
          >
            <FontAwesome5 name="plus" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

const coursStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 180,
  },
  pageHeader: {
    marginBottom: 20,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  headerTextContainer: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  scheduleQuickBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E7FF",
  },
  statsContainer: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statCardActive: {
    borderColor: "#4F46E5",
    borderWidth: 2,
  },
  statCardActiveAmber: {
    borderColor: "#F59E0B",
    borderWidth: 2,
  },
  statCardActiveGreen: {
    borderColor: "#10B981",
    borderWidth: 2,
  },
  statTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  statIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4,
  },
  statBottomRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statSubText: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "500",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  activeFilterTab: {
    backgroundColor: "#4F46E5",
    borderColor: "#4F46E5",
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
    marginRight: 6,
  },
  activeFilterTabText: {
    color: "#FFFFFF",
  },
  filterBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  filterBadgeActive: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  filterBadgeInactive: {
    backgroundColor: "#F1F5F9",
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  filterBadgeTextActive: {
    color: "#FFFFFF",
  },
  filterBadgeTextInactive: {
    color: "#64748B",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
    flex: 1,
  },
  coursList: {
    gap: 14,
  },
  coursCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  avatarContainer: {
    position: "relative",
    marginRight: 12,
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  statusDotBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  cardHeaderText: {
    flex: 1,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    lineHeight: 20,
  },
  cardSubject: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  cardDescription: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
    marginBottom: 12,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 14,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: "#64748B",
  },
  cardActionsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 12,
  },
  liveButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    gap: 6,
  },
  liveButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
  },
  rightActionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionIconButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyStateContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 6,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
  },
  emptyCreateButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4F46E5",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  emptyCreateButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
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

export default DashboardCoursBody;
