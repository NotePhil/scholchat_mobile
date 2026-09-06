import React, { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { LoadingSpinner } from "../../components/ui";
import ChildSelectorRow from "./ChildSelectorRow";
import CourseContentSheet from "../shared/CourseContentSheet";
import { parentService } from "../../services/api";
import { CoursProgramme } from "../../types";
import { useUser } from "../../context/UserContext";
import { useSelectedChildStore } from "../../store/useSelectedChildStore";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string; icon: string }
> = {
  PLANIFIE: {
    label: "Planifié",
    color: "#2563EB",
    bg: "#EFF6FF",
    border: "#BFDBFE",
    icon: "calendar-check",
  },
  EN_COURS: {
    label: "En direct",
    color: "#059669",
    bg: "#ECFDF5",
    border: "#A7F3D0",
    icon: "broadcast-tower",
  },
  TERMINE: {
    label: "Terminé",
    color: "#64748B",
    bg: "#F1F5F9",
    border: "#CBD5E1",
    icon: "check-circle",
  },
  ANNULE: {
    label: "Annulé",
    color: "#DC2626",
    bg: "#FEF2F2",
    border: "#FECACA",
    icon: "times-circle",
  },
};

const getInitials = (title: string): string => {
  if (!title) return "CP";
  const words = title.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return title.slice(0, 2).toUpperCase();
};

const ParentCoursesBody = () => {
  const { user } = useUser();
  const navigation = useNavigation<any>();
  const { children, selectedChildId, loadChildren } = useSelectedChildStore();
  const [courses, setCourses] = useState<CoursProgramme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<CoursProgramme | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<"tous" | "live" | "planifie" | "termine">("tous");

  useEffect(() => {
    if (user?.userId) loadChildren(user.userId);
  }, [user?.userId, loadChildren]);

  const loadCourses = useCallback(async () => {
    if (!selectedChildId) {
      setCourses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setCourses(await parentService.getChildScheduledCourses(selectedChildId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du chargement des cours.");
    } finally {
      setLoading(false);
    }
  }, [selectedChildId]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const selectedChild = children.find((c) => c.id === selectedChildId);

  const filteredCourses = courses.filter((course) => {
    const etat = course.etatCoursProgramme ?? "PLANIFIE";
    const title = (course.titre || course.nom || course.cours?.titre || "Cours").toLowerCase();
    const lieu = (course.lieu ?? "").toLowerCase();
    const matchesSearch =
      title.includes(searchTerm.toLowerCase()) || lieu.includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (activeFilter === "live") return etat === "EN_COURS";
    if (activeFilter === "planifie") return etat === "PLANIFIE";
    if (activeFilter === "termine") return etat === "TERMINE" || etat === "ANNULE";
    return true;
  });

  const liveCount = courses.filter((c) => c.etatCoursProgramme === "EN_COURS").length;
  const planifieCount = courses.filter((c) => c.etatCoursProgramme === "PLANIFIE").length;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header with Gradient Icon Badge */}
        <View style={styles.pageHeader}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerIconBadge}>
              <FontAwesome5 name="book-reader" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.pageTitle}>Cours des enfants</Text>
              <Text style={styles.pageSubtitle}>
                {selectedChild
                  ? `Emploi du temps et sessions pour ${selectedChild.prenom}`
                  : "Sélectionnez un enfant pour voir ses cours"}
              </Text>
            </View>
          </View>
        </View>

        {/* Child Selector Row */}
        <ChildSelectorRow />

        {/* Search Bar */}
        {children.length > 0 && (
          <View style={styles.searchContainer}>
            <FontAwesome5 name="search" size={15} color="#94A3B8" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher par titre ou lieu..."
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholderTextColor="#94A3B8"
            />
            {searchTerm.length > 0 && (
              <TouchableOpacity onPress={() => setSearchTerm("")} style={styles.clearSearchBtn}>
                <FontAwesome5 name="times-circle" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Filter Tabs */}
        {children.length > 0 && (
          <View style={styles.filterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <TouchableOpacity
                style={[styles.filterTab, activeFilter === "tous" && styles.activeFilterTab]}
                onPress={() => setActiveFilter("tous")}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterTabText, activeFilter === "tous" && styles.activeFilterTabText]}>
                  Tous
                </Text>
                <View
                  style={[
                    styles.filterBadge,
                    activeFilter === "tous" ? styles.filterBadgeActive : styles.filterBadgeInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterBadgeText,
                      activeFilter === "tous" ? styles.filterBadgeTextActive : styles.filterBadgeTextInactive,
                    ]}
                  >
                    {courses.length}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterTab, activeFilter === "live" && styles.activeFilterTabLive]}
                onPress={() => setActiveFilter("live")}
                activeOpacity={0.8}
              >
                <View style={styles.livePulseDot} />
                <Text style={[styles.filterTabText, activeFilter === "live" && styles.activeFilterTabText]}>
                  En direct
                </Text>
                {liveCount > 0 && (
                  <View style={[styles.filterBadge, styles.filterBadgeLive]}>
                    <Text style={[styles.filterBadgeText, { color: "#FFFFFF" }]}>{liveCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterTab, activeFilter === "planifie" && styles.activeFilterTab]}
                onPress={() => setActiveFilter("planifie")}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterTabText, activeFilter === "planifie" && styles.activeFilterTabText]}>
                  À venir
                </Text>
                <View
                  style={[
                    styles.filterBadge,
                    activeFilter === "planifie" ? styles.filterBadgeActive : styles.filterBadgeInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterBadgeText,
                      activeFilter === "planifie" ? styles.filterBadgeTextActive : styles.filterBadgeTextInactive,
                    ]}
                  >
                    {planifieCount}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterTab, activeFilter === "termine" && styles.activeFilterTab]}
                onPress={() => setActiveFilter("termine")}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterTabText, activeFilter === "termine" && styles.activeFilterTabText]}>
                  Terminés
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* Error notification */}
        {error ? (
          <View style={styles.errorBox}>
            <FontAwesome5 name="exclamation-circle" size={16} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {children.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyIconCircle}>
              <FontAwesome5 name="child" size={32} color="#6366F1" />
            </View>
            <Text style={styles.emptyTitle}>Aucun enfant rattaché</Text>
            <Text style={styles.emptySubtitle}>
              Ajoutez un enfant depuis l'onglet "Mes enfants" pour suivre son emploi du temps et ses cours.
            </Text>
          </View>
        ) : loading ? (
          <LoadingSpinner label="Chargement des cours..." />
        ) : (
          <View style={styles.courseList}>
            {filteredCourses.map((course) => {
              const etat = course.etatCoursProgramme ?? "PLANIFIE";
              const isLive = etat === "EN_COURS";
              const status = STATUS_CONFIG[etat] ?? STATUS_CONFIG.PLANIFIE;
              const courseTitle =
                course.titre || course.nom || course.cours?.titre || "Cours sans titre";
              const initials = getInitials(courseTitle);
              const formattedDate = course.dateCoursPrevue
                ? new Date(course.dateCoursPrevue).toLocaleDateString("fr-FR", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "Date non définie";
              const formattedTime = course.dateCoursPrevue
                ? new Date(course.dateCoursPrevue).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "";

              return (
                <View key={course.id} style={styles.courseCard}>
                  {/* Card Header */}
                  <View style={styles.cardHeader}>
                    <View style={styles.avatarBox}>
                      <Text style={styles.avatarText}>{initials}</Text>
                    </View>

                    <View style={styles.cardHeaderText}>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {courseTitle}
                      </Text>
                      <View style={styles.timeRow}>
                        <FontAwesome5 name="calendar-alt" size={11} color="#64748B" />
                        <Text style={styles.timeText}>{formattedDate}</Text>
                        {formattedTime ? (
                          <>
                            <Text style={styles.timeDot}>•</Text>
                            <FontAwesome5 name="clock" size={11} color="#64748B" />
                            <Text style={styles.timeText}>{formattedTime}</Text>
                          </>
                        ) : null}
                      </View>
                    </View>

                    {/* Status Badge */}
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: status.bg, borderColor: status.border },
                      ]}
                    >
                      {isLive && <View style={styles.livePulseDot} />}
                      <Text style={[styles.statusBadgeText, { color: status.color }]}>
                        {status.label}
                      </Text>
                    </View>
                  </View>

                  {/* Location / Room */}
                  {course.lieu ? (
                    <View style={styles.locationRow}>
                      <FontAwesome5 name="map-marker-alt" size={12} color="#64748B" />
                      <Text style={styles.locationText} numberOfLines={1}>
                        {course.lieu}
                      </Text>
                    </View>
                  ) : null}

                  {/* Actions Row */}
                  <View style={styles.cardActionsRow}>
                    {isLive && course.coursId ? (
                      <TouchableOpacity
                        style={styles.joinLiveButton}
                        onPress={() =>
                          navigation.navigate("LiveSession", {
                            coursId: course.coursId,
                            isHost: false,
                          })
                        }
                        activeOpacity={0.85}
                      >
                        <FontAwesome5 name="video" size={14} color="#FFFFFF" />
                        <Text style={styles.joinLiveButtonText}>Rejoindre la session en direct</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.viewCourseButton}
                        onPress={() => setSelectedCourse(course)}
                        activeOpacity={0.75}
                      >
                        <FontAwesome5 name="book-open" size={13} color="#4F46E5" />
                        <Text style={styles.viewCourseButtonText}>Consulter les supports</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Empty State when 0 courses for child */}
        {!loading && children.length > 0 && filteredCourses.length === 0 && (
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyIconCircle}>
              <FontAwesome5 name="calendar-alt" size={32} color="#6366F1" />
            </View>
            <Text style={styles.emptyTitle}>
              {searchTerm ? "Aucun cours correspondant" : "Aucun cours programmé"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchTerm
                ? "Essayez de modifier votre recherche ou le filtre actif."
                : "Les cours programmés pour cet enfant apparaîtront ici dès leur planification."}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Course Details BottomSheet */}
      <CourseContentSheet
        visible={!!selectedCourse}
        coursProgramme={selectedCourse}
        onClose={() => setSelectedCourse(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
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
    paddingBottom: 120,
  },
  pageHeader: {
    marginBottom: 14,
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
  activeFilterTabLive: {
    backgroundColor: "#059669",
    borderColor: "#059669",
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
  filterBadgeLive: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
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
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
    marginRight: 6,
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
  courseList: {
    gap: 14,
  },
  courseCard: {
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
    marginBottom: 12,
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
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
    marginBottom: 4,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timeText: {
    fontSize: 12,
    color: "#64748B",
  },
  timeDot: {
    fontSize: 12,
    color: "#CBD5E1",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  locationText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "500",
  },
  cardActionsRow: {
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 12,
  },
  joinLiveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#059669",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  joinLiveButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  viewCourseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#E0E7FF",
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
  },
  viewCourseButtonText: {
    color: "#4F46E5",
    fontSize: 13,
    fontWeight: "700",
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
  },
});

export default ParentCoursesBody;
