import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
  RefreshControl,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useUser } from "../../../../context/UserContext";
import { accederService, coursProgrammerService, coursService } from "../../../../services/api";
import { classService } from "../../../../services/classService";
import { BottomSheet, LoadingSpinner } from "../../../../components/ui";
import { useThemeColors } from "../../../../styles/theme";
import { useThemeStore } from "../../../../store/useThemeStore";
import { ClassEntity } from "../../../../types";
import { CoursProgrammerScreen } from "./CoursProgrammerScreen";
import CourseDetailView from "./CourseDetailView";
import { formatDateTime as formatServerDateTime } from "../../../../utils/dates";

// LinearGradient via expo-linear-gradient (safe fallback to View if unavailable)
let LinearGradient: any;
try {
  LinearGradient = require("expo-linear-gradient").LinearGradient;
} catch {
  LinearGradient = ({ children, style, colors: c }: any) => (
    <View style={[style, { backgroundColor: c?.[0] }]}>{children}</View>
  );
}

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
  /** Subject names (not ids/objects) — display only. */
  matieres: string[];
  redacteurId: string;
  dateHeureDebut?: string | null;
  dateHeureFin?: string | null;
  lieu?: string | null;
}

interface DashboardCoursBodyProps {
  onNavigateToCreate: () => void;
  onEditCours: (cours: Cours) => void;
}

const matiereName = (m: any): string => (typeof m === "string" ? m : m?.nom ?? "");

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
  // Backend returns matiere objects ({ id, nom, ... }); keep just the names,
  // which is all the list shows (rendering the object gave "[object Object]").
  matieres: (raw.matiere ? [raw.matiere] : Array.isArray(raw.matieres) ? raw.matieres : [])
    .map(matiereName)
    .filter(Boolean),
  redacteurId: raw.redacteurId ?? raw.professeurId ?? "",
  dateHeureDebut: raw.dateHeureDebut ?? null,
  dateHeureFin: raw.dateHeureFin ?? null,
  lieu: raw.lieu ?? null,
});

/** Same as web's getInitials: first letter of the first two words. */
const getInitials = (title: string): string =>
  title
    ?.split(" ")
    .map((w) => w.charAt(0))
    .join("")
    .substring(0, 2)
    .toUpperCase() || "CO";

/** Same as web's CourseCard formatDate. */
const formatDate = (d?: string | null) =>
  d
    ? formatServerDateTime(d, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Non défini";

const className = (c: ClassEntity) => c.nom || (c as any).name || (c as any).titre || `Classe ${c.id}`;

// Web's CourseCard status palette (Tailwind *-50 / *-700 / *-200)
const STATUS: Record<string, { text: string; bg: string; color: string; border: string; icon: string; iconColor: string }> = {
  BROUILLON: { text: "Brouillon", bg: "#FEFCE8", color: "#A16207", border: "#FEF08A", icon: "file-alt", iconColor: "#EAB308" },
  EN_ATTENTE_VALIDATION: { text: "En attente", bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE", icon: "clock", iconColor: "#3B82F6" },
  PUBLIE: { text: "Publié", bg: "#F0FDF4", color: "#15803D", border: "#BBF7D0", icon: "check-circle", iconColor: "#22C55E" },
  ARCHIVE: { text: "Archivé", bg: "#F9FAFB", color: "#374151", border: "#E5E7EB", icon: "archive", iconColor: "#6B7280" },
};
const statusOf = (etat: string) =>
  STATUS[etat] ?? { text: etat, bg: "#F9FAFB", color: "#374151", border: "#E5E7EB", icon: "exclamation-circle", iconColor: "#6B7280" };

const STATUS_OPTIONS = [
  { value: "all", label: "Tous les statuts" },
  { value: "BROUILLON", label: "Brouillon" },
  { value: "PUBLIE", label: "Publié" },
];

/** Compact select pill (web's small <select>) that opens a bottom sheet. */
const SelectPill = ({
  icon,
  value,
  options,
  onChange,
  title,
  styles,
  muted,
}: {
  icon: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  title: string;
  styles: ReturnType<typeof createCoursStyles>;
  muted: string;
}) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) ?? options[0];
  return (
    <>
      <TouchableOpacity style={styles.selectPill} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <FontAwesome5 name={icon as any} size={11} color={muted} />
        <Text style={styles.selectPillText} numberOfLines={1}>{selected?.label}</Text>
        <FontAwesome5 name="chevron-down" size={10} color={muted} />
      </TouchableOpacity>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={title}>
        <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={styles.sheetOption}
              onPress={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              <Text style={[styles.sheetOptionText, opt.value === value && styles.sheetOptionTextActive]}>{opt.label}</Text>
              {opt.value === value ? <FontAwesome5 name="check" size={13} color="#4F46E5" /> : null}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </BottomSheet>
    </>
  );
};

const DashboardCoursBody = ({ onNavigateToCreate, onEditCours }: DashboardCoursBodyProps) => {
  const { user } = useUser();
  const themeColors = useThemeColors();
  const isDark = useThemeStore((s) => s.mode === "dark");
  const coursStyles = useMemo(() => createCoursStyles(themeColors, isDark), [themeColors, isDark]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterClassId, setFilterClassId] = useState("");
  const [professorClasses, setProfessorClasses] = useState<ClassEntity[]>([]);
  const [layout, setLayout] = useState<"grid" | "table">("grid");
  type CoursViewMode = "list" | "detail" | "schedule";
  const [viewMode, setViewMode] = useState<CoursViewMode>("list");
  const [selectedCours, setSelectedCours] = useState<Cours | null>(null);
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [isFabMenuMounted, setIsFabMenuMounted] = useState(false);
  const [cours, setCours] = useState<Cours[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadCours = useCallback(
    async (classeId: string = filterClassId) => {
      if (!user?.userId) return;
      setLoading(true);
      setError("");
      try {
        const all = (await coursService.getByProfessor(user.userId)).map(mapApiCoursToUiCours);
        if (classeId) {
          // Same as web: keep only courses scheduled in that class.
          try {
            const scheduled = await coursProgrammerService.getByClasse(classeId);
            const ids = new Set(
              (scheduled || []).map((sc) => String(sc.coursId || sc.cours?.id || "")).filter(Boolean)
            );
            setCours(all.filter((c) => ids.has(String(c.id))));
          } catch {
            setCours(all);
          }
        } else {
          setCours(all);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Échec du chargement des cours.");
      } finally {
        setLoading(false);
      }
    },
    [user?.userId, filterClassId]
  );

  // Web's obtenirClassesUtilisateur: classes with publication rights ∪ classes with access.
  const loadClasses = useCallback(async () => {
    if (!user?.userId) return;
    const [pub, acc] = await Promise.all([
      classService.getClassesWithPublicationRights(user.userId).catch(() => [] as ClassEntity[]),
      accederService.getAccessibleClasses(user.userId).catch(() => [] as ClassEntity[]),
    ]);
    const map = new Map<string, ClassEntity>();
    [...(pub || []), ...(acc || [])].forEach((c) => {
      if (c?.id && !map.has(c.id)) map.set(c.id, c);
    });
    setProfessorClasses(Array.from(map.values()));
  }, [user?.userId]);

  useEffect(() => {
    loadCours("");
    loadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);

  const handleClassFilterChange = (classId: string) => {
    setFilterClassId(classId);
    loadCours(classId);
  };

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

  const handleViewDetails = (coursItem: Cours) => {
    setSelectedCours(coursItem);
    setViewMode("detail");
  };

  const toggleFab = () => {
    const opening = !isFabOpen;
    // Android draws elevation shadows at full strength regardless of the
    // parent's opacity, so fading the menu out left its shadows hanging on
    // screen. Animate only the opening; on close, remove the menu at once.
    setIsFabMenuMounted(opening);
    Animated.spring(fabAnimation, {
      toValue: opening ? 1 : 0,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
    setIsFabOpen(opening);
  };

  const closeFab = () => {
    if (isFabOpen) toggleFab();
  };

  const handleCreateCours = () => {
    closeFab();
    onNavigateToCreate();
  };

  const handleProgramCours = () => {
    closeFab();
    setSelectedCours(null);
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
        // Set when opened from a specific course (card or detail view), so
        // the form opens with that course already selected.
        initialCoursId={selectedCours?.id ?? null}
        onClose={() => {
          setSelectedCours(null);
          setViewMode("list");
        }}
        onScheduled={() => loadCours()}
      />
    );
  }

  // Same filter as web: title, description or subject name, plus status.
  const q = searchTerm.toLowerCase();
  const filteredCours = cours.filter((item) => {
    const matchesSearch =
      !q ||
      item.titre.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.matieres.some((m) => m.toLowerCase().includes(q));
    const matchesStatus = filterStatus === "all" || item.etat === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const filterClassName = (() => {
    const c = professorClasses.find((x) => String(x.id) === String(filterClassId));
    return c ? className(c) : "";
  })();

  const fabRotation = fabAnimation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "45deg"] });
  const menuTranslateY = fabAnimation.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadCours();
    setRefreshing(false);
  };

  const subjectLabel = (c: Cours) => (c.matieres.length > 0 ? c.matieres.join(", ") : "Matière non définie");

  const ActionButtons = ({ item }: { item: Cours }) => (
    <View style={coursStyles.actionsRow}>
      <TouchableOpacity style={coursStyles.actionBtn} onPress={() => handleViewDetails(item)} accessibilityLabel="Voir les détails">
        <FontAwesome5 name="eye" size={15} color={coursStyles.actionIcon.color} />
      </TouchableOpacity>
      <TouchableOpacity style={coursStyles.actionBtn} onPress={() => onEditCours(item)} accessibilityLabel="Modifier">
        <FontAwesome5 name="pen" size={14} color={coursStyles.actionIcon.color} />
      </TouchableOpacity>
      <TouchableOpacity
        style={coursStyles.actionBtn}
        onPress={() => {
          setSelectedCours(item);
          setViewMode("schedule");
        }}
        accessibilityLabel="Programmer"
      >
        <FontAwesome5 name="calendar-plus" size={15} color={coursStyles.actionIcon.color} />
      </TouchableOpacity>
      <TouchableOpacity style={coursStyles.actionBtn} onPress={() => handleShareCours(item)} accessibilityLabel="Partager">
        <FontAwesome5 name="share-alt" size={15} color={coursStyles.actionIcon.color} />
      </TouchableOpacity>
      <TouchableOpacity style={coursStyles.actionBtn} onPress={() => handleDeleteCours(item)} accessibilityLabel="Supprimer">
        <FontAwesome5 name="trash-alt" size={14} color={coursStyles.actionIcon.color} />
      </TouchableOpacity>
    </View>
  );

  const muted = isDark ? "#94A3B8" : "#94A3B8";

  return (
    <View style={coursStyles.container}>
      <ScrollView
        style={coursStyles.scrollView}
        contentContainerStyle={coursStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#4F46E5" />}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={coursStyles.pageHeader}>
          <LinearGradient colors={["#4F46E5", "#9333EA"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={coursStyles.headerIcon}>
            <FontAwesome5 name="book-open" size={15} color="#FFFFFF" />
          </LinearGradient>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={coursStyles.pageTitle}>Mes Cours</Text>
            <Text style={coursStyles.pageSubtitle}>Gérez vos cours et suivez vos programmes d'enseignement</Text>
          </View>
        </View>

        {error ? (
          <View style={coursStyles.errorBox}>
            <FontAwesome5 name="exclamation-circle" size={14} color="#EF4444" />
            <Text style={coursStyles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => setError("")}>
              <FontAwesome5 name="times" size={12} color="#F87171" />
            </TouchableOpacity>
          </View>
        ) : null}

        {filterClassId && filterClassName ? (
          <View style={coursStyles.classBanner}>
            <FontAwesome5 name="book-open" size={13} color="#3B82F6" />
            <Text style={coursStyles.classBannerText} numberOfLines={1}>
              Cours de la classe : <Text style={{ fontWeight: "800" }}>{filterClassName}</Text>
            </Text>
            <TouchableOpacity onPress={() => handleClassFilterChange("")}>
              <FontAwesome5 name="times" size={12} color="#60A5FA" />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── Toolbar ─────────────────────────────────────────────────── */}
        <View style={coursStyles.toolbar}>
          {/* Row 1: search + Nouveau */}
          <View style={coursStyles.toolbarRow}>
            <View style={coursStyles.searchBox}>
              <FontAwesome5 name="search" size={13} color={muted} />
              <TextInput
                style={coursStyles.searchInput}
                placeholder="Rechercher par titre, description, matière..."
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholderTextColor="#94A3B8"
              />
              {searchTerm.length > 0 && (
                <TouchableOpacity onPress={() => setSearchTerm("")}>
                  <FontAwesome5 name="times-circle" size={14} color={muted} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={handleCreateCours} activeOpacity={0.85}>
              <LinearGradient colors={["#4F46E5", "#9333EA"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={coursStyles.newBtn}>
                <FontAwesome5 name="plus" size={13} color="#FFFFFF" />
                <Text style={coursStyles.newBtnText}>Nouveau</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Row 2: filters + layout toggle */}
          <View style={coursStyles.toolbarRow}>
            <SelectPill
              icon="filter"
              value={filterStatus}
              options={STATUS_OPTIONS}
              onChange={setFilterStatus}
              title="Statut"
              styles={coursStyles}
              muted={muted}
            />
            {professorClasses.length > 0 && (
              <SelectPill
                icon="book-open"
                value={filterClassId}
                options={[
                  { value: "", label: "Toutes les classes" },
                  ...professorClasses.map((c) => ({ value: String(c.id), label: className(c) })),
                ]}
                onChange={handleClassFilterChange}
                title="Classe"
                styles={coursStyles}
                muted={muted}
              />
            )}
            <View style={coursStyles.toggleWrap}>
              {(["grid", "table"] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[coursStyles.toggleBtn, layout === m && coursStyles.toggleBtnActive]}
                  onPress={() => setLayout(m)}
                >
                  <FontAwesome5 name={m === "grid" ? "th" : "list"} size={13} color={layout === m ? "#4F46E5" : "#64748B"} />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Row 3 (wraps on web at phone width): schedule + refresh */}
          <View style={coursStyles.toolbarRow}>
            <TouchableOpacity style={coursStyles.scheduleBtn} onPress={handleProgramCours} accessibilityLabel="Programmer">
              <FontAwesome5 name="calendar-alt" size={14} color="#4F46E5" />
            </TouchableOpacity>
            <TouchableOpacity style={coursStyles.refreshBtn} onPress={() => loadCours()} disabled={loading} accessibilityLabel="Actualiser">
              <FontAwesome5 name="sync-alt" size={14} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>

        {loading && cours.length === 0 ? <LoadingSpinner label="Chargement des cours..." /> : null}

        {/* ── Courses ─────────────────────────────────────────────────── */}
        {layout === "grid" ? (
          <View style={{ gap: 12 }}>
            {filteredCours.map((item) => {
              const st = statusOf(item.etat);
              return (
                <View key={item.id} style={coursStyles.card}>
                  <View style={coursStyles.cardHeader}>
                    <View>
                      <LinearGradient colors={["#6366F1", "#A855F7"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={coursStyles.avatar}>
                        <Text style={coursStyles.avatarText}>{getInitials(item.titre)}</Text>
                      </LinearGradient>
                      <View style={coursStyles.statusIcon}>
                        <FontAwesome5 name={st.icon as any} size={13} color={st.iconColor} solid />
                      </View>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={coursStyles.cardTitle}>{item.titre}</Text>
                      <Text style={coursStyles.cardSubject} numberOfLines={1}>{subjectLabel(item)}</Text>
                    </View>
                  </View>

                  <View style={[coursStyles.badge, { backgroundColor: st.bg, borderColor: st.border }]}>
                    <Text style={[coursStyles.badgeText, { color: st.color }]}>{st.text}</Text>
                  </View>

                  <Text style={coursStyles.cardDescription} numberOfLines={2}>
                    {item.description || "Aucune description disponible"}
                  </Text>

                  <View style={{ gap: 8, marginBottom: 16 }}>
                    <View style={coursStyles.metaRow}>
                      <FontAwesome5 name="calendar-alt" size={13} color="#94A3B8" style={coursStyles.metaIcon} />
                      <Text style={coursStyles.metaText}>Début: {formatDate(item.dateHeureDebut)}</Text>
                    </View>
                    <View style={coursStyles.metaRow}>
                      <FontAwesome5 name="clock" size={13} color="#94A3B8" style={coursStyles.metaIcon} />
                      <Text style={coursStyles.metaText}>Fin: {formatDate(item.dateHeureFin)}</Text>
                    </View>
                    {item.lieu ? (
                      <View style={coursStyles.metaRow}>
                        <FontAwesome5 name="users" size={13} color="#94A3B8" style={coursStyles.metaIcon} />
                        <Text style={coursStyles.metaText} numberOfLines={1}>{item.lieu}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={coursStyles.cardFooter}>
                    <ActionButtons item={item} />
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          filteredCours.length > 0 && (
            <View style={coursStyles.tableCard}>
              {filteredCours.map((item, i) => {
                const st = statusOf(item.etat);
                return (
                  <View key={item.id} style={[coursStyles.tableRow, i > 0 && coursStyles.tableRowBorder]}>
                    <View style={coursStyles.tableRowTop}>
                      <LinearGradient colors={["#6366F1", "#A855F7"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={coursStyles.avatarSm}>
                        <Text style={coursStyles.avatarTextSm}>{getInitials(item.titre)}</Text>
                      </LinearGradient>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={coursStyles.cardTitle}>{item.titre}</Text>
                        <Text style={coursStyles.tableSub} numberOfLines={1}>{item.description || "Aucune description"}</Text>
                        <Text style={coursStyles.tableSubject} numberOfLines={1}>{subjectLabel(item)}</Text>
                      </View>
                      <View style={[coursStyles.badgeInline, { backgroundColor: st.bg, borderColor: st.border }]}>
                        <FontAwesome5 name={st.icon as any} size={10} color={st.iconColor} solid />
                        <Text style={[coursStyles.badgeText, { color: st.color }]}>{st.text}</Text>
                      </View>
                    </View>
                    <ActionButtons item={item} />
                  </View>
                );
              })}
            </View>
          )
        )}

        {/* ── Empty state ─────────────────────────────────────────────── */}
        {!loading && filteredCours.length === 0 && (
          <View style={coursStyles.emptyCard}>
            <View style={coursStyles.emptyIcon}>
              <FontAwesome5 name="book-open" size={30} color="#94A3B8" />
            </View>
            <Text style={coursStyles.emptyTitle}>
              {searchTerm || filterStatus !== "all" || filterClassId ? "Aucun cours trouvé" : "Aucun cours créé"}
            </Text>
            <Text style={coursStyles.emptySubtitle}>
              {filterClassId
                ? `Aucun cours trouvé pour la classe ${filterClassName || filterClassId}. Créez un cours associé à cette classe.`
                : searchTerm || filterStatus !== "all"
                ? "Essayez de modifier vos critères de recherche ou de filtrage."
                : "Commencez par créer votre premier cours pour vos étudiants."}
            </Text>
            {!searchTerm && filterStatus === "all" && (
              <TouchableOpacity onPress={handleCreateCours} activeOpacity={0.85}>
                <LinearGradient colors={["#4F46E5", "#9333EA"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={coursStyles.emptyBtn}>
                  <FontAwesome5 name="plus" size={13} color="#FFFFFF" />
                  <Text style={coursStyles.newBtnText}>Créer mon premier cours</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* FAB Backdrop (when open) */}
      {isFabOpen && (
        <TouchableWithoutFeedback onPress={closeFab}>
          <View style={coursStyles.fabBackdrop} />
        </TouchableWithoutFeedback>
      )}

      {/* Floating action menu */}
      <View style={coursStyles.fabContainer} pointerEvents="box-none">
        {/* Options are laid out in a normal column with a gap, so they can
            never overlap whatever their height. */}
        {isFabMenuMounted && (
        <Animated.View
          style={[coursStyles.fabMenu, { opacity: fabAnimation, transform: [{ translateY: menuTranslateY }] }]}
          pointerEvents={isFabOpen ? "auto" : "none"}
        >
          <TouchableOpacity style={coursStyles.speedDialCard} onPress={handleProgramCours} activeOpacity={0.85}>
            <View style={[coursStyles.speedDialIconBadge, { backgroundColor: "#F3F4F6", borderColor: "#E5E7EB" }]}>
              <FontAwesome5 name="calendar-alt" size={14} color="#0D9488" />
            </View>
            <View style={coursStyles.speedDialTextContainer}>
              <Text style={coursStyles.speedDialTitle}>Programmer un cours</Text>
              <Text style={coursStyles.speedDialSubtitle}>Planifier une séance de classe</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={10} color="#CBD5E1" />
          </TouchableOpacity>

          <TouchableOpacity style={coursStyles.speedDialCard} onPress={handleCreateCours} activeOpacity={0.85}>
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
        )}

        <Animated.View style={[coursStyles.floatingButton, { transform: [{ rotate: fabRotation }] }]}>
          <TouchableOpacity style={coursStyles.fabTouchable} onPress={toggleFab} activeOpacity={0.85}>
            <FontAwesome5 name="plus" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

const createCoursStyles = (colors: ReturnType<typeof useThemeColors>, isDark: boolean) => {
  // Web's slate palette
  const title = isDark ? "#F8FAFC" : "#0F172A"; // slate-900
  const body = isDark ? "#CBD5E1" : "#475569"; // slate-600
  const sub = isDark ? "#94A3B8" : "#64748B"; // slate-500
  const card = isDark ? "#1E293B" : "#FFFFFF";
  const border = isDark ? "#334155" : "#F1F5F9"; // slate-100
  const input = isDark ? "#0F172A" : "#F8FAFC"; // slate-50
  const inputBorder = isDark ? "#475569" : "#E2E8F0"; // slate-200

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 180 },

    // Header
    pageHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
    headerIcon: {
      padding: 8,
      borderRadius: 8,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    pageTitle: { fontSize: 18, fontWeight: "800", color: title, lineHeight: 22 },
    pageSubtitle: { fontSize: 12, color: sub },

    errorBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: "#FEF2F2",
      borderWidth: 1,
      borderColor: "#FECACA",
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    errorText: { flex: 1, color: "#B91C1C", fontSize: 12 },
    classBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "#EFF6FF",
      borderWidth: 1,
      borderColor: "#BFDBFE",
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    classBannerText: { flex: 1, color: "#1D4ED8", fontSize: 12, fontWeight: "500" },

    // Toolbar
    toolbar: {
      backgroundColor: card,
      borderWidth: 1,
      borderColor: border,
      borderRadius: 12,
      padding: 12,
      gap: 12,
      marginBottom: 16,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    toolbarRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    searchBox: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: input,
      borderWidth: 1,
      borderColor: inputBorder,
      borderRadius: 8,
      paddingHorizontal: 12,
      height: 40,
    },
    searchInput: { flex: 1, fontSize: 14, color: title, paddingVertical: 0 },
    newBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      height: 40,
      borderRadius: 8,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    newBtnText: { color: "#FFFFFF", fontWeight: "600", fontSize: 14 },
    selectPill: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: input,
      borderWidth: 1,
      borderColor: inputBorder,
      borderRadius: 8,
      paddingHorizontal: 10,
      height: 36,
      minWidth: 0,
    },
    selectPillText: { flex: 1, fontSize: 12, color: title },
    sheetOption: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    sheetOptionText: { fontSize: 15, color: colors.text },
    sheetOptionTextActive: { color: "#4F46E5", fontWeight: "700" },
    toggleWrap: {
      flexDirection: "row",
      backgroundColor: isDark ? "#334155" : "#F1F5F9",
      borderRadius: 8,
      padding: 2,
    },
    toggleBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 6 },
    toggleBtnActive: {
      backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 2,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    scheduleBtn: {
      width: 40,
      height: 36,
      borderRadius: 8,
      backgroundColor: card,
      borderWidth: 1,
      borderColor: inputBorder,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 2,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    refreshBtn: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },

    // Grid card (web CourseCard)
    card: {
      backgroundColor: card,
      borderWidth: 1,
      borderColor: isDark ? "#334155" : "rgba(255,255,255,0.5)",
      borderRadius: 16,
      padding: 20,
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 5,
    },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.15,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 4,
    },
    avatarText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
    statusIcon: {
      position: "absolute",
      top: -5,
      right: -5,
      backgroundColor: card,
      borderRadius: 9,
      padding: 1,
    },
    cardTitle: { fontSize: 14, fontWeight: "700", color: title, lineHeight: 18 },
    cardSubject: { fontSize: 12, color: body, marginTop: 4 },
    badge: {
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
      marginBottom: 16,
    },
    badgeText: { fontSize: 12, fontWeight: "600" },
    cardDescription: { fontSize: 14, color: body, marginBottom: 16, lineHeight: 20 },
    metaRow: { flexDirection: "row", alignItems: "center" },
    metaIcon: { width: 22 },
    metaText: { fontSize: 14, color: body, flexShrink: 1 },
    cardFooter: { paddingTop: 14, borderTopWidth: 1, borderTopColor: border },
    actionsRow: { flexDirection: "row", justifyContent: "flex-end", gap: 6 },
    actionBtn: { padding: 8, borderRadius: 8 },
    actionIcon: { color: "#94A3B8" },

    // Table/list layout (web CourseTableRow, stacked for phone width)
    tableCard: {
      backgroundColor: card,
      borderWidth: 1,
      borderColor: isDark ? "#334155" : "rgba(255,255,255,0.5)",
      borderRadius: 12,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 5,
    },
    tableRow: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6, gap: 4 },
    tableRowBorder: { borderTopWidth: 1, borderTopColor: border },
    tableRowTop: { flexDirection: "row", alignItems: "center", gap: 12 },
    avatarSm: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    avatarTextSm: { color: "#FFFFFF", fontWeight: "600", fontSize: 14 },
    tableSub: { fontSize: 12, color: sub, marginTop: 3 },
    tableSubject: { fontSize: 12, color: title, marginTop: 2 },
    badgeInline: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
    },

    // Empty state
    emptyCard: {
      backgroundColor: card,
      borderRadius: 12,
      padding: 24,
      alignItems: "center",
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 5,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: isDark ? "#334155" : "#F1F5F9",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    emptyTitle: { fontSize: 18, fontWeight: "600", color: title, marginBottom: 8, textAlign: "center" },
    emptySubtitle: { fontSize: 14, color: body, textAlign: "center", marginBottom: 16 },
    emptyBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },

    // FAB
    fabBackdrop: {
      ...StyleSheet.absoluteFill,
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
    fabMenu: {
      position: "absolute",
      bottom: 54 + 16, // FAB height + spacing
      right: 0,
      gap: 12,
      alignItems: "stretch",
    },
    speedDialCard: {
      width: 260,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 6,
      gap: 12,
    },
    speedDialIconBadge: {
      width: 36,
      height: 36,
      borderRadius: 10,
      borderWidth: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    speedDialTextContainer: { flex: 1 },
    speedDialTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
    speedDialSubtitle: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
    floatingButton: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: "#3B82F6",
      shadowColor: "#3B82F6",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 8,
    },
    fabTouchable: { width: "100%", height: "100%", justifyContent: "center", alignItems: "center" },
  });
};

export default DashboardCoursBody;
