import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "../../../../context/UserContext";
import { accederService, exerciseService } from "../../../../services/api";
import { classService } from "../../../../services/classService";
import { BottomSheet, LoadingSpinner } from "../../../../components/ui";
import { useThemeColors } from "../../../../styles/theme";
import { useThemeStore } from "../../../../store/useThemeStore";
import { ClassEntity, Exercise } from "../../../../types";
import CreateExerciseView, { NIVEAU_OPTIONS } from "./CreateExerciseView";
import ScheduleExerciseView from "./ScheduleExerciseView";
import ExerciseCorrectionsView from "./ExerciseCorrectionsView";
import { useUiStore } from "../../../../store/useUiStore";
import ExerciseDetailView from "./ExerciseDetailView";
import ProgrammedExercisesOverview from "./ProgrammedExercisesOverview";
import { useT } from "../../../../i18n";
import { formatDate } from "../../../../utils/dates";

// LinearGradient via expo-linear-gradient (safe fallback to View if unavailable)
let LinearGradient: any;
try {
  LinearGradient = require("expo-linear-gradient").LinearGradient;
} catch {
  LinearGradient = ({ children, style, colors: c }: any) => (
    <View style={[style, { backgroundColor: c?.[0] }]}>{children}</View>
  );
}

/*
 * Port of scholchat_front's ManageExercisesContent.jsx (professor view) +
 * ExerciseList.jsx at phone width: gradient header band with "Nouvel
 * exercice", class filter + class banner, success/error alerts, compact filter
 * card (search + refresh, Niveau / Statut / Visibilité), the `sm:hidden` card
 * list with eye / edit / delete actions and 8-per-page pagination. The
 * desktop-only stats strip and table are not rendered (hidden below `sm`).
 */

const PROF_PAGE_SIZE = 8;

const className = (c: ClassEntity) => c.nom || (c as any).name || (c as any).titre || `Classe ${c.id}`;

// Web ExerciseList getStatusTag
const STATUS_TAG: Record<string, { color: string; bg: string; border: string; label: string; icon?: string }> = {
  ACTIF: { color: "#389E0D", bg: "#F6FFED", border: "#B7EB8F", label: "Actif", icon: "check-circle" },
  BROUILLON: { color: "#D48806", bg: "#FFFBE6", border: "#FFE58F", label: "Brouillon", icon: "clock" },
  INACTIF: { color: "#CF1322", bg: "#FFF1F0", border: "#FFA39E", label: "Inactif" },
};

const NIVEAU_FILTER = [{ value: "", label: "Niveau" }, ...NIVEAU_OPTIONS];
const ETAT_FILTER = [
  { value: "", label: "Statut" },
  { value: "ACTIF", label: "Actif" },
  { value: "BROUILLON", label: "Brouillon" },
  { value: "INACTIF", label: "Inactif" },
];
const RESTRICTION_FILTER = [
  { value: "", label: "Visibilité" },
  { value: "PUBLIC", label: "Public" },
  { value: "PRIVE", label: "Privé" },
];

/** Web pagination: 1 … p-1 p p+1 … last */
const pageItems = (total: number, current: number): (number | "…")[] =>
  Array.from({ length: total }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === total || Math.abs(p - current) <= 1)
    .reduce<(number | "…")[]>((acc, p, idx, arr) => {
      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
      acc.push(p);
      return acc;
    }, []);

/** Compact select pill (antd small <Select allowClear>) that opens a bottom sheet. */
const SelectPill = ({
  value,
  options,
  onChange,
  title,
  styles,
  muted,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  title: string;
  styles: Styles;
  muted: string;
}) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) ?? options[0];
  const isPlaceholder = !value;
  return (
    <>
      <TouchableOpacity style={styles.selectPill} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Text style={[styles.selectPillText, isPlaceholder && { color: muted }]} numberOfLines={1}>
          {selected?.label}
        </Text>
        {!isPlaceholder ? (
          <TouchableOpacity onPress={() => onChange("")} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
            <FontAwesome5 name="times-circle" size={11} color={muted} solid />
          </TouchableOpacity>
        ) : (
          <FontAwesome5 name="chevron-down" size={9} color={muted} />
        )}
      </TouchableOpacity>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={title}>
        <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.value || "__all"}
              style={styles.sheetOption}
              onPress={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              <Text style={[styles.sheetOptionText, opt.value === value && styles.sheetOptionTextActive]}>
                {opt.value || opt.label.startsWith("Tout") ? opt.label : "Tous"}
              </Text>
              {opt.value === value ? <FontAwesome5 name="check" size={13} color="#4F46E5" /> : null}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </BottomSheet>
    </>
  );
};

type ViewMode = "list" | "create" | "edit" | "schedule" | "corrections" | "detail";

const DashboardExercisesBody = () => {
  const { user } = useUser();
  const themeColors = useThemeColors();
  const isDark = useThemeStore((s) => s.mode === "dark");
  const styles = useMemo(() => createStyles(themeColors, isDark), [themeColors, isDark]);
  const insets = useSafeAreaInsets();
  const { t: tr } = useT();

  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [professorClasses, setProfessorClasses] = useState<ClassEntity[]>([]);
  const [filterClassId, setFilterClassId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // ExerciseList filters
  const [searchText, setSearchText] = useState("");
  const [filterNiveau, setFilterNiveau] = useState("");
  const [filterEtat, setFilterEtat] = useState("");
  const [filterRestriction, setFilterRestriction] = useState("");
  const [page, setPage] = useState(1);

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  /** "library" = the exercise bank; "programmed" = programmed exercises by class → course. */
  const [listTab, setListTab] = useState<"library" | "programmed">("library");
  const [programmedRefresh, setProgrammedRefresh] = useState(0);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);

  const [isFabOpen, setIsFabOpen] = useState(false);
  const [isFabMenuMounted, setIsFabMenuMounted] = useState(false);
  const fabAnimation = useRef(new Animated.Value(0)).current;

  // Auto-clear messages (5s, like web)
  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(""), 5000);
    return () => clearTimeout(t);
  }, [successMessage]);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 5000);
    return () => clearTimeout(t);
  }, [error]);

  // Web fetchExercises (professor): own exercises + classes for the filter.
  const fetchExercises = useCallback(async () => {
    const userId = user?.userId;
    if (!userId) return;
    setLoading(true);
    setError("");
    try {
      const [ownRes, pubRes, accRes] = await Promise.allSettled([
        exerciseService.getByProfessor(userId),
        classService.getClassesWithPublicationRights(userId),
        accederService.getAccessibleClasses(userId),
      ]);
      const own = ownRes.status === "fulfilled" ? ownRes.value || [] : [];
      const map = new Map<string, ClassEntity>();
      [
        ...(pubRes.status === "fulfilled" ? pubRes.value || [] : []),
        ...(accRes.status === "fulfilled" ? accRes.value || [] : []),
      ].forEach((c) => {
        if (c?.id && !map.has(c.id)) map.set(c.id, c);
      });
      setProfessorClasses(Array.from(map.values()));
      setAllExercises(own.filter((e) => e?.id).map((e) => ({ ...e, id: String(e.id) })));
      if (ownRes.status === "rejected") {
        setError(ownRes.reason instanceof Error ? ownRes.reason.message : "Erreur lors du chargement des exercices");
      }
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    fetchExercises();
  }, [fetchExercises]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchExercises();
    setProgrammedRefresh((n) => n + 1);
    setRefreshing(false);
    setSuccessMessage("Données actualisées avec succès");
  };

  // Web applyClassFilter (client-side; falls back to all when nothing matches)
  const exercises = useMemo(() => {
    if (!filterClassId) return allExercises;
    const filtered = allExercises.filter((e) => {
      const ids = [
        ...((e.classesDiffusees as any[]) || []).map((c: any) => String(c?.id || c)),
        ...((e.classeIds || e.classesIds || []) as any[]).map(String),
      ];
      return ids.includes(String(filterClassId));
    });
    return filtered.length > 0 ? filtered : allExercises;
  }, [allExercises, filterClassId]);

  const filterClassName = (() => {
    const c = professorClasses.find((x) => String(x.id) === String(filterClassId));
    return c ? className(c) : "";
  })();

  const handleDelete = (exercise: Exercise) => {
    Alert.alert("Supprimer l'exercice", `Supprimer "${exercise.nom}" ?`, [
      { text: "Non", style: "cancel" },
      {
        text: "Oui",
        style: "destructive",
        onPress: async () => {
          try {
            await exerciseService.remove(exercise.id);
            setSuccessMessage("Exercice supprimé avec succès");
            fetchExercises();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur lors de la suppression de l'exercice");
          }
        },
      },
    ]);
  };

  // ── FAB ───────────────────────────────────────────────────────────────────
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

  // Opened from a notification tap (useUiStore.requestCorrection): the corrections of that
  // programmed exercise, with the submitting student's copy.
  const pendingCorrection = useUiStore((s) => s.pendingCorrection);
  const [correctionFocus, setCorrectionFocus] = useState<{ exerciseProgrammerId: string; studentId?: string; nonce: number } | null>(null);
  useEffect(() => {
    if (!pendingCorrection) return;
    useUiStore.getState().clearPendingCorrection();
    setCorrectionFocus({ ...pendingCorrection, nonce: Date.now() });
    setViewMode("corrections");
  }, [pendingCorrection]);

  const openCreate = () => {
    closeFab();
    setEditingExercise(null);
    setViewMode("create");
  };
  /** Scheduling page; with a class (from "Programmés"), opens the form with that class preselected. */
  const [scheduleClassId, setScheduleClassId] = useState<string | null>(null);
  const openSchedule = () => {
    closeFab();
    setScheduleClassId(null);
    setViewMode("schedule");
  };
  const openScheduleForClass = (classId: string) => {
    closeFab();
    setScheduleClassId(classId);
    setViewMode("schedule");
  };
  const openCorrections = () => {
    closeFab();
    setCorrectionFocus(null);
    setViewMode("corrections");
  };
  /** Corrections of one programmed exercise (from the "Programmés" view). */
  const openCorrectionsFor = (exerciseProgrammerId: string) => {
    setCorrectionFocus({ exerciseProgrammerId, nonce: Date.now() });
    setViewMode("corrections");
  };
  const openDetail = (id: string) => {
    setSelectedExerciseId(id);
    setViewMode("detail");
  };
  const openEdit = (exercise: Exercise) => {
    setEditingExercise(exercise);
    setViewMode("edit");
  };
  const backToList = () => {
    setSelectedExerciseId(null);
    setEditingExercise(null);
    setViewMode("list");
  };

  // ── Sub-views ─────────────────────────────────────────────────────────────
  if (viewMode === "create" || viewMode === "edit") {
    return (
      <CreateExerciseView
        key={viewMode === "edit" ? `edit-${editingExercise?.id}` : "create"}
        editingExercise={viewMode === "edit" ? editingExercise : null}
        onBack={backToList}
        onCreated={(msg, isError) => {
          backToList();
          if (isError) setError(msg || "");
          else setSuccessMessage(msg || "Exercice créé avec succès");
          fetchExercises();
        }}
        onUpdated={(id, msg, isError) => {
          // Web returns to the details view of the edited exercise.
          setEditingExercise(null);
          setSelectedExerciseId(id);
          setViewMode("detail");
          if (isError) setError(msg || "");
          else setSuccessMessage(msg || "Exercice mis à jour avec succès");
          fetchExercises();
        }}
      />
    );
  }

  if (viewMode === "schedule") {
    return (
      <ScheduleExerciseView
        key={scheduleClassId ? `schedule-${scheduleClassId}` : "schedule"}
        exercises={allExercises}
        initialView={scheduleClassId ? "form" : "list"}
        initialClassId={scheduleClassId}
        onBack={() => setViewMode("list")}
        onScheduled={() => {
          setViewMode("list");
          fetchExercises();
        }}
      />
    );
  }

  if (viewMode === "corrections") {
    return <ExerciseCorrectionsView onBack={() => setViewMode("list")} focus={correctionFocus} />;
  }

  if (viewMode === "detail" && selectedExerciseId) {
    return (
      <ExerciseDetailView
        key={selectedExerciseId}
        exerciseId={selectedExerciseId}
        onBack={backToList}
        onEdit={(id) => {
          const ex = allExercises.find((e) => String(e.id) === String(id)) ?? ({ id } as Exercise);
          openEdit(ex);
        }}
        onDeleted={() => {
          backToList();
          setSuccessMessage("Exercice supprimé avec succès");
          fetchExercises();
        }}
        onChanged={fetchExercises}
      />
    );
  }

  // ── List ──────────────────────────────────────────────────────────────────
  const q = searchText.toLowerCase();
  const filteredExercises = exercises.filter((e) => {
    const matchesSearch =
      !searchText || (e.nom || "").toLowerCase().includes(q) || (e.description || "").toLowerCase().includes(q);
    const matchesNiveau = !filterNiveau || e.niveau === filterNiveau;
    const matchesEtat = !filterEtat || e.etat === filterEtat;
    const matchesRestriction = !filterRestriction || e.restriction === filterRestriction;
    return matchesSearch && matchesNiveau && matchesEtat && matchesRestriction;
  });
  const totalPages = Math.max(1, Math.ceil(filteredExercises.length / PROF_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filteredExercises.slice((safePage - 1) * PROF_PAGE_SIZE, safePage * PROF_PAGE_SIZE);

  const muted = "#94A3B8";
  const fabRotation = fabAnimation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "45deg"] });
  const menuTranslateY = fabAnimation.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  const statusTag = (etat?: string) => {
    const s = etat ? STATUS_TAG[etat] : undefined;
    if (!s)
      return (
        <View style={[styles.tag, { backgroundColor: "#FAFAFA", borderColor: "#D9D9D9" }]}>
          <Text style={[styles.tagText, { color: "#595959" }]}>{etat || "—"}</Text>
        </View>
      );
    return (
      <View style={[styles.tag, { backgroundColor: s.bg, borderColor: s.border }]}>
        {s.icon ? <FontAwesome5 name={s.icon as any} size={10} color={s.color} solid /> : null}
        <Text style={[styles.tagText, { color: s.color }]}>{s.label}</Text>
      </View>
    );
  };
  const restrictionTag = (r?: string) =>
    r === "PUBLIC" ? (
      <View style={[styles.tag, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}>
        <Text style={[styles.tagText, { color: "#1D4ED8" }]}>Public</Text>
      </View>
    ) : r === "PRIVE" ? (
      <View style={[styles.tag, { backgroundColor: "#F5F3FF", borderColor: "#DDD6FE" }]}>
        <Text style={[styles.tagText, { color: "#6D28D9" }]}>Privé</Text>
      </View>
    ) : r ? (
      <View style={[styles.tag, { backgroundColor: "#FAFAFA", borderColor: "#D9D9D9" }]}>
        <Text style={[styles.tagText, { color: "#595959" }]}>{r}</Text>
      </View>
    ) : null;

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 150 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2D6A9F" />}
      >
        {/* ── Professor header band ── */}
        <View style={styles.headerWrap}>
          <LinearGradient colors={["#1A3A5C", "#2D6A9F"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerBand}>
            <View style={styles.headerRow}>
              <View style={styles.headerIcon}>
                <FontAwesome5 name="book" size={16} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.headerTitle} numberOfLines={1}>Gestion des Exercices</Text>
                <Text style={styles.headerSub}>Créez, gérez et programmez des exercices pour vos classes</Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.newBtn} onPress={openCreate} activeOpacity={0.85}>
                <FontAwesome5 name="plus" size={12} color="#1A3A5C" />
                <Text style={styles.newBtnText}>Nouvel exercice</Text>
              </TouchableOpacity>
              {/* Labelled entry to the corrections page (was an unlabelled icon) */}
              <TouchableOpacity style={styles.correctionsBtn} onPress={openCorrections} activeOpacity={0.85}>
                <FontAwesome5 name="clipboard-check" size={13} color="#FFFFFF" />
                <Text style={styles.correctionsBtnText}>Corrections</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {/* ── Library / programmed switch ── */}
        <View style={styles.segment}>
          {(["library", "programmed"] as const).map((k) => {
            const on = listTab === k;
            return (
              <TouchableOpacity
                key={k}
                style={[styles.segmentBtn, on && styles.segmentBtnOn]}
                onPress={() => setListTab(k)}
                activeOpacity={0.85}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
              >
                <FontAwesome5 name={k === "library" ? "book" : "calendar-check"} size={12} color={on ? "#FFFFFF" : muted} />
                <Text style={[styles.segmentText, on && { color: "#FFFFFF" }]}>
                  {k === "library" ? tr("learning.prof.tabLibrary") : tr("learning.prof.tabProgrammed")}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {listTab === "programmed" ? (
          <ProgrammedExercisesOverview
            classes={professorClasses}
            classesLoading={loading && professorClasses.length === 0}
            onOpenCorrections={openCorrectionsFor}
            onSchedule={openScheduleForClass}
            refreshKey={programmedRefresh}
          />
        ) : null}

        {/* ── Class filter + banner ── */}
        {listTab === "library" && (professorClasses.length > 0 || (filterClassId && filterClassName)) ? (
          <View style={styles.classRow}>
            {professorClasses.length > 0 && (
              <View style={{ minWidth: 160, flexGrow: 1, flexDirection: "row" }}>
                <SelectPill
                  value={filterClassId}
                  options={[
                    { value: "", label: "Toutes les classes" },
                    ...professorClasses.map((c) => ({ value: String(c.id), label: className(c) })),
                  ]}
                  onChange={(v) => setFilterClassId(v)}
                  title="Classe"
                  styles={styles}
                  muted={muted}
                />
              </View>
            )}
            {filterClassId && filterClassName ? (
              <View style={[styles.alert, styles.alertInfo, { flexGrow: 1, marginBottom: 0, paddingVertical: 6 }]}>
                <FontAwesome5 name="info-circle" size={13} color="#1677FF" solid />
                <Text style={styles.alertText} numberOfLines={1}>Classe : {filterClassName}</Text>
                <TouchableOpacity onPress={() => setFilterClassId("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <FontAwesome5 name="times" size={11} color="#8C8C8C" />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : null}

        {successMessage ? (
          <View style={[styles.alert, styles.alertSuccess]}>
            <FontAwesome5 name="check-circle" size={13} color="#52C41A" solid />
            <Text style={styles.alertText}>{successMessage}</Text>
            <TouchableOpacity onPress={() => setSuccessMessage("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <FontAwesome5 name="times" size={11} color="#8C8C8C" />
            </TouchableOpacity>
          </View>
        ) : null}
        {error ? (
          <View style={[styles.alert, styles.alertError]}>
            <FontAwesome5 name="times-circle" size={13} color="#FF4D4F" solid />
            <Text style={styles.alertText}>{error}</Text>
            <TouchableOpacity onPress={() => setError("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <FontAwesome5 name="times" size={11} color="#8C8C8C" />
            </TouchableOpacity>
          </View>
        ) : null}

        {listTab !== "library" ? null : loading && !refreshing && allExercises.length === 0 ? (
          <LoadingSpinner label="Chargement des exercices..." />
        ) : (
          <>
            {/* ── Compact filter bar ── */}
            <View style={styles.filterCard}>
              <View style={styles.filterRow}>
                <View style={styles.searchBox}>
                  <FontAwesome5 name="search" size={13} color={muted} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Rechercher un exercice..."
                    value={searchText}
                    onChangeText={(t) => {
                      setSearchText(t);
                      setPage(1);
                    }}
                    placeholderTextColor={muted}
                  />
                </View>
                <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh} disabled={refreshing} accessibilityLabel="Actualiser">
                  {refreshing ? <ActivityIndicator size="small" color="#2D6A9F" /> : <FontAwesome5 name="sync-alt" size={13} color={styles.refreshIcon.color} />}
                </TouchableOpacity>
              </View>
              <View style={[styles.filterRow, { marginTop: 8 }]}>
                <SelectPill value={filterNiveau} options={NIVEAU_FILTER} onChange={(v) => { setFilterNiveau(v); setPage(1); }} title="Niveau" styles={styles} muted={muted} />
                <SelectPill value={filterEtat} options={ETAT_FILTER} onChange={(v) => { setFilterEtat(v); setPage(1); }} title="Statut" styles={styles} muted={muted} />
                <SelectPill value={filterRestriction} options={RESTRICTION_FILTER} onChange={(v) => { setFilterRestriction(v); setPage(1); }} title="Visibilité" styles={styles} muted={muted} />
              </View>
              {filteredExercises.length > 0 && (
                <Text style={styles.foundText}>
                  <Text style={styles.foundCount}>{filteredExercises.length}</Text> exercice
                  {filteredExercises.length !== 1 ? "s" : ""} trouvé{filteredExercises.length !== 1 ? "s" : ""}
                </Text>
              )}
            </View>

            {/* ── Mobile card view ── */}
            {paginated.length === 0 ? (
              <View style={styles.empty}>
                <FontAwesome5 name="inbox" size={36} color={isDark ? "#475569" : "#D9D9D9"} />
                <Text style={styles.emptyText}>Aucun exercice trouvé</Text>
                {allExercises.length === 0 && (
                  <TouchableOpacity style={styles.emptyBtn} onPress={openCreate} activeOpacity={0.85}>
                    <FontAwesome5 name="plus" size={12} color="#FFFFFF" />
                    <Text style={styles.emptyBtnText}>Créer votre premier exercice</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {paginated.map((record) => (
                  <View key={record.id} style={styles.card}>
                    <View style={styles.cardTop}>
                      <TouchableOpacity style={{ flex: 1, minWidth: 0 }} onPress={() => openDetail(record.id)} activeOpacity={0.7}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{record.nom}</Text>
                        {record.description ? (
                          <Text style={styles.cardDesc} numberOfLines={2}>{record.description}</Text>
                        ) : null}
                      </TouchableOpacity>
                      <View style={styles.cardActions}>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => openDetail(record.id)} accessibilityLabel="Voir les détails">
                          <FontAwesome5 name="eye" size={14} color={isDark ? "#60A5FA" : "#2D6A9F"} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(record)} accessibilityLabel="Modifier">
                          <FontAwesome5 name="edit" size={13} color={isDark ? "#CBD5E1" : "#595959"} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(record)} accessibilityLabel="Supprimer">
                          <FontAwesome5 name="trash" size={13} color="#FF4D4F" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={styles.tagsRow}>
                      {record.niveau ? (
                        <View style={[styles.tag, { backgroundColor: "#E0F7FA", borderColor: "#B2EBF2" }]}>
                          <Text style={[styles.tagText, { color: "#00838F" }]}>{record.niveau}</Text>
                        </View>
                      ) : null}
                      {statusTag(record.etat)}
                      {restrictionTag(record.restriction)}
                      {record.dateCreation ? (
                        <Text style={styles.cardDate}>{formatDate(record.dateCreation)}</Text>
                      ) : null}
                    </View>
                    {record.matieres && record.matieres.length > 0 ? (
                      <View style={[styles.tagsRow, { marginTop: 8, gap: 4 }]}>
                        {record.matieres.slice(0, 3).map((m: any) => (
                          <View key={m.id || m} style={styles.matiereChip}>
                            <Text style={styles.matiereChipText}>{m.nom || m}</Text>
                          </View>
                        ))}
                        {record.matieres.length > 3 && <Text style={styles.moreText}>+{record.matieres.length - 3}</Text>}
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            )}

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <View style={styles.pagination}>
                <Text style={styles.pageInfo}>
                  {filteredExercises.length} exercice{filteredExercises.length !== 1 ? "s" : ""} · page {safePage}/{totalPages}
                </Text>
                <View style={styles.pageBtns}>
                  <TouchableOpacity
                    style={[styles.pageBtn, safePage === 1 && styles.pageBtnDisabled]}
                    disabled={safePage === 1}
                    onPress={() => setPage(Math.max(1, safePage - 1))}
                  >
                    <FontAwesome5 name="chevron-left" size={10} color={styles.pageBtnText.color} />
                  </TouchableOpacity>
                  {pageItems(totalPages, safePage).map((p, idx) =>
                    p === "…" ? (
                      <Text key={`e-${idx}`} style={styles.pageEllipsis}>…</Text>
                    ) : (
                      <TouchableOpacity
                        key={p}
                        style={[styles.pageBtn, p === safePage && styles.pageBtnActive]}
                        onPress={() => setPage(p)}
                      >
                        <Text style={[styles.pageBtnText, p === safePage && { color: "#FFFFFF" }]}>{p}</Text>
                      </TouchableOpacity>
                    )
                  )}
                  <TouchableOpacity
                    style={[styles.pageBtn, safePage === totalPages && styles.pageBtnDisabled]}
                    disabled={safePage === totalPages}
                    onPress={() => setPage(Math.min(totalPages, safePage + 1))}
                  >
                    <FontAwesome5 name="chevron-right" size={10} color={styles.pageBtnText.color} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* FAB Backdrop */}
      {isFabOpen && (
        <TouchableWithoutFeedback onPress={closeFab}>
          <View style={styles.fabBackdrop} />
        </TouchableWithoutFeedback>
      )}

      {/* Floating action menu */}
      <View style={styles.fabContainer} pointerEvents="box-none">
        {/* Options laid out in one column with a gap above the FAB, mounted on
            open and unmounted immediately on close (no fade-out → no ghost
            elevation shadows on Android, no overlap). */}
        {isFabMenuMounted && (
          <Animated.View
            style={[styles.fabMenu, { opacity: fabAnimation, transform: [{ translateY: menuTranslateY }] }]}
            pointerEvents={isFabOpen ? "auto" : "none"}
          >
            <TouchableOpacity style={styles.speedDialCard} onPress={openCorrections} activeOpacity={0.85}>
              <View style={[styles.speedDialIconBadge, { backgroundColor: "#F5F3FF", borderColor: "#DDD6FE" }]}>
                <FontAwesome5 name="clipboard-check" size={14} color="#7C3AED" />
              </View>
              <View style={styles.speedDialTextContainer}>
                <Text style={styles.speedDialTitle}>Corriger les devoirs</Text>
                <Text style={styles.speedDialSubtitle}>Noter les copies rendues</Text>
              </View>
              <FontAwesome5 name="chevron-right" size={10} color="#CBD5E1" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.speedDialCard} onPress={openSchedule} activeOpacity={0.85}>
              <View style={[styles.speedDialIconBadge, { backgroundColor: isDark ? "#334155" : "#F3F4F6", borderColor: isDark ? "#475569" : "#E5E7EB" }]}>
                <FontAwesome5 name="calendar-alt" size={14} color="#0D9488" />
              </View>
              <View style={styles.speedDialTextContainer}>
                <Text style={styles.speedDialTitle}>Programmer un exercice</Text>
                <Text style={styles.speedDialSubtitle}>Assigner à une classe</Text>
              </View>
              <FontAwesome5 name="chevron-right" size={10} color="#CBD5E1" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.speedDialCard} onPress={openCreate} activeOpacity={0.85}>
              <View style={[styles.speedDialIconBadge, { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }]}>
                <FontAwesome5 name="plus" size={14} color="#059669" />
              </View>
              <View style={styles.speedDialTextContainer}>
                <Text style={styles.speedDialTitle}>Créer un exercice</Text>
                <Text style={styles.speedDialSubtitle}>QCM ou devoir à faire</Text>
              </View>
              <FontAwesome5 name="chevron-right" size={10} color="#CBD5E1" />
            </TouchableOpacity>
          </Animated.View>
        )}

        <Animated.View style={[styles.floatingButton, { transform: [{ rotate: fabRotation }] }]}>
          <TouchableOpacity style={styles.fabTouchable} onPress={toggleFab} activeOpacity={0.85}>
            <FontAwesome5 name="plus" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>, isDark: boolean) => {
  const title = isDark ? "#F8FAFC" : "#111827"; // gray-900
  const body = isDark ? "#CBD5E1" : "#374151";
  const sub = isDark ? "#94A3B8" : "#9CA3AF"; // gray-400
  const card = isDark ? "#1E293B" : "#FFFFFF";
  const border = isDark ? "#334155" : "#F1F5F9"; // slate-100
  const input = isDark ? "#0F172A" : "#F8FAFC"; // slate-50
  const inputBorder = isDark ? "#475569" : "#E2E8F0"; // slate-200

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    // Rendered under the shared app header — normal top spacing only.
    scrollContent: { paddingHorizontal: 12, paddingTop: 12 },

    // Header band
    headerWrap: {
      borderRadius: 12,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: isDark ? "#334155" : "#E8EDF5",
      marginBottom: 16,
    },
    headerBand: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
    headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    headerIcon: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: "rgba(255,255,255,0.15)",
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { color: "#FFFFFF", fontWeight: "800", fontSize: 16, lineHeight: 20 },
    headerSub: { color: "#DBEAFE", fontSize: 12, opacity: 0.9 },
    headerActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    correctionsBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "rgba(255,255,255,0.15)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.45)",
      borderRadius: 8,
      paddingHorizontal: 15,
      paddingVertical: 8,
    },
    correctionsBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
    newBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "#FFFFFF",
      borderRadius: 8,
      paddingHorizontal: 15,
      paddingVertical: 8,
    },
    newBtnText: { color: "#1A3A5C", fontWeight: "700", fontSize: 14 },

    segment: {
      flexDirection: "row",
      gap: 6,
      padding: 4,
      borderRadius: 12,
      backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
      marginBottom: 14,
    },
    segmentBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 9 },
    segmentBtnOn: { backgroundColor: "#2D6A9F" },
    segmentText: { fontSize: 13, fontWeight: "700", color: isDark ? "#CBD5E1" : "#475569" },
    classRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 16 },

    // Alerts (antd)
    alert: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 9,
      marginBottom: 16,
    },
    alertInfo: { backgroundColor: "#E6F4FF", borderColor: "#91CAFF" },
    alertSuccess: { backgroundColor: "#F6FFED", borderColor: "#B7EB8F" },
    alertError: { backgroundColor: "#FFF2F0", borderColor: "#FFCCC7" },
    alertText: { flex: 1, fontSize: 13, color: "#262626" },

    // Filter card
    filterCard: {
      backgroundColor: card,
      borderWidth: 1,
      borderColor: border,
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 2,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    filterRow: { flexDirection: "row", alignItems: "center", gap: 8 },
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
      height: 38,
    },
    searchInput: { flex: 1, fontSize: 14, color: title, paddingVertical: 0 },
    refreshBtn: {
      width: 38,
      height: 38,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDark ? "#475569" : "#D9D9D9",
      backgroundColor: card,
      alignItems: "center",
      justifyContent: "center",
    },
    refreshIcon: { color: isDark ? "#CBD5E1" : "#595959" },
    selectPill: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: card,
      borderWidth: 1,
      borderColor: isDark ? "#475569" : "#D9D9D9",
      borderRadius: 6,
      paddingHorizontal: 8,
      height: 30,
      minWidth: 0,
    },
    selectPillText: { flex: 1, fontSize: 13, color: title },
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
    foundText: { fontSize: 12, color: isDark ? "#94A3B8" : "#64748B", marginTop: 8 },
    foundCount: { fontWeight: "700", color: isDark ? "#E2E8F0" : "#334155" },

    // Cards
    card: {
      backgroundColor: card,
      borderWidth: 1,
      borderColor: border,
      borderRadius: 12,
      padding: 16,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 2,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 8 },
    cardTitle: { fontSize: 14, fontWeight: "700", color: title },
    cardDesc: { fontSize: 12, color: sub, marginTop: 2, lineHeight: 16 },
    cardActions: { flexDirection: "row", alignItems: "center", gap: 2 },
    actionBtn: { padding: 6, borderRadius: 6 },
    tagsRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
    tag: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      borderWidth: 1,
    },
    tagText: { fontSize: 12, fontWeight: "500" },
    cardDate: { fontSize: 12, color: sub, marginLeft: "auto" },
    matiereChip: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: isDark ? "rgba(124,58,237,0.2)" : "#F3E8FF",
    },
    matiereChipText: { fontSize: 12, color: isDark ? "#C4B5FD" : "#7C3AED" },
    moreText: { fontSize: 12, color: sub },

    // Empty
    empty: { alignItems: "center", paddingVertical: 32 },
    emptyText: { fontSize: 14, color: sub, marginTop: 10, marginBottom: 12 },
    emptyBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "#1677FF",
      borderRadius: 8,
      paddingHorizontal: 15,
      paddingVertical: 8,
    },
    emptyBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "500" },

    // Pagination
    pagination: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginTop: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: isDark ? "#334155" : "#F3F4F6",
    },
    pageInfo: { fontSize: 12, color: isDark ? "#94A3B8" : "#6B7280" },
    pageBtns: { flexDirection: "row", alignItems: "center", gap: 4 },
    pageBtn: {
      minWidth: 28,
      height: 26,
      paddingHorizontal: 6,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: isDark ? "#475569" : "#D9D9D9",
      backgroundColor: card,
      alignItems: "center",
      justifyContent: "center",
    },
    pageBtnActive: { backgroundColor: "#1677FF", borderColor: "#1677FF" },
    pageBtnDisabled: { opacity: 0.4 },
    pageBtnText: { fontSize: 12, color: body },
    pageEllipsis: { paddingHorizontal: 2, fontSize: 12, color: sub },

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

type Styles = ReturnType<typeof createStyles>;

export default DashboardExercisesBody;
