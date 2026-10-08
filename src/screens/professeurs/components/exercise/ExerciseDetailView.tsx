import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheet, LoadingSpinner } from "../../../../components/ui";
import DateTimeField from "../../../../components/common/DateTimeField";
import { useThemeColors } from "../../../../styles/theme";
import { useThemeStore } from "../../../../store/useThemeStore";
import { accederService, exerciseProgrammerService, exerciseService } from "../../../../services/api";
import { classService } from "../../../../services/classService";
import { useUser } from "../../../../context/UserContext";
import { ClassEntity, Exercise } from "../../../../types";
import { NIVEAU_GRADES, NIVEAU_OPTIONS, mapNiveauToEnum } from "./CreateExerciseView";
import { formatDate, serverDateMs, toServerDateTime } from "../../../../utils/dates";
import { translate } from "../../../../i18n";
import CoursePickerField, {
  CoursParClasseValue,
  classesWithoutCourse,
  countProgrammations,
  toCoursParClasse,
} from "./CoursePickerField";

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
 * Port of scholchat_front's ExerciseDetailsView.jsx (+ exerciseDetails/
 * ExerciseInfoPanel.jsx, ProgramModal.jsx, helpers.js) for the professor:
 * hero banner (Retour / Actualiser, title + état, meta, Programmer / Modifier
 * (inline edit) / Supprimer), Informations card, Cours liés, Questions list.
 *   inline save: PUT /exercises/{id} { nom, description, niveau, restriction, etat }
 *   programmer:  POST /exercises-programmer[/programmer-et-diffuser]
 *     { exerciseId, programmeParId, typeAssignation, dateExoPrevue,
 *       dateDebutExoEffectif, dateFinExoEffectif, classeIds, etat: "ACTIF" }
 */

// Web TYPE_MAP (question type badge)
const TYPE_MAP: Record<string, { label: string; color: string; bg: string }> = {
  REPONSE_COURTE: { label: "Réponse courte", color: "#4F46E5", bg: "#EEF2FF" },
  QCM: { label: "Choix multiple", color: "#0891B2", bg: "#ECFEFF" },
  VRAI_FAUX: { label: "Vrai / Faux", color: "#16A34A", bg: "#F0FDF4" },
  REPONSE_LONGUE: { label: "Réponse longue", color: "#D97706", bg: "#FFFBEB" },
  DEVELOPPEMENT: { label: "Développement", color: "#D97706", bg: "#FFFBEB" },
  TROU: { label: "Texte à trous", color: "#7C3AED", bg: "#F5F3FF" },
};

// Hero état badge (web etatCfg)
const ETAT_CFG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  ACTIF: { label: "Actif", bg: "#F0FDF4", color: "#16A34A", border: "#BBF7D0" },
  PUBLIE: { label: "Publié", bg: "#EFF6FF", color: "#2563EB", border: "#BFDBFE" },
  BROUILLON: { label: "Brouillon", bg: "#FFFBEB", color: "#D97706", border: "#FDE68A" },
  INACTIF: { label: "Inactif", bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
};

// helpers.js STATUS_CONFIG (info panel tag)
const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string; icon: string }> = {
  ACTIF: { color: "#389E0D", bg: "#F6FFED", border: "#B7EB8F", label: "Actif", icon: "check-circle" },
  PUBLIE: { color: "#1677FF", bg: "#E6F4FF", border: "#91CAFF", label: "Publié", icon: "paper-plane" },
  BROUILLON: { color: "#D48806", bg: "#FFFBE6", border: "#FFE58F", label: "Brouillon", icon: "clock" },
  INACTIF: { color: "#8C8C8C", bg: "#FAFAFA", border: "#D9D9D9", label: "Inactif", icon: "stop" },
  CORRIGE: { color: "#531DAB", bg: "#F9F0FF", border: "#D3ADF7", label: "Corrigé", icon: "trophy" },
  EN_ATTENTE_CORRECTION: { color: "#D46B08", bg: "#FFF7E6", border: "#FFD591", label: "En attente", icon: "clock" },
  VALIDE: { color: "#389E0D", bg: "#F6FFED", border: "#B7EB8F", label: "Validé", icon: "check-circle" },
  ANNULE: { color: "#CF1322", bg: "#FFF1F0", border: "#FFA39E", label: "Annulé", icon: "stop" },
};

const fmtDate = (d?: string) =>
  d ? formatDate(d, { day: "2-digit", month: "short", year: "numeric" }) : "—";

const className = (c: ClassEntity) => c.nom || (c as any).name || (c as any).titre || `Classe ${c.id}`;

const makePalette = (isDark: boolean) => ({
  title: isDark ? "#F8FAFC" : "#1E293B", // slate-800
  body: isDark ? "#CBD5E1" : "#475569",
  sub: isDark ? "#94A3B8" : "#64748B",
  muted: isDark ? "#64748B" : "#94A3B8",
  card: isDark ? "#1E293B" : "#FFFFFF",
  cardBorder: isDark ? "#334155" : "#F1F5F9",
  cardHead: isDark ? "#0F172A" : "#F8FAFF",
  rowDivider: isDark ? "#334155" : "#F3F4F6",
  soft: isDark ? "#0F172A" : "#F8FAFC",
  input: isDark ? "#0F172A" : "#FFFFFF",
  inputBorder: isDark ? "#475569" : "#D9D9D9",
  indigo: isDark ? "#A5B4FC" : "#4F46E5",
  indigoSoft: isDark ? "rgba(99,102,241,0.2)" : "#E0E7FF",
  footer: isDark ? "#0F172A" : "#FAFBFF",
  infoBg: isDark ? "rgba(59,130,246,0.12)" : "#F0F5FF",
  infoBorder: isDark ? "rgba(147,197,253,0.4)" : "#ADC6FF",
});
type Palette = ReturnType<typeof makePalette>;

const Pill = ({ text, color, bg, border, icon }: { text: string; color: string; bg: string; border: string; icon?: string }) => (
  <View style={[pillStyles.pill, { backgroundColor: bg, borderColor: border }]}>
    {icon ? <FontAwesome5 name={icon as any} size={10} color={color} solid /> : null}
    <Text style={[pillStyles.pillText, { color }]}>{text}</Text>
  </View>
);
const pillStyles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: { fontSize: 12, fontWeight: "500" },
});

const restrictionPill = (r?: string) =>
  r === "PUBLIC" ? (
    <Pill text="Public" color="#1D4ED8" bg="#EFF6FF" border="#BFDBFE" />
  ) : (
    <Pill text="Privé" color="#6D28D9" bg="#F5F3FF" border="#DDD6FE" />
  );

const statusPill = (s?: string) => {
  const c = s ? STATUS_CONFIG[s] : undefined;
  if (!c) return <Pill text={s || "—"} color="#595959" bg="#FAFAFA" border="#D9D9D9" />;
  return <Pill text={c.label} color={c.color} bg={c.bg} border={c.border} icon={c.icon} />;
};

/** Field opening a bottom sheet of options (antd <Select>). */
const SheetSelect = ({
  value,
  options,
  onChange,
  title,
  multiple,
  styles,
  palette,
  placeholder,
  error,
}: {
  value: string | string[];
  options: { value: string; label: string; desc?: string; icon?: string; iconColor?: string }[];
  onChange: (v: any) => void;
  title: string;
  multiple?: boolean;
  styles: Styles;
  palette: Palette;
  placeholder?: string;
  error?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const display = values.map((v) => options.find((o) => o.value === v)?.label ?? v).join(", ");
  const single = !multiple ? options.find((o) => o.value === value) : undefined;
  return (
    <>
      <TouchableOpacity style={[styles.input, styles.selectField, error && styles.inputError]} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          {single?.icon ? <FontAwesome5 name={single.icon as any} size={13} color={single.iconColor ?? palette.body} /> : null}
          <Text style={[styles.selectText, !display && { color: palette.muted }]} numberOfLines={multiple ? 2 : 1}>
            {display || placeholder || "Sélectionner"}
          </Text>
        </View>
        <FontAwesome5 name="chevron-down" size={10} color={palette.muted} />
      </TouchableOpacity>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={title}>
        <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
          {options.length === 0 ? <Text style={styles.sheetEmpty}>Aucune option</Text> : null}
          {options.map((opt) => {
            const active = values.includes(opt.value);
            return (
              <TouchableOpacity
                key={opt.value}
                style={styles.sheetOption}
                onPress={() => {
                  if (multiple) onChange(active ? values.filter((v) => v !== opt.value) : [...values, opt.value]);
                  else {
                    onChange(opt.value);
                    setOpen(false);
                  }
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                  {opt.icon ? <FontAwesome5 name={opt.icon as any} size={14} color={opt.iconColor ?? palette.body} /> : null}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetOptionText, active && styles.sheetOptionTextActive]}>{opt.label}</Text>
                    {opt.desc ? <Text style={styles.sheetOptionDesc}>{opt.desc}</Text> : null}
                  </View>
                </View>
                {active ? <FontAwesome5 name="check" size={13} color="#4F46E5" /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {multiple ? (
          <TouchableOpacity style={styles.sheetDone} onPress={() => setOpen(false)}>
            <Text style={styles.sheetDoneText}>Valider</Text>
          </TouchableOpacity>
        ) : null}
      </BottomSheet>
    </>
  );
};

const Field = ({ label, required, children, styles }: { label: string; required?: boolean; children: React.ReactNode; styles: Styles }) => (
  <View style={styles.formField}>
    <Text style={styles.formLabel}>
      {required ? <Text style={{ color: "#FF4D4F" }}>* </Text> : null}
      {label}
    </Text>
    {children}
  </View>
);

const PlainInput = ({ styles, palette, style, ...props }: TextInputProps & { styles: Styles; palette: Palette }) => (
  <TextInput {...props} placeholderTextColor={palette.muted} style={[styles.input, style]} />
);

export interface ExerciseDetailViewProps {
  exerciseId: string;
  onBack: () => void;
  /** Opens the full edit form (web "Gérer" / "Ajouter / modifier"). */
  onEdit: (exerciseId: string) => void;
  /** Called after the exercise was deleted. */
  onDeleted: () => void;
  /** Called after an inline save / scheduling so the list can refresh. */
  onChanged?: () => void;
}

export const ExerciseDetailView = ({ exerciseId, onBack, onEdit, onDeleted, onChanged }: ExerciseDetailViewProps) => {
  const colors = useThemeColors();
  const isDark = useThemeStore((s) => s.mode === "dark");
  const palette = useMemo(() => makePalette(isDark), [isDark]);
  const styles = useMemo(() => createStyles(colors, palette), [colors, palette]);
  const insets = useSafeAreaInsets();
  const { user } = useUser();

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);

  // Inline edit (web ExerciseInfoPanel editing mode)
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nom: "", description: "", niveau: "", restriction: "PRIVE", etat: "BROUILLON" });
  const [formSubmitted, setFormSubmitted] = useState(false);

  // Program modal
  const [showProgram, setShowProgram] = useState(false);
  const [programLoading, setProgramLoading] = useState(false);
  const [prog, setProg] = useState({
    typeAssignation: "EXERCICE" as "EXERCICE" | "DEVOIR",
    dateExoPrevue: "",
    dateDebutExoEffectif: "",
    dateFinExoEffectif: "",
    classeIds: [] as string[],
    /** Course chosen per selected class: course id (required for every class: no exercise without a course). */
    coursParClasse: {} as CoursParClasseValue,
    diffuseImmediately: true,
  });
  const [progSubmitted, setProgSubmitted] = useState(false);

  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  const resetForm = (data: Exercise) =>
    setForm({
      nom: data.nom || "",
      description: data.description || "",
      niveau: data.niveau || "",
      restriction: data.restriction || "PRIVE",
      etat: data.etat || "BROUILLON",
    });

  const fetchExercise = useCallback(async () => {
    try {
      setLoading(true);
      const data = await exerciseService.getById(exerciseId);
      setExercise(data);
      resetForm(data);
    } catch {
      setNotice({ kind: "error", text: "Impossible de charger l'exercice" });
    } finally {
      setLoading(false);
    }
  }, [exerciseId]);

  // Web obtenirClassesUtilisateur: publication-rights classes ∪ accessible classes
  const fetchClasses = useCallback(async () => {
    if (!user?.userId) return;
    setClassesLoading(true);
    try {
      const [pub, acc] = await Promise.all([
        classService.getClassesWithPublicationRights(user.userId).catch(() => [] as ClassEntity[]),
        accederService.getAccessibleClasses(user.userId).catch(() => [] as ClassEntity[]),
      ]);
      const map = new Map<string, ClassEntity>();
      [...(pub || []), ...(acc || [])].forEach((c) => {
        if (c?.id && !map.has(c.id)) map.set(c.id, c);
      });
      setClasses(Array.from(map.values()));
    } finally {
      setClassesLoading(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    if (!exerciseId) return;
    fetchExercise();
    fetchClasses();
  }, [exerciseId, fetchExercise, fetchClasses]);

  const handleSave = async () => {
    setFormSubmitted(true);
    if (!form.nom.trim() || !form.niveau || !form.restriction || !form.description.trim()) {
      setNotice({ kind: "error", text: "Erreur lors de la sauvegarde" });
      return;
    }
    try {
      setSaving(true);
      // Web updateExercise: { nom, description, niveau: mapNiveauToEnum(niveau), restriction, etat }
      await exerciseService.update(exerciseId, {
        nom: form.nom,
        description: form.description,
        niveau: form.niveau ? mapNiveauToEnum(form.niveau) : undefined,
        restriction: form.restriction,
        etat: form.etat,
      });
      setExercise((prev) => (prev ? { ...prev, ...form } : prev));
      setEditing(false);
      setFormSubmitted(false);
      setNotice({ kind: "success", text: "Exercice mis à jour" });
      onChanged?.();
    } catch {
      setNotice({ kind: "error", text: "Erreur lors de la sauvegarde" });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setFormSubmitted(false);
    if (exercise) resetForm(exercise);
  };

  const handleDelete = () => {
    Alert.alert("Supprimer cet exercice ?", "Cette action est irréversible.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await exerciseService.remove(exerciseId);
            onDeleted();
          } catch {
            setNotice({ kind: "error", text: "Erreur lors de la suppression" });
          }
        },
      },
    ]);
  };

  const resetProgram = () => {
    setProg({
      typeAssignation: "EXERCICE",
      dateExoPrevue: "",
      dateDebutExoEffectif: "",
      dateFinExoEffectif: "",
      classeIds: [],
      coursParClasse: {},
      diffuseImmediately: true,
    });
    setProgSubmitted(false);
  };

  const progErrors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!progSubmitted) return e;
    if (!prog.dateExoPrevue) e.dateExoPrevue = "Requis";
    if (!prog.dateDebutExoEffectif) e.dateDebutExoEffectif = "Requis";
    if (!prog.dateFinExoEffectif) e.dateFinExoEffectif = "Requis";
    else if (prog.dateDebutExoEffectif && serverDateMs(prog.dateFinExoEffectif, NaN) <= serverDateMs(prog.dateDebutExoEffectif, NaN))
      e.dateFinExoEffectif = "Doit être après le début";
    if (prog.classeIds.length === 0) e.classeIds = "Sélectionnez au moins une classe";
    else if (classesWithoutCourse(prog.coursParClasse, prog.classeIds).length > 0)
      e.coursId = translate("learning.schedule.courseRequired");
    return e;
  }, [progSubmitted, prog]);

  const handleProgram = async () => {
    setProgSubmitted(true);
    const invalid =
      !prog.dateExoPrevue ||
      !prog.dateDebutExoEffectif ||
      !prog.dateFinExoEffectif ||
      serverDateMs(prog.dateFinExoEffectif, NaN) <= serverDateMs(prog.dateDebutExoEffectif, NaN) ||
      prog.classeIds.length === 0 ||
      classesWithoutCourse(prog.coursParClasse, prog.classeIds).length > 0;
    if (invalid) return;
    const userId = user?.userId;
    if (!userId) {
      Alert.alert("Erreur", "Utilisateur non connecté");
      return;
    }
    setProgramLoading(true);
    try {
      const payload = {
        exerciseId,
        programmeParId: userId,
        typeAssignation: prog.typeAssignation,
        dateExoPrevue: toServerDateTime(prog.dateExoPrevue) ?? undefined,
        dateDebutExoEffectif: toServerDateTime(prog.dateDebutExoEffectif) ?? undefined,
        dateFinExoEffectif: toServerDateTime(prog.dateFinExoEffectif) ?? undefined,
        classeIds: prog.classeIds || [],
        coursParClasse: toCoursParClasse(prog.coursParClasse, prog.classeIds || []),
        etat: "ACTIF",
      };
      const diffuse = prog.diffuseImmediately !== false;
      const created = diffuse
        ? await exerciseProgrammerService.programmerEtDiffuser(payload)
        : await exerciseProgrammerService.programmer(payload);
      const n = countProgrammations(created);
      const base = diffuse ? "Exercice programmé et diffusé" : "Exercice programmé";
      setNotice({
        kind: "success",
        text: n > 1 ? `${base} : ${translate("learning.schedule.createdMany", { count: n })}` : `${base} !`,
      });
      setShowProgram(false);
      resetProgram();
      onChanged?.();
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur lors de la programmation");
    } finally {
      setProgramLoading(false);
    }
  };

  if (loading && !exercise) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <LoadingSpinner label="Chargement..." />
      </View>
    );
  }

  if (!exercise) {
    return (
      <View style={[styles.container, { padding: 16 }]}>
        <TouchableOpacity style={styles.plainBack} onPress={onBack}>
          <FontAwesome5 name="arrow-left" size={13} color="#FFFFFF" />
          <Text style={styles.plainBackText}>Retour</Text>
        </TouchableOpacity>
        <Text style={{ color: "#EF4444" }}>Impossible de charger l'exercice.</Text>
      </View>
    );
  }

  const questions = exercise.questions || [];
  const etat = ETAT_CFG[exercise.etat || ""] || { label: exercise.etat || "—", bg: "#F3F4F6", color: "#6B7280", border: "#E5E7EB" };
  const niveauGradeOptions = [
    ...(form.niveau && !NIVEAU_GRADES.includes(form.niveau)
      ? [{ value: form.niveau, label: NIVEAU_OPTIONS.find((n) => n.value === form.niveau)?.label ?? form.niveau }]
      : []),
    ...NIVEAU_GRADES.map((n) => ({ value: n, label: n })),
  ];

  // Label on the left, value right-aligned; `stacked` puts long values
  // (description) under the label instead.
  const InfoRow = ({ label, children, last, stacked }: { label: string; children: React.ReactNode; last?: boolean; stacked?: boolean }) => (
    <View style={[styles.infoRow, stacked && styles.infoRowStacked, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={stacked ? undefined : styles.infoValueWrap}>{children}</View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 150 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Compact hero banner ── */}
        <LinearGradient
          colors={["#1E3A5F", "#2D6A9F", "#4F8EC9"]}
          locations={[0, 0.6, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroCircle} pointerEvents="none" />
          {/* Row 1: back + refresh */}
          <View style={[styles.rowCenter, { marginBottom: 12 }]}>
            <TouchableOpacity style={styles.heroBack} onPress={onBack} activeOpacity={0.8}>
              <FontAwesome5 name="arrow-left" size={12} color="#FFFFFF" />
              <Text style={styles.heroBackText}>Retour</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={styles.heroRefresh} onPress={fetchExercise} accessibilityLabel="Actualiser">
              {loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <FontAwesome5 name="sync-alt" size={12} color="#FFFFFF" />}
            </TouchableOpacity>
          </View>

          {/* Row 2: title + meta */}
          <View style={{ marginBottom: 12 }}>
            <View style={styles.titleRow}>
              <Text style={styles.heroTitle} numberOfLines={2}>{exercise.nom}</Text>
              <View style={[styles.etatBadge, { backgroundColor: etat.bg, borderColor: etat.border }]}>
                <Text style={[styles.etatBadgeText, { color: etat.color }]}>{etat.label}</Text>
              </View>
            </View>
            <View style={styles.metaWrap}>
              {exercise.niveau ? (
                <View style={styles.metaItem}>
                  <FontAwesome5 name="book" size={10} color="#DBEAFE" />
                  <Text style={styles.metaText}>{exercise.niveau}</Text>
                </View>
              ) : null}
              <View style={styles.metaItem}>
                <FontAwesome5 name={exercise.restriction === "PUBLIC" ? "globe" : "lock"} size={10} color="#DBEAFE" />
                <Text style={styles.metaText}>{exercise.restriction === "PUBLIC" ? "Public" : "Privé"}</Text>
              </View>
              {exercise.dateCreation ? (
                <View style={styles.metaItem}>
                  <FontAwesome5 name="clock" size={10} color="#DBEAFE" />
                  <Text style={styles.metaText}>{formatDate(exercise.dateCreation)}</Text>
                </View>
              ) : null}
              {exercise.matieres && exercise.matieres.length > 0 ? (
                <View style={[styles.metaItem, { flexShrink: 1 }]}>
                  <FontAwesome5 name="tag" size={10} color="#DBEAFE" />
                  <Text style={[styles.metaText, { flexShrink: 1 }]}>{exercise.matieres.map((m) => m.nom).join(", ")}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Row 3: actions */}
          <View style={styles.heroActions}>
            {!editing ? (
              <>
                <TouchableOpacity onPress={() => setShowProgram(true)} activeOpacity={0.85}>
                  <LinearGradient colors={["#4F46E5", "#7C3AED"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroBtn}>
                    <FontAwesome5 name="paper-plane" size={11} color="#FFFFFF" />
                    <Text style={styles.heroBtnText}>Programmer</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.heroBtn, styles.heroBtnGhost]} onPress={() => setEditing(true)} activeOpacity={0.85}>
                  <FontAwesome5 name="edit" size={11} color="#FFFFFF" />
                  <Text style={styles.heroBtnText}>Modifier</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.heroBtn, styles.heroBtnDanger]} onPress={handleDelete} activeOpacity={0.85} accessibilityLabel="Supprimer">
                  <FontAwesome5 name="trash" size={11} color="#FCA5A5" />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={[styles.heroBtn, styles.heroBtnGhostSoft]} onPress={handleCancelEdit} activeOpacity={0.85}>
                  <FontAwesome5 name="times" size={11} color="#FFFFFF" />
                  <Text style={styles.heroBtnText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.85} style={saving && { opacity: 0.6 }}>
                  <LinearGradient colors={["#16A34A", "#15803D"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroBtn}>
                    <FontAwesome5 name="save" size={11} color="#FFFFFF" />
                    <Text style={styles.heroBtnText}>{saving ? "Sauvegarde..." : "Sauvegarder"}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </View>
        </LinearGradient>

        {/* ── Body ── */}
        <View style={styles.body}>
          {notice ? (
            <View style={[styles.notice, notice.kind === "success" ? styles.noticeSuccess : styles.noticeError]}>
              <FontAwesome5
                name={notice.kind === "success" ? "check-circle" : "times-circle"}
                size={13}
                color={notice.kind === "success" ? "#52C41A" : "#FF4D4F"}
                solid
              />
              <Text style={styles.noticeText}>{notice.text}</Text>
            </View>
          ) : null}

          {/* Info card */}
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.rowCenter}>
                <FontAwesome5 name="file-alt" size={12} color="#4F46E5" />
                <Text style={styles.cardHeadText}>INFORMATIONS</Text>
              </View>
            </View>
            <View style={styles.cardBody}>
              {editing ? (
                <View style={{ paddingTop: 8 }}>
                  <Field label="Nom de l'exercice" required styles={styles}>
                    <View style={[styles.input, styles.prefixInput, formSubmitted && !form.nom.trim() && styles.inputError]}>
                      <FontAwesome5 name="book" size={12} color={palette.muted} />
                      <TextInput
                        value={form.nom}
                        onChangeText={(t) => setForm((f) => ({ ...f, nom: t }))}
                        style={styles.prefixInputText}
                        placeholderTextColor={palette.muted}
                      />
                    </View>
                  </Field>
                  <Field label="Niveau" required styles={styles}>
                    <SheetSelect
                      value={form.niveau}
                      options={niveauGradeOptions}
                      onChange={(v) => setForm((f) => ({ ...f, niveau: v }))}
                      title="Niveau"
                      styles={styles}
                      palette={palette}
                      error={formSubmitted && !form.niveau}
                    />
                  </Field>
                  <Field label="Visibilité" required styles={styles}>
                    <SheetSelect
                      value={form.restriction}
                      options={[
                        { value: "PUBLIC", label: "Public", icon: "globe" },
                        { value: "PRIVE", label: "Privé", icon: "lock" },
                      ]}
                      onChange={(v) => setForm((f) => ({ ...f, restriction: v }))}
                      title="Visibilité"
                      styles={styles}
                      palette={palette}
                    />
                  </Field>
                  <Field label="Statut" styles={styles}>
                    <SheetSelect
                      value={form.etat}
                      options={[
                        { value: "BROUILLON", label: "Brouillon" },
                        { value: "ACTIF", label: "Actif" },
                        { value: "INACTIF", label: "Inactif" },
                      ]}
                      onChange={(v) => setForm((f) => ({ ...f, etat: v }))}
                      title="Statut"
                      styles={styles}
                      palette={palette}
                    />
                  </Field>
                  <Field label="Description" required styles={styles}>
                    <PlainInput
                      styles={styles}
                      palette={palette}
                      value={form.description}
                      onChangeText={(t) => setForm((f) => ({ ...f, description: t }))}
                      multiline
                      textAlignVertical="top"
                      style={[{ minHeight: 76 }, formSubmitted && !form.description.trim() && styles.inputError]}
                    />
                  </Field>
                </View>
              ) : (
                <View>
                  <InfoRow label="NOM">
                    <Text style={styles.infoValue}>{exercise.nom || "—"}</Text>
                  </InfoRow>
                  <InfoRow label="NIVEAU">
                    <Pill text={exercise.niveau || "—"} color="#00838F" bg="#E0F7FA" border="#B2EBF2" />
                  </InfoRow>
                  <InfoRow label="STATUT">{statusPill(exercise.etat)}</InfoRow>
                  <InfoRow label="VISIBILITÉ">{restrictionPill(exercise.restriction)}</InfoRow>
                  <InfoRow label="CRÉÉ LE">
                    <View style={styles.rowCenter}>
                      <FontAwesome5 name="calendar-alt" size={11} color={palette.sub} />
                      <Text style={[styles.infoValue, { color: palette.sub }]}>{fmtDate(exercise.dateCreation)}</Text>
                    </View>
                  </InfoRow>
                  {exercise.matieres && exercise.matieres.length > 0 ? (
                    <InfoRow label="MATIÈRES">
                      <View style={[styles.tagWrap, styles.tagWrapEnd]}>
                        {exercise.matieres.map((m) => (
                          <View key={m.id} style={[styles.tag, { backgroundColor: "#F9F0FF", borderColor: "#D3ADF7" }]}>
                            <Text style={[styles.tagText, { color: "#531DAB" }]}>{m.nom}</Text>
                          </View>
                        ))}
                      </View>
                    </InfoRow>
                  ) : null}
                  {exercise.coursLies && exercise.coursLies.length > 0 ? (
                    <InfoRow label="COURS LIÉS">
                      <View style={[styles.tagWrap, styles.tagWrapEnd]}>
                        {exercise.coursLies.map((c: any) => (
                          <View key={c.id} style={[styles.tag, { backgroundColor: "#E6FFFB", borderColor: "#87E8DE" }]}>
                            <Text style={[styles.tagText, { color: "#08979C" }]}>{c.nom || c.titre}</Text>
                          </View>
                        ))}
                      </View>
                    </InfoRow>
                  ) : null}
                  <InfoRow label="DESCRIPTION" last stacked>
                    <Text style={[styles.infoValue, { color: palette.body, lineHeight: 20 }]}>
                      <FontAwesome5 name="file-alt" size={11} color={palette.muted} />{" "}
                      {exercise.description || "Aucune description"}
                    </Text>
                  </InfoRow>
                </View>
              )}
            </View>
          </View>

          {/* Cours liés card */}
          {exercise.coursLies && exercise.coursLies.length > 0 ? (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <View style={styles.rowCenter}>
                  <FontAwesome5 name="book" size={12} color="#0891B2" />
                  <Text style={styles.cardHeadText}>COURS LIÉS</Text>
                </View>
              </View>
              <View style={[styles.cardBody, { gap: 8 }]}>
                {exercise.coursLies.map((c: any) => (
                  <View key={c.id} style={styles.coursItem}>
                    <Text style={styles.coursTitle}>{c.titre || c.nom}</Text>
                    {c.description ? <Text style={styles.coursDesc} numberOfLines={2}>{c.description}</Text> : null}
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Questions */}
          <View style={styles.card}>
            <View style={[styles.cardHead, { justifyContent: "space-between" }]}>
              <View style={styles.rowCenter}>
                <FontAwesome5 name="question-circle" size={13} color="#4F46E5" />
                <Text style={styles.cardHeadText}>QUESTIONS</Text>
                <View style={styles.countBubble}>
                  <Text style={styles.countBubbleText}>{questions.length}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.manageBtn} onPress={() => onEdit(exerciseId)}>
                <FontAwesome5 name="edit" size={10} color={palette.indigo} />
                <Text style={styles.manageBtnText}>Gérer</Text>
              </TouchableOpacity>
            </View>

            {questions.length === 0 ? (
              <View style={styles.emptyQ}>
                <FontAwesome5 name="question-circle" size={32} color="#CBD5E1" />
                <Text style={styles.emptyQText}>Aucune question pour cet exercice</Text>
                <TouchableOpacity onPress={() => onEdit(exerciseId)} activeOpacity={0.85}>
                  <LinearGradient colors={["#4F46E5", "#7C3AED"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.emptyQBtn}>
                    <Text style={styles.emptyQBtnText}>Ajouter des questions</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                {questions.map((q, idx) => {
                  const cfg = TYPE_MAP[q.typeQuestion || ""] || { label: q.typeQuestion || "—", color: "#6B7280", bg: "#F3F4F6" };
                  return (
                    <View key={q.id ?? idx} style={[styles.qRow, idx > 0 && styles.qRowBorder]}>
                      <View style={styles.qNum}>
                        <Text style={styles.qNumText}>{idx + 1}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.qTitle}>{q.intitule}</Text>
                        <View style={styles.rowWrap}>
                          <View style={[styles.typeBadge, { backgroundColor: cfg.bg, borderColor: `${cfg.color}30` }]}>
                            <Text style={[styles.typeBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                          </View>
                          {q.points !== undefined && q.points !== null ? (
                            <Text style={styles.qPoints}>
                              {q.points} pt{q.points !== 1 ? "s" : ""}
                            </Text>
                          ) : null}
                        </View>
                        {q.typeQuestion === "QCM" && q.choixReponses && q.choixReponses.length > 0 ? (
                          <View style={{ marginTop: 8, gap: 4 }}>
                            {q.choixReponses.map((r, ri) => (
                              <View key={ri} style={styles.choiceRow}>
                                <View style={[styles.choiceMark, r.estCorrect ? styles.choiceMarkOk : null]}>
                                  {r.estCorrect ? (
                                    <FontAwesome5 name="check-circle" size={10} color="#16A34A" solid />
                                  ) : (
                                    <FontAwesome5 name="circle" size={8} color="#94A3B8" />
                                  )}
                                </View>
                                <Text style={styles.choiceText}>{r.texte}</Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
                <View style={styles.qFooter}>
                  <Text style={styles.qFooterText}>
                    {questions.length} question{questions.length !== 1 ? "s" : ""}
                  </Text>
                  <TouchableOpacity onPress={() => onEdit(exerciseId)}>
                    <Text style={styles.qFooterLink}>+ Ajouter / modifier</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* ── Program modal (web ProgramModal) ── */}
      <BottomSheet
        visible={showProgram}
        onClose={() => {
          setShowProgram(false);
          resetProgram();
        }}
        title="Programmer l'exercice"
      >
        <ScrollView style={{ maxHeight: 560 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Field label="Type d'assignation" required styles={styles}>
            <SheetSelect
              value={prog.typeAssignation}
              options={[
                { value: "EXERCICE", label: "Exercice libre", desc: "Auto-corrigé, résultat immédiat", icon: "book", iconColor: "#1677FF" },
                { value: "DEVOIR", label: "Devoir", desc: "Soumis, correction manuelle du prof", icon: "file-alt", iconColor: "#531DAB" },
              ]}
              onChange={(v) => setProg((p) => ({ ...p, typeAssignation: v }))}
              title="Type d'assignation"
              styles={styles}
              palette={palette}
            />
          </Field>

          <View style={styles.divider} />

          <DateTimeField
            label="Date prévue"
            required
            value={prog.dateExoPrevue || undefined}
            onChange={(v) => setProg((p) => ({ ...p, dateExoPrevue: v }))}
          />
          {progErrors.dateExoPrevue ? <Text style={styles.formError}>{progErrors.dateExoPrevue}</Text> : null}
          <DateTimeField
            label="Début effectif"
            required
            value={prog.dateDebutExoEffectif || undefined}
            onChange={(v) => setProg((p) => ({ ...p, dateDebutExoEffectif: v }))}
          />
          {progErrors.dateDebutExoEffectif ? <Text style={styles.formError}>{progErrors.dateDebutExoEffectif}</Text> : null}
          <DateTimeField
            label="Fin effective"
            required
            value={prog.dateFinExoEffectif || undefined}
            onChange={(v) => setProg((p) => ({ ...p, dateFinExoEffectif: v }))}
          />
          {progErrors.dateFinExoEffectif ? <Text style={styles.formError}>{progErrors.dateFinExoEffectif}</Text> : null}

          <View style={[styles.formField, { marginTop: 8 }]}>
            <View style={[styles.rowCenter, { marginBottom: 6 }]}>
              <Text style={{ color: "#FF4D4F" }}>*</Text>
              <FontAwesome5 name="user-friends" size={12} color={palette.body} />
              <Text style={[styles.formLabel, { marginBottom: 0 }]}>Classes concernées</Text>
            </View>
            <SheetSelect
              value={prog.classeIds}
              multiple
              options={classes.map((c) => ({ value: String(c.id), label: `${className(c)}${c.niveau ? ` — ${c.niveau}` : ""}` }))}
              onChange={(v) => setProg((p) => ({ ...p, classeIds: v }))}
              title="Classes concernées"
              placeholder="Sélectionnez les classes"
              styles={styles}
              palette={palette}
              error={!!progErrors.classeIds}
            />
            {progErrors.classeIds ? <Text style={styles.formError}>{progErrors.classeIds}</Text> : null}
            <Text style={styles.formExtra}>
              {classesLoading ? "Chargement..." : `${classes.length} classe(s) disponible(s)`}
            </Text>
          </View>

          <CoursePickerField
            classes={prog.classeIds.map((id) => {
              const c = classes.find((x) => String(x.id) === id);
              return { id, nom: c ? className(c) : "Classe" };
            })}
            value={prog.coursParClasse}
            onChange={(classeId, v) =>
              setProg((p) => ({ ...p, coursParClasse: { ...p.coursParClasse, [classeId]: v } }))
            }
            error={progErrors.coursId}
            onNavigate={() => setShowProgram(false)}
          />

          <View style={styles.diffuseBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.diffuseTitle}>Diffuser immédiatement</Text>
              <Text style={styles.diffuseSub}>L'exercice sera visible par les élèves dès maintenant</Text>
            </View>
            <Switch
              value={prog.diffuseImmediately}
              onValueChange={(v) => setProg((p) => ({ ...p, diffuseImmediately: v }))}
              trackColor={{ true: "#1677FF", false: "#BFBFBF" }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.sheetActions}>
            <TouchableOpacity
              style={styles.sheetCancel}
              onPress={() => {
                setShowProgram(false);
                resetProgram();
              }}
            >
              <Text style={styles.sheetCancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sheetSubmit, programLoading && { opacity: 0.7 }]} onPress={handleProgram} disabled={programLoading}>
              {programLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <FontAwesome5 name="paper-plane" size={12} color="#FFFFFF" />}
              <Text style={styles.sheetSubmitText}>Programmer et diffuser</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </BottomSheet>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>, p: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    rowCenter: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
    rowWrap: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },

    plainBack: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: "#1E3A5F",
      marginBottom: 16,
    },
    plainBackText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },

    // Hero (full-bleed, sits right under the app header)
    hero: { paddingHorizontal: 12, paddingVertical: 12, overflow: "hidden" },
    heroCircle: {
      position: "absolute",
      top: -32,
      right: -32,
      width: 128,
      height: 128,
      borderRadius: 64,
      backgroundColor: "#FFFFFF",
      opacity: 0.1,
    },
    heroBack: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: "rgba(255,255,255,0.15)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.3)",
    },
    heroBackText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
    heroRefresh: {
      width: 30,
      height: 30,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.12)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.2)",
    },
    titleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 4 },
    heroTitle: { color: "#FFFFFF", fontWeight: "800", fontSize: 16, lineHeight: 20, flexShrink: 1 },
    etatBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
    etatBadgeText: { fontSize: 12, fontWeight: "800" },
    metaWrap: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 12, rowGap: 4 },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    metaText: { color: "#DBEAFE", fontSize: 12 },
    heroActions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
    heroBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
    heroBtnGhost: { backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
    heroBtnGhostSoft: { backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
    heroBtnDanger: { backgroundColor: "rgba(239,68,68,0.2)", borderWidth: 1, borderColor: "rgba(239,68,68,0.35)" },
    heroBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },

    body: { paddingHorizontal: 12, paddingTop: 16, gap: 16 },
    notice: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    noticeSuccess: { backgroundColor: "#F6FFED", borderColor: "#B7EB8F" },
    noticeError: { backgroundColor: "#FFF2F0", borderColor: "#FFCCC7" },
    noticeText: { flex: 1, fontSize: 13, color: "#262626" },

    // Cards
    card: {
      backgroundColor: p.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: p.cardBorder,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 2,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    cardHead: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: p.cardHead,
      borderBottomWidth: 1,
      borderBottomColor: p.cardBorder,
    },
    cardHeadText: { fontSize: 12, fontWeight: "800", color: p.body, letterSpacing: 0.8 },
    cardBody: { paddingHorizontal: 16, paddingVertical: 12 },

    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: p.rowDivider,
    },
    infoRowStacked: { flexDirection: "column", alignItems: "stretch", justifyContent: "flex-start", gap: 6 },
    infoLabel: { fontSize: 12, fontWeight: "700", color: p.muted, letterSpacing: 0.5, flexShrink: 0 },
    infoValueWrap: { flex: 1, alignItems: "flex-end" },
    infoValue: { fontSize: 14, color: p.title, textAlign: "right" },
    tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
    tagWrapEnd: { justifyContent: "flex-end" },
    tag: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 4, borderWidth: 1 },
    tagText: { fontSize: 12 },

    coursItem: { padding: 10, borderRadius: 12, borderWidth: 1, borderColor: p.cardBorder, backgroundColor: p.soft },
    coursTitle: { fontSize: 14, fontWeight: "700", color: p.title },
    coursDesc: { fontSize: 12, color: p.sub, marginTop: 2 },

    countBubble: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: p.indigoSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    countBubbleText: { fontSize: 11, fontWeight: "800", color: p.indigo },
    manageBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: p.indigoSoft,
    },
    manageBtnText: { fontSize: 12, fontWeight: "700", color: p.indigo },
    emptyQ: { paddingHorizontal: 16, paddingVertical: 40, alignItems: "center" },
    emptyQText: { fontSize: 14, color: p.muted, marginTop: 12 },
    emptyQBtn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12 },
    emptyQBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
    qRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
    qRowBorder: { borderTopWidth: 1, borderTopColor: p.rowDivider },
    qNum: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: p.indigoSoft,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
    qNumText: { fontSize: 12, fontWeight: "900", color: p.indigo },
    qTitle: { fontSize: 14, fontWeight: "500", color: p.title, lineHeight: 19, marginBottom: 6 },
    typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
    typeBadgeText: { fontSize: 12, fontWeight: "700" },
    qPoints: { fontSize: 12, color: p.muted, fontWeight: "500" },
    choiceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    choiceMark: {
      width: 16,
      height: 16,
      borderRadius: 4,
      backgroundColor: p.soft,
      alignItems: "center",
      justifyContent: "center",
    },
    choiceMarkOk: { backgroundColor: "#DCFCE7" },
    choiceText: { fontSize: 12, color: p.body, flexShrink: 1 },
    qFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: p.footer,
      borderTopWidth: 1,
      borderTopColor: p.rowDivider,
    },
    qFooterText: { fontSize: 12, color: p.muted },
    qFooterLink: { fontSize: 12, fontWeight: "700", color: p.indigo },

    // Forms
    formField: { marginBottom: 14 },
    formLabel: { fontSize: 14, color: p.body, marginBottom: 6 },
    formError: { fontSize: 13, color: "#FF4D4F", marginTop: -6, marginBottom: 8 },
    formExtra: { fontSize: 12, color: p.sub, marginTop: 4 },
    input: {
      backgroundColor: p.input,
      borderWidth: 1,
      borderColor: p.inputBorder,
      borderRadius: 8,
      paddingHorizontal: 11,
      paddingVertical: 9,
      fontSize: 14,
      color: p.title,
    },
    inputError: { borderColor: "#FF4D4F" },
    prefixInput: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 0, height: 40 },
    prefixInputText: { flex: 1, fontSize: 14, color: p.title, paddingVertical: 0 },
    selectField: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, minHeight: 40 },
    selectText: { fontSize: 14, color: p.title, flexShrink: 1 },
    sheetOption: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 13,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
      gap: 8,
    },
    sheetOptionText: { fontSize: 15, color: colors.text },
    sheetOptionTextActive: { color: "#4F46E5", fontWeight: "700" },
    sheetOptionDesc: { fontSize: 12, color: p.sub, marginTop: 1 },
    sheetEmpty: { textAlign: "center", color: p.sub, paddingVertical: 20 },
    sheetDone: { marginTop: 12, alignItems: "center", paddingVertical: 11, borderRadius: 8, backgroundColor: "#1677FF" },
    sheetDoneText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
    divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 10 },
    diffuseBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: 8,
      backgroundColor: p.infoBg,
      borderWidth: 1,
      borderColor: p.infoBorder,
      marginBottom: 14,
    },
    diffuseTitle: { fontSize: 14, fontWeight: "700", color: p.title },
    diffuseSub: { fontSize: 12, color: p.sub, marginTop: 2 },
    sheetActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, paddingTop: 4, paddingBottom: 8 },
    sheetCancel: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: p.inputBorder,
      backgroundColor: p.input,
    },
    sheetCancelText: { fontSize: 14, color: p.body },
    sheetSubmit: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 8,
      backgroundColor: "#1677FF",
    },
    sheetSubmitText: { fontSize: 14, color: "#FFFFFF", fontWeight: "600" },
  });

type Styles = ReturnType<typeof createStyles>;

export default ExerciseDetailView;
