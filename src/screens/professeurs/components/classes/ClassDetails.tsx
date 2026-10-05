import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { classService } from "../../../../services/classService";
import {
  accederService,
  activityFeedService,
  classAdminService,
  coursProgrammerService,
  exerciseProgrammerService,
  parentService,
  professorService,
  publicationRightsService,
  studentService,
} from "../../../../services/api";
import { BottomSheet, LoadingSpinner } from "../../../../components/ui";
import { useThemeColors } from "../../../../styles/theme";
import { useThemeStore } from "../../../../store/useThemeStore";
import { useAuthStore } from "../../../../store/useAuthStore";
import { useUiStore } from "../../../../store/useUiStore";
import OffreInfoPanel from "../../../../components/common/OffreInfoPanel";
import { RejectionMotif } from "../../../../types";
import { formatDate, formatDateTime } from "../../../../utils/dates";
import { useT } from "../../../../i18n";
import { getClassActionTexts } from "../../../../hooks/useClassActionConfirm";

// LinearGradient via expo-linear-gradient (safe fallback to View if unavailable)
let LinearGradient: any;
try {
  LinearGradient = require("expo-linear-gradient").LinearGradient;
} catch {
  LinearGradient = ({ children, style, colors: c }: any) => (
    <View style={[style, { backgroundColor: c?.[0] }]}>{children}</View>
  );
}

/**
 * Mobile port of scholchat_front's ManageClassDetailsView.jsx (the class
 * management page opened from "Gérer une classe" — the web's
 * ManageClassContent "manage-class" tab). Like the web view it loads
 * everything it needs from the class id itself (class details, members,
 * access requests, publication rights, courses, exercises, events), so every
 * caller (professor, admin, establishment) gets the same data and actions.
 *
 * Sections, per the web page at phone width (stats cards are `hidden sm:block`
 * on web, so they're omitted here):
 *   1. Hero header — Retour / admin Supprimer, class identity + état + role
 *      badge, action row (Actualiser, Modérateur, Droits, Historique, admin
 *      Approuver/Rejeter, creator self Approuver/Rejeter)
 *   2. "Actions rapides" card (non-admin)
 *   3. Scrollable tab bar: Aperçu, Professeurs, Élèves, Parents, Utilisateurs,
 *      Demandes, Cours + Exercices (non-admin), Événements
 *   4. Modals: profile, moderator assignment, publication rights, activation
 *      history, access-request rejection, class rejection, confirmations
 */

/** Minimal shape every caller already passes (UIClass is structurally compatible). */
export interface ClassDetailsTarget {
  id: string;
  name?: string;
  level?: string;
}

interface ClassDetailsProps {
  selectedClass: ClassDetailsTarget;
  onBack: () => void;
  activeDetailTab: string;
  setActiveDetailTab: (tab: string) => void;
  /** Called after any mutation so the caller can refresh its own list/snapshot. */
  onRefresh?: () => void | Promise<void>;
  /** Admin's "Gérer une Classe" — hides Cours/Exercices tabs and quick actions, shows delete/approve/reject (web: userRole ADMIN). */
  isAdmin?: boolean;
  /** Optional overrides for web's onNavigateTo* callbacks. Default (professor/tutor): switch dashboard tab. */
  onNavigateToCoursManagement?: (classId: string) => void;
  onNavigateToCourseCreation?: (classId: string) => void;
  onNavigateToExerciseManagement?: (classId: string) => void;
  onNavigateToEvents?: (classId: string) => void;
}

type AnyUser = { id: string; [key: string]: any };
type UserCategory = "professeurs" | "eleves" | "parents" | "utilisateurs";
type ListType = UserCategory | "access-requests";
type TabKey = "overview" | ListType | "courses" | "exercises" | "events";

interface UsersState {
  professeurs: AnyUser[];
  eleves: AnyUser[];
  parents: AnyUser[];
  utilisateurs: AnyUser[];
  accessRequests: AnyUser[];
}

const EMPTY_USERS: UsersState = { professeurs: [], eleves: [], parents: [], utilisateurs: [], accessRequests: [] };
const PAGE_SIZE = 10;
const HERO_GRADIENT = ["#1E3A5F", "#2D6A9F", "#4F8EC9"];

const TYPE_FIX: Record<UserCategory, string> = {
  professeurs: "PROFESSEUR",
  eleves: "ELEVE",
  parents: "PARENT",
  utilisateurs: "UTILISATEUR",
};

/** Same categorization as web's loadUsersWithAccess(). */
const categoryOf = (u: AnyUser): UserCategory => {
  const t = String(u.typeUtilisateur || u.type || u.role || "").toUpperCase();
  if (t === "PROFESSEUR" || t === "PROFESSOR") return "professeurs";
  if (t === "ELEVE" || t === "ÉLÈVE" || t === "STUDENT") return "eleves";
  if (t === "PARENT") return "parents";
  return "utilisateurs";
};

const fullName = (u?: AnyUser | null) => `${u?.prenom || ""} ${u?.nom || ""}`.trim();
const initials = (u?: AnyUser | null) =>
  (((u?.prenom || "").charAt(0) + (u?.nom || "").charAt(0)).toUpperCase() || "?");
const fmtDate = (d?: string | null) => (d ? formatDate(d) : "N/A");
const fmtDateTime = (d?: string | null) => (d ? formatDateTime(d) : "—");
const userDate = (u: AnyUser) => fmtDate(u.creationDate || u.dateCreation || u.dateInscription || u.dateAjout);
const isActiveEtat = (e?: string) => e === "ACTIVE" || e === "ACTIF";

// ─── Tones (light/dark) ──────────────────────────────────────────────────────

const TONES = {
  green: { bg: "#F0FDF4", fg: "#16A34A", bd: "#BBF7D0", bgD: "rgba(34,197,94,0.15)", fgD: "#4ADE80", bdD: "rgba(34,197,94,0.35)" },
  red: { bg: "#FEF2F2", fg: "#DC2626", bd: "#FECACA", bgD: "rgba(239,68,68,0.15)", fgD: "#F87171", bdD: "rgba(239,68,68,0.35)" },
  orange: { bg: "#FFFBEB", fg: "#D97706", bd: "#FDE68A", bgD: "rgba(245,158,11,0.15)", fgD: "#FBBF24", bdD: "rgba(245,158,11,0.35)" },
  blue: { bg: "#EFF6FF", fg: "#2563EB", bd: "#BFDBFE", bgD: "rgba(59,130,246,0.15)", fgD: "#60A5FA", bdD: "rgba(59,130,246,0.35)" },
  purple: { bg: "#F5F3FF", fg: "#7C3AED", bd: "#DDD6FE", bgD: "rgba(139,92,246,0.15)", fgD: "#A78BFA", bdD: "rgba(139,92,246,0.35)" },
  cyan: { bg: "#ECFEFF", fg: "#0891B2", bd: "#A5F3FC", bgD: "rgba(6,182,212,0.15)", fgD: "#22D3EE", bdD: "rgba(6,182,212,0.35)" },
  indigo: { bg: "#EEF2FF", fg: "#4F46E5", bd: "#C7D2FE", bgD: "rgba(99,102,241,0.18)", fgD: "#A5B4FC", bdD: "rgba(99,102,241,0.4)" },
  gold: { bg: "#FFFBEB", fg: "#B45309", bd: "#FCD34D", bgD: "rgba(234,179,8,0.15)", fgD: "#FACC15", bdD: "rgba(234,179,8,0.35)" },
  gray: { bg: "#F8FAFC", fg: "#64748B", bd: "#E2E8F0", bgD: "rgba(148,163,184,0.12)", fgD: "#CBD5E1", bdD: "rgba(148,163,184,0.3)" },
} as const;
type Tone = keyof typeof TONES;

const CLASS_STATUS: Record<string, { tone: Tone; text: string }> = {
  ACTIF: { tone: "green", text: "Actif" },
  ACTIVE: { tone: "green", text: "Actif" },
  INACTIF: { tone: "red", text: "Inactif" },
  INACTIVE: { tone: "red", text: "Inactif" },
  EN_ATTENTE_APPROBATION: { tone: "orange", text: "En attente" },
  PENDING: { tone: "orange", text: "En attente" },
};

const PUBLICATION_RIGHTS: Record<string, { tone: Tone; text: string }> = {
  TOUS: { tone: "green", text: "Tous peuvent publier" },
  MODERATEUR_SEULEMENT: { tone: "blue", text: "Modérateur seulement" },
  PARENTS_ET_MODERATEUR: { tone: "orange", text: "Parents et modérateur" },
  PROFESSEURS_SEULEMENT: { tone: "blue", text: "Professeurs seulement" },
};

const COURSE_STATUS: Record<string, { tone: Tone; text: string }> = {
  EN_COURS: { tone: "green", text: "En cours" },
  PLANIFIE: { tone: "blue", text: "Planifié" },
  ANNULE: { tone: "red", text: "Annulé" },
  TERMINE: { tone: "gray", text: "Terminé" },
};

const EXERCISE_TONE: Record<string, Tone> = {
  ACTIF: "green",
  PUBLIE: "green",
  BROUILLON: "orange",
  EN_ATTENTE_CORRECTION: "blue",
  CORRIGE: "cyan",
  ANNULE: "red",
};

const EVENT_TONE: Record<string, Tone> = {
  EN_COURS: "green",
  PLANIFIE: "blue",
  A_VENIR: "blue",
  PASSE: "gray",
  ANNULE: "red",
};

const REQUEST_TYPE: Record<string, { tone: Tone; text: string }> = {
  PROFESSEUR: { tone: "blue", text: "Professeur" },
  ELEVE: { tone: "green", text: "Élève" },
  PARENT: { tone: "orange", text: "Parent" },
  UTILISATEUR: { tone: "purple", text: "Utilisateur" },
};

const LIST_TITLES: Record<ListType, string> = {
  professeurs: "Professeurs ayant accès à la classe",
  eleves: "Élèves ayant accès à la classe",
  parents: "Parents ayant accès à la classe",
  utilisateurs: "Utilisateurs ayant accès à la classe",
  "access-requests": "Demandes d'accès en attente d'approbation",
};

const LIST_EMPTY: Record<ListType, string> = {
  professeurs: "Aucun professeur n'a accès à cette classe",
  eleves: "Aucun élève n'a accès à cette classe",
  parents: "Aucun parent n'a accès à cette classe",
  utilisateurs: "Aucun utilisateur n'a accès à cette classe",
  "access-requests": "Aucune demande d'accès en attente",
};

const normalizeTab = (tab: string, adminMode: boolean): TabKey => {
  const known: TabKey[] = ["overview", "professeurs", "eleves", "parents", "utilisateurs", "access-requests", "courses", "exercises", "events"];
  if (!known.includes(tab as TabKey)) return "overview"; // "info"/"history" (legacy keys) → Aperçu
  if (adminMode && (tab === "courses" || tab === "exercises")) return "overview";
  return tab as TabKey;
};

// ─── Styles hook ─────────────────────────────────────────────────────────────

const useCDStyles = () => {
  const colors = useThemeColors();
  const isDark = useThemeStore((s) => s.mode === "dark");
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const tone = useCallback(
    (key: Tone) => {
      const t = TONES[key];
      return isDark ? { bg: t.bgD, fg: t.fgD, bd: t.bdD } : { bg: t.bg, fg: t.fg, bd: t.bd };
    },
    [isDark]
  );
  return { styles, colors, isDark, tone };
};

// ─── Small building blocks ───────────────────────────────────────────────────

const Tag = ({ tone: toneKey, label, icon }: { tone: Tone; label: string; icon?: string }) => {
  const { styles, tone } = useCDStyles();
  const t = tone(toneKey);
  return (
    <View style={[styles.tag, { backgroundColor: t.bg, borderColor: t.bd }]}>
      {icon ? <FontAwesome5 name={icon as any} size={9} color={t.fg} solid /> : null}
      <Text style={[styles.tagText, { color: t.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

const SectionCard = ({
  icon,
  title,
  right,
  subtitle,
  children,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) => {
  const { styles } = useCDStyles();
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.cardHeaderTitleRow}>
            <FontAwesome5 name={icon as any} size={12} color="#4F46E5" solid />
            <Text style={styles.cardHeaderTitle} numberOfLines={2}>
              {title}
            </Text>
          </View>
          {subtitle ? <Text style={styles.cardHeaderSub}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
};

const InfoRow = ({ label, children }: { label: string; children: React.ReactNode }) => {
  const { styles } = useCDStyles();
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.infoValueWrap}>
        {typeof children === "string" || typeof children === "number" ? (
          <Text style={styles.infoValue}>{children}</Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
};

const Pager = ({ page, total, onChange, noun }: { page: number; total: number; onChange: (p: number) => void; noun: string }) => {
  const { styles, colors } = useCDStyles();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (total <= PAGE_SIZE) return null;
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(total, page * PAGE_SIZE);
  const items = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
    .reduce<(number | "…")[]>((acc, p, i, arr) => {
      if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
      acc.push(p);
      return acc;
    }, []);
  return (
    <View style={styles.pager}>
      <Text style={styles.pageInfo}>
        {start}-{end} sur {total} {noun}
      </Text>
      <View style={styles.pageBtns}>
        <TouchableOpacity style={[styles.pageBtn, page === 1 && styles.disabled]} disabled={page === 1} onPress={() => onChange(page - 1)}>
          <FontAwesome5 name="chevron-left" size={10} color={colors.textMuted} />
        </TouchableOpacity>
        {items.map((it, idx) =>
          it === "…" ? (
            <Text key={`e-${idx}`} style={styles.pageEllipsis}>
              …
            </Text>
          ) : it === page ? (
            <LinearGradient key={it} colors={["#4F46E5", "#7C3AED"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pageNum}>
              <Text style={[styles.pageNumText, { color: "#FFFFFF" }]}>{it}</Text>
            </LinearGradient>
          ) : (
            <TouchableOpacity key={it} style={[styles.pageNum, styles.pageNumIdle]} onPress={() => onChange(it)}>
              <Text style={styles.pageNumText}>{it}</Text>
            </TouchableOpacity>
          )
        )}
        <TouchableOpacity
          style={[styles.pageBtn, page === totalPages && styles.disabled]}
          disabled={page === totalPages}
          onPress={() => onChange(page + 1)}
        >
          <FontAwesome5 name="chevron-right" size={10} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

/** Compact select pill opening a bottom sheet (web's column filters). */
const SelectPill = ({
  icon,
  value,
  options,
  onChange,
  title,
}: {
  icon: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  title: string;
}) => {
  const { styles, colors } = useCDStyles();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) ?? options[0];
  return (
    <>
      <TouchableOpacity style={styles.selectPill} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <FontAwesome5 name={icon as any} size={10} color={colors.textLight} />
        <Text style={styles.selectPillText} numberOfLines={1}>
          {selected?.label}
        </Text>
        <FontAwesome5 name="chevron-down" size={9} color={colors.textLight} />
      </TouchableOpacity>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={title}>
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
      </BottomSheet>
    </>
  );
};

const HeroButton = ({
  icon,
  label,
  onPress,
  disabled,
  loading,
  variant = "ghost",
}: {
  icon: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "ghost" | "success" | "danger" | "dangerSoft";
}) => {
  const { styles } = useCDStyles();
  const vStyle =
    variant === "success"
      ? styles.heroBtnSuccess
      : variant === "danger"
        ? styles.heroBtnDanger
        : variant === "dangerSoft"
          ? styles.heroBtnDangerSoft
          : styles.heroBtnGhost;
  const fg = variant === "dangerSoft" ? "#FCA5A5" : "#FFFFFF";
  return (
    <TouchableOpacity
      style={[styles.heroBtn, vStyle, (disabled || loading) && { opacity: 0.45 }]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : <FontAwesome5 name={icon as any} size={11} color={fg} />}
      <Text style={[styles.heroBtnText, { color: fg }]}>{label}</Text>
    </TouchableOpacity>
  );
};

const PrimaryBtn = ({
  label,
  icon,
  onPress,
  loading,
  disabled,
  gradient = ["#4F46E5", "#7C3AED"],
}: {
  label: string;
  icon?: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  gradient?: string[];
}) => {
  const { styles } = useCDStyles();
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled || loading} activeOpacity={0.85} style={(disabled || loading) && { opacity: 0.5 }}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtn}>
        {loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : icon ? <FontAwesome5 name={icon as any} size={12} color="#FFFFFF" /> : null}
        <Text style={styles.primaryText}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};

/** Centered dialog shell (MatieresBody-style). */
const Dialog = ({
  visible,
  onClose,
  title,
  subtitle,
  icon,
  iconTone = "red",
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: string;
  iconTone?: Tone;
  children: React.ReactNode;
  footer: React.ReactNode;
}) => {
  const { styles, colors, tone } = useCDStyles();
  const t = tone(iconTone);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.dialog}>
          <View style={styles.dialogHeader}>
            {icon ? (
              <View style={[styles.dialogIcon, { backgroundColor: t.bg }]}>
                <FontAwesome5 name={icon as any} size={14} color={t.fg} />
              </View>
            ) : null}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.dialogTitle}>{title}</Text>
              {subtitle ? (
                <Text style={styles.dialogSub} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <FontAwesome5 name="times" size={15} color={colors.textLight} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={styles.dialogBody} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          <View style={styles.dialogFooter}>{footer}</View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Main component ──────────────────────────────────────────────────────────

const ClassDetails = ({
  selectedClass,
  onBack,
  activeDetailTab,
  setActiveDetailTab,
  onRefresh,
  isAdmin: isAdminProp,
  onNavigateToCoursManagement,
  onNavigateToCourseCreation,
  onNavigateToExerciseManagement,
  onNavigateToEvents,
}: ClassDetailsProps) => {
  const { styles, colors, isDark, tone } = useCDStyles();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const role = useAuthStore((s) => s.role);
  const currentUserId = useAuthStore((s) => s.user?.userId) || "";
  const requestTab = useUiStore((s) => s.requestTab);
  const classId = selectedClass.id;

  const isAdmin = !!isAdminProp || role === "admin";
  const activeTab = normalizeTab(activeDetailTab, isAdmin);

  // ── Data ──
  const [classDetails, setClassDetails] = useState<AnyUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<UsersState>(EMPTY_USERS);
  const [usersWithRights, setUsersWithRights] = useState<AnyUser[]>([]);
  const [courses, setCourses] = useState<AnyUser[]>([]);
  const [exercises, setExercises] = useState<AnyUser[]>([]);
  const [events, setEvents] = useState<AnyUser[]>([]);
  const poolsRef = useRef<{ profs: AnyUser[]; students: AnyUser[]; parents: AnyUser[] }>({ profs: [], students: [], parents: [] });

  // ── Feedback ──
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Lists ──
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // ── Modals ──
  const [profileUser, setProfileUser] = useState<AnyUser | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    okLabel: string;
    danger?: boolean;
    /** Emphasised red line under the message (e.g. irreversible warning). */
    warning?: string;
    onOk: () => Promise<void> | void;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const confirmBusyRef = useRef(false);
  const { t: tr } = useT();

  const [rejectReqUser, setRejectReqUser] = useState<AnyUser | null>(null);
  const [rejectReqReason, setRejectReqReason] = useState("");
  const [rejectReqError, setRejectReqError] = useState("");

  const [classRejectMode, setClassRejectMode] = useState<"admin" | "self" | null>(null);
  const [classRejectMotifs, setClassRejectMotifs] = useState<RejectionMotif[]>([]);
  const [classRejectMotifsLoading, setClassRejectMotifsLoading] = useState(false);
  const [classRejectCodes, setClassRejectCodes] = useState<string[]>([]);
  const [classRejectComment, setClassRejectComment] = useState("");
  const [classRejectError, setClassRejectError] = useState("");

  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<Record<string, any>[]>([]);

  const [moderatorOpen, setModeratorOpen] = useState(false);
  const [modQuery, setModQuery] = useState("");
  const [modResults, setModResults] = useState<AnyUser[]>([]);
  const [modSearched, setModSearched] = useState(false);
  const [modSearching, setModSearching] = useState(false);
  const [selectedModerator, setSelectedModerator] = useState<AnyUser | null>(null);
  const [modError, setModError] = useState("");

  const [rightsOpen, setRightsOpen] = useState(false);
  const [rightsQuery, setRightsQuery] = useState("");
  const [rightsResults, setRightsResults] = useState<AnyUser[]>([]);
  const [rightsSearched, setRightsSearched] = useState(false);
  const [rightsSearching, setRightsSearching] = useState(false);
  const [rightsUser, setRightsUser] = useState<AnyUser | null>(null);
  const [rightsFlags, setRightsFlags] = useState({ peutPublier: true, peutModerer: false });
  const [rightsError, setRightsError] = useState("");

  // Classe Majeure — add student by email (Élèves tab)
  const [majeurQuery, setMajeurQuery] = useState("");
  const [majeurResults, setMajeurResults] = useState<AnyUser[]>([]);
  const [majeurSearching, setMajeurSearching] = useState(false);

  // Auto-clear banners (web's antd message toasts)
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(""), 5000);
    return () => clearTimeout(t);
  }, [success]);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 5000);
    return () => clearTimeout(t);
  }, [error]);

  const showSuccess = (msg: string) => {
    setError("");
    setSuccess(msg);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };
  const showError = (msg: string) => {
    setSuccess("");
    setError(msg);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };
  const errMsg = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

  // ── Loaders (same sequence as web's loadClassDetails) ──

  const buildAccessRequests = (requests: AnyUser[]): AnyUser[] => {
    const { profs, students, parents } = poolsRef.current;
    return (requests || [])
      .filter((r) => r.etat === "EN_ATTENTE")
      .map((request) => {
        let full: AnyUser | undefined = profs.find((p) => p.id === request.utilisateurId);
        let userType: string | null = full ? "PROFESSEUR" : null;
        if (!full) {
          full = students.find((s) => s.id === request.utilisateurId);
          if (full) userType = "ELEVE";
        }
        if (!full) {
          full = parents.find((p) => p.id === request.utilisateurId);
          if (full) userType = "PARENT";
        }
        return {
          ...request,
          id: request.id,
          utilisateurId: request.utilisateurId,
          nom: full?.nom || request.utilisateurNom || "Non disponible",
          prenom: full?.prenom || request.utilisateurPrenom || "Non disponible",
          email: full?.email || request.utilisateurEmail || "Non disponible",
          telephone: full?.telephone || "Non disponible",
          typeUtilisateur: userType || "INCONNU",
          dateDemande: request.dateDemande,
          etat: request.etat,
          motifRejet: request.motifRejet,
          dateTraitement: request.dateTraitement,
          ...(userType === "PROFESSEUR" && full ? { nomEtablissement: full.nomEtablissement, matriculeProfesseur: full.matriculeProfesseur } : {}),
          ...(userType === "ELEVE" && full ? { niveau: full.niveau } : {}),
          ...(userType === "PARENT" && full ? { adresse: full.adresse } : {}),
        };
      });
  };

  const loadAccessRequests = useCallback(async () => {
    try {
      const reqs = (await accederService.getRequestsForClass(classId)) as AnyUser[];
      const built = buildAccessRequests(reqs);
      setUsers((prev) => ({ ...prev, accessRequests: built }));
    } catch {
      showError("Erreur lors du chargement des demandes d'accès");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  const loadAll = useCallback(
    async (mode: "initial" | "refresh") => {
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      try {
        let details: AnyUser;
        try {
          details = (await classService.getClassDetails(classId)) as AnyUser;
        } catch {
          showError("Erreur lors du chargement des détails de la classe");
          if (mode === "initial") setClassDetails(null);
          return;
        }
        const enriched: AnyUser = {
          ...details,
          dateCreation: details.dateCreation || details.date_creation || null,
          createurId: details.createurId || details.createur_id || details.cree_par || details.utilisateur_id || currentUserId,
          droitPublication: details.droitPublication || details.droit_publication || "PROFESSEURS_SEULEMENT",
          etablissement: details.etablissement || (details.etablissement_id ? { id: details.etablissement_id } : null),
          moderatorId: details.moderatorId || details.moderator_id || null,
        };
        setClassDetails(enriched);

        // Profile pools used to enrich members & requests (web: scholchatService.getAll*)
        const [profs, students, parents] = await Promise.all([
          professorService.getAll().catch(() => []),
          studentService.getAll().catch(() => []),
          parentService.getAllSummary().catch(() => []),
        ]);
        poolsRef.current = {
          profs: (profs || []) as AnyUser[],
          students: (students || []) as AnyUser[],
          parents: (parents || []) as AnyUser[],
        };

        // Users with access
        let access: AnyUser[] = [];
        try {
          access = ((await accederService.getUsersWithAccess(classId)) || []) as AnyUser[];
        } catch {
          showError("Erreur lors du chargement des utilisateurs");
        }
        const cat: Record<UserCategory, AnyUser[]> = { professeurs: [], eleves: [], parents: [], utilisateurs: [] };
        access.forEach((u) => {
          const c = categoryOf(u);
          cat[c].push({ ...u, typeUtilisateur: TYPE_FIX[c] });
        });
        const enrich = (list: AnyUser[], pool: AnyUser[]) => list.map((u) => ({ ...(pool.find((p) => p.id === u.id) || {}), ...u }));
        cat.professeurs = enrich(cat.professeurs, poolsRef.current.profs);
        cat.eleves = enrich(cat.eleves, poolsRef.current.students);
        cat.parents = enrich(cat.parents, poolsRef.current.parents);

        // Access requests
        let accessRequests: AnyUser[] = [];
        try {
          accessRequests = buildAccessRequests(((await accederService.getRequestsForClass(classId)) || []) as AnyUser[]);
        } catch {
          showError("Erreur lors du chargement des demandes d'accès");
        }

        // Publication rights — merged into the member lists like web's loadModeratorsAndRights()
        let rights: AnyUser[] = [];
        try {
          rights = ((await publicationRightsService.getUsersForClass(classId)) || []) as AnyUser[];
        } catch {
          rights = [];
        }
        const existing = new Set([...cat.professeurs, ...cat.eleves, ...cat.parents, ...cat.utilisateurs].map((u) => u.id));
        rights.forEach((u) => {
          if (existing.has(u.id)) return;
          const t = String(u.typeUtilisateur || u.type || "").toUpperCase();
          const c: UserCategory =
            t === "PROFESSEUR" || t === "PROFESSOR"
              ? "professeurs"
              : t === "ELEVE" || t === "ÉLÈVE" || t === "STUDENT"
                ? "eleves"
                : t === "PARENT"
                  ? "parents"
                  : "utilisateurs";
          cat[c].push({ ...u, typeUtilisateur: TYPE_FIX[c] });
        });
        setUsersWithRights(rights);
        setUsers({ ...cat, accessRequests });

        // Modules
        const [c, e, ev] = await Promise.all([
          coursProgrammerService.getByClasse(classId).catch(() => []),
          exerciseProgrammerService.getByClasse(classId).catch(() => []),
          activityFeedService.getAll().catch(() => []),
        ]);
        const courseOrder: Record<string, number> = { EN_COURS: 0, PLANIFIE: 1, ANNULE: 2, TERMINE: 3 };
        setCourses(
          [...((c || []) as AnyUser[])].sort(
            (a, b) => (courseOrder[a.etatCoursProgramme] ?? 99) - (courseOrder[b.etatCoursProgramme] ?? 99)
          )
        );
        const exOrder: Record<string, number> = { ACTIF: 0, PUBLIE: 0, BROUILLON: 1, EN_ATTENTE_CORRECTION: 2, CORRIGE: 3, ANNULE: 4 };
        setExercises(
          [...((e || []) as AnyUser[])].sort(
            (a, b) => (exOrder[a.etat] ?? exOrder[a.etatExercise] ?? 99) - (exOrder[b.etat] ?? exOrder[b.etatExercise] ?? 99)
          )
        );
        const evOrder: Record<string, number> = { EN_COURS: 0, PLANIFIE: 1, A_VENIR: 1, PASSE: 2, ANNULE: 3 };
        setEvents(
          ((ev || []) as AnyUser[])
            .filter((x) => Array.isArray(x.classesIds) && x.classesIds.includes(classId))
            .sort((a, b) => (evOrder[a.etat] ?? 99) - (evOrder[b.etat] ?? 99))
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [classId, currentUserId]
  );

  useEffect(() => {
    loadAll("initial");
  }, [loadAll]);

  /** Reload after a mutation + let the caller refresh its own snapshot. */
  const reloadAfterMutation = async () => {
    await loadAll("refresh");
    try {
      await onRefresh?.();
    } catch {
      // caller refresh is best-effort
    }
  };

  // ── Role helpers (mirror web) ──

  const moderatorsWithRights = useMemo(() => usersWithRights.filter((u) => u.peutModerer), [usersWithRights]);
  const publicationRightsMap = useMemo(
    () => Object.fromEntries(usersWithRights.map((u) => [u.id, true])) as Record<string, boolean>,
    [usersWithRights]
  );

  const isUserModerator = (): boolean => {
    if (role === "student" || role === "parent") return false;
    if (isAdmin) return true;
    if (!currentUserId || !classDetails) return false;
    if (classDetails.moderatorId === currentUserId) return true;
    if (classDetails.moderator?.id === currentUserId) return true;
    if (classDetails.createurId === currentUserId) return true;
    return moderatorsWithRights.some((m) => m.id === currentUserId);
  };
  const isModerator = isUserModerator();

  const isPending = classDetails?.etat === "EN_ATTENTE_APPROBATION" || classDetails?.etat === "PENDING";

  const canSelfApproveReject = (): boolean => {
    if (!classDetails || !currentUserId) return false;
    const hasNoEstablishment = !classDetails.etablissement || !classDetails.etablissement.id;
    const isCreator =
      classDetails.createurId === currentUserId ||
      classDetails.utilisateurId === currentUserId ||
      classDetails.createur_id === currentUserId ||
      classDetails.cree_par === currentUserId ||
      (!classDetails.createurId && !classDetails.etablissement && role === "professor");
    const paymentOk =
      classDetails.paymentStatus === "SUCCESS" ||
      classDetails.paiementEffectue === true ||
      classDetails.etat === "ACTIF" ||
      !classDetails.paymentRequired;
    return hasNoEstablishment && isCreator && paymentOk;
  };
  const canSelfManage = canSelfApproveReject() && isPending;

  const roleBadge = (() => {
    if (!classDetails) return null;
    const isCreator = classDetails.creatorId === currentUserId || classDetails.creator_id === currentUserId;
    const isMod = classDetails.moderator?.id === currentUserId || classDetails.moderatorId === currentUserId;
    const hasPubRight = usersWithRights.some((u) => u.id === currentUserId);
    if (isCreator) return { label: "Créateur", tone: "indigo" as Tone };
    if (isMod) return { label: "Modérateur", tone: "cyan" as Tone };
    if (hasPubRight) return { label: "Droit de publication", tone: "purple" as Tone };
    return { label: "Membre", tone: "gray" as Tone };
  })();

  // ── Navigation (web: onNavigateTo* — hidden for admin) ──
  const canDashNav = !isAdmin && (role === "professor" || role === "tutor");
  const navCoursManagement = onNavigateToCoursManagement ?? (canDashNav ? () => requestTab("cours") : undefined);
  const navCourseCreation = onNavigateToCourseCreation ?? (canDashNav ? () => requestTab("cours") : undefined);
  const navExercises = onNavigateToExerciseManagement ?? (canDashNav ? () => requestTab("exercises") : undefined);
  const navEvents = onNavigateToEvents ?? (canDashNav ? () => requestTab("activities") : undefined);
  const showQuickActions = !isAdmin && !!(navCoursManagement || navCourseCreation || navExercises);

  // ── Actions ──

  const handleTabChange = (key: TabKey) => {
    setActiveDetailTab(key);
    setPage(1);
    setStatusFilter("all");
    setTypeFilter("all");
    if (key === "access-requests") loadAccessRequests();
  };

  const runConfirm = async () => {
    if (!confirm || confirmBusyRef.current) return;
    confirmBusyRef.current = true;
    setConfirmBusy(true);
    try {
      await confirm.onOk();
    } finally {
      confirmBusyRef.current = false;
      setConfirmBusy(false);
      setConfirm(null);
    }
  };

  // Shared class-moderation wording (identical to web, see hooks/useClassActionConfirm).
  const askDeleteClass = () => {
    const texts = getClassActionTexts("delete", classDetails?.nom || selectedClass?.name, tr);
    setConfirm({
      title: texts.title,
      message: texts.message,
      warning: texts.warning,
      okLabel: tr("classConfirm.confirm"),
      danger: true,
      onOk: async () => {
        const isProfessor = role === "professor" || role === "tutor";
        if (isProfessor && !isAdmin && moderatorsWithRights.length === 1 && moderatorsWithRights[0].id === currentUserId) {
          showError(
            "En tant que seul modérateur, vous ne pouvez pas supprimer cette classe. Veuillez d'abord assigner un autre modérateur ou contacter l'administration."
          );
          return;
        }
        setActionLoading("delete");
        try {
          await classAdminService.remove(classId);
          setActionLoading(null);
          showSuccess(texts.success);
          try {
            await onRefresh?.();
          } catch {
            // ignore
          }
          onBack();
        } catch {
          setActionLoading(null);
          showError(texts.error);
        }
      },
    });
  };

  const askApproveClass = () => {
    const texts = getClassActionTexts("approve", classDetails?.nom || selectedClass?.name, tr);
    setConfirm({
      title: texts.title,
      message: texts.message,
      okLabel: tr("classConfirm.confirm"),
      onOk: () => handleApprove(false),
    });
  };

  const handleApprove = async (self: boolean) => {
    setActionLoading(self ? "self-approve" : "approve");
    try {
      await classAdminService.approve(classId);
      showSuccess(self ? "Classe approuvée avec succès ! Vous pouvez maintenant gérer votre classe." : tr("classConfirm.approveSuccess"));
      await reloadAfterMutation();
    } catch {
      showError(tr("classConfirm.approveError"));
    } finally {
      setActionLoading(null);
    }
  };

  const openClassReject = async (mode: "admin" | "self") => {
    setClassRejectMode(mode);
    setClassRejectCodes([]);
    setClassRejectComment("");
    setClassRejectError("");
    setClassRejectMotifsLoading(true);
    try {
      const motifs = await classAdminService.getRejectionMotifs();
      setClassRejectMotifs(Array.isArray(motifs) ? motifs : []);
    } catch {
      setClassRejectMotifs([]);
    } finally {
      setClassRejectMotifsLoading(false);
    }
  };

  const toggleRejectCode = (code: string) => {
    if (classRejectMode === "admin") {
      setClassRejectCodes([code]);
    } else {
      setClassRejectCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
    }
  };

  const confirmClassReject = async () => {
    if (actionLoading === "admin-reject" || actionLoading === "self-reject") return;
    if (classRejectCodes.length === 0) {
      setClassRejectError(
        classRejectMode === "self" ? "Veuillez sélectionner au moins un motif de rejet" : "Veuillez sélectionner un motif de rejet"
      );
      return;
    }
    const mode = classRejectMode;
    setActionLoading(mode === "admin" ? "admin-reject" : "self-reject");
    try {
      if (mode === "admin") {
        // web: classService.rejeterClasse(classId, code) → PATCH /classes/{id}/reject?motif=code
        await classAdminService.reject(classId, classRejectCodes[0]);
      } else {
        // web: rejectionServiceClass.rejectClass(classId, { motifSupplementaire, ... })
        await classAdminService.rejectWithDetails(classId, classRejectCodes.join(","), classRejectComment.trim());
      }
      setClassRejectMode(null);
      showSuccess(tr("classConfirm.rejectSuccess"));
      await reloadAfterMutation();
    } catch (e) {
      setClassRejectError(errMsg(e, "Erreur lors du rejet de la classe"));
    } finally {
      setActionLoading(null);
    }
  };

  const openHistory = async () => {
    setActionLoading("history");
    try {
      const data = await classAdminService.getHistoActivations(classId);
      setHistory(data || []);
      setHistoryOpen(true);
    } catch {
      showError("Erreur lors du chargement de l'historique");
    } finally {
      setActionLoading(null);
    }
  };

  const shareCode = async () => {
    if (!classDetails?.codeActivation) return;
    try {
      await Share.share({ message: String(classDetails.codeActivation) });
    } catch {
      // user dismissed
    }
  };

  // Moderator modal
  const closeModerator = () => {
    setModeratorOpen(false);
    setModQuery("");
    setModResults([]);
    setModSearched(false);
    setSelectedModerator(null);
    setModError("");
  };

  const searchModerator = async () => {
    const q = modQuery.trim().toLowerCase();
    if (!q) {
      setModError("Veuillez entrer un nom ou email");
      return;
    }
    setModError("");
    setModSearching(true);
    try {
      const all = ((await professorService.getAll()) || []) as AnyUser[];
      setModResults(
        all.filter(
          (p) =>
            p.nom?.toLowerCase().includes(q) ||
            p.prenom?.toLowerCase().includes(q) ||
            p.email?.toLowerCase().includes(q) ||
            p.matriculeProfesseur?.toLowerCase().includes(q)
        )
      );
      setModSearched(true);
    } catch {
      setModError("Erreur lors de la recherche des professeurs");
    } finally {
      setModSearching(false);
    }
  };

  const assignModerator = async () => {
    if (!selectedModerator) {
      setModError("Veuillez sélectionner un modérateur");
      return;
    }
    setActionLoading("moderator");
    try {
      await classService.assignModerator(classId, selectedModerator.id);
      let rightsOk = true;
      try {
        await publicationRightsService.assign(selectedModerator.id, classId, true, true);
      } catch {
        rightsOk = false;
      }
      closeModerator();
      if (rightsOk) showSuccess("Modérateur assigné avec succès avec droits de publication");
      else showError("Modérateur assigné mais l'assignation des droits de publication a échoué");
      await reloadAfterMutation();
    } catch {
      setModError("Erreur lors de l'assignation du modérateur");
    } finally {
      setActionLoading(null);
    }
  };

  const removeModerator = async () => {
    setActionLoading("removeModerator");
    try {
      await classAdminService.removeModerator(classId);
      showSuccess("Modérateur retiré avec succès");
      await reloadAfterMutation();
    } catch {
      showError("Erreur lors du retrait du modérateur");
    } finally {
      setActionLoading(null);
    }
  };

  // Email search across professors/students/parents (web: handleSearchUserByEmail)
  const searchUsersByEmail = async (query: string): Promise<AnyUser[]> => {
    const [p, s, pa] = await Promise.all([professorService.getAll(), studentService.getAll(), parentService.getAllSummary()]);
    const all = [...((p || []) as AnyUser[]), ...((s || []) as AnyUser[]), ...((pa || []) as AnyUser[])];
    const q = query.toLowerCase();
    return all.filter((u) => u.email && String(u.email).toLowerCase().includes(q));
  };

  // Publication rights modal
  const closeRights = () => {
    setRightsOpen(false);
    setRightsQuery("");
    setRightsResults([]);
    setRightsSearched(false);
    setRightsUser(null);
    setRightsFlags({ peutPublier: true, peutModerer: false });
    setRightsError("");
  };

  const searchRights = async () => {
    if (!rightsQuery.trim()) {
      setRightsError("Veuillez entrer une adresse email");
      return;
    }
    setRightsError("");
    setRightsSearching(true);
    try {
      setRightsResults(await searchUsersByEmail(rightsQuery.trim()));
      setRightsSearched(true);
    } catch {
      setRightsError("Erreur lors de la recherche d'utilisateurs");
    } finally {
      setRightsSearching(false);
    }
  };

  const assignRights = async () => {
    if (!rightsUser) {
      setRightsError("Veuillez sélectionner un utilisateur");
      return;
    }
    setActionLoading("assignPublicationRights");
    try {
      await publicationRightsService.assign(rightsUser.id, classId, rightsFlags.peutPublier, rightsFlags.peutModerer);
      closeRights();
      showSuccess("Droits de publication assignés avec succès");
      await reloadAfterMutation();
    } catch (e) {
      setRightsError(errMsg(e, "Erreur lors de l'assignation des droits de publication"));
    } finally {
      setActionLoading(null);
    }
  };

  // Per-professor publication right switch (web: handleTogglePublicationRights)
  const togglePublicationRight = async (prof: AnyUser, grant: boolean) => {
    setActionLoading(`toggle-${prof.id}`);
    try {
      if (grant) {
        await publicationRightsService.assign(prof.id, classId, true, false);
        showSuccess(`Droit de publication accordé à ${fullName(prof)}`);
      } else {
        await publicationRightsService.remove(prof.id, classId);
        showSuccess(`Droit de publication retiré à ${fullName(prof)}`);
      }
      const rights = ((await publicationRightsService.getUsersForClass(classId).catch(() => usersWithRights)) || []) as AnyUser[];
      setUsersWithRights(rights);
    } catch (e) {
      showError(errMsg(e, "Erreur lors de la mise à jour des droits de publication"));
    } finally {
      setActionLoading(null);
    }
  };

  const askRemoveAccess = (u: AnyUser) =>
    setConfirm({
      title: "Retirer l'accès de cet utilisateur ?",
      message: `Cette action retirera l'accès de ${fullName(u) || "l'utilisateur"} à cette classe.`,
      okLabel: "Oui",
      danger: true,
      onOk: async () => {
        try {
          await accederService.removeAccess(u.id, classId);
          showSuccess("Accès retiré avec succès");
          await reloadAfterMutation();
        } catch {
          showError("Erreur lors du retrait de l'accès");
        }
      },
    });

  const askDeleteUser = (u: AnyUser, type: UserCategory) =>
    setConfirm({
      title: "Supprimer définitivement cet utilisateur ?",
      message: "Cette action supprimera complètement l'utilisateur du système. Cette action est irréversible.",
      okLabel: "Supprimer",
      danger: true,
      onOk: async () => {
        try {
          if (type === "professeurs") {
            await professorService.remove(u.id);
            showSuccess("Professeur supprimé avec succès");
          } else if (type === "eleves") {
            await studentService.remove(u.id);
            showSuccess("Étudiant supprimé avec succès");
          } else if (type === "parents") {
            await parentService.remove(u.id);
            showSuccess("Parent supprimé avec succès");
          } else {
            // web's handleDeleteUser for "utilisateurs" only removes the class access
            await accederService.removeAccess(u.id, classId);
            showSuccess("Utilisateur supprimé de la classe avec succès");
          }
          await reloadAfterMutation();
        } catch {
          showError("Erreur lors de la suppression de l'utilisateur");
        }
      },
    });

  const approveRequest = async (r: AnyUser) => {
    setActionLoading(`approve-${r.id}`);
    try {
      await accederService.approveRequest(r.id);
      const name = fullName(r);
      showSuccess(name ? `Demande approuvée. ${name} a été ajouté(e).` : "Demande approuvée avec succès");
      await reloadAfterMutation();
    } catch {
      showError("Erreur lors de l'approbation de la demande");
    } finally {
      setActionLoading(null);
    }
  };

  const confirmRejectRequest = async () => {
    if (!rejectReqReason.trim()) {
      setRejectReqError("Veuillez saisir un motif de rejet");
      return;
    }
    if (!rejectReqUser) return;
    setActionLoading("reject-request");
    try {
      await accederService.rejectRequest(rejectReqUser.id, rejectReqReason.trim());
      setRejectReqUser(null);
      setRejectReqReason("");
      showSuccess("Demande rejetée avec succès");
      await loadAccessRequests();
      try {
        await onRefresh?.();
      } catch {
        // ignore
      }
    } catch {
      setRejectReqError("Erreur lors du rejet de la demande");
    } finally {
      setActionLoading(null);
    }
  };

  // Classe Majeure: add student by email
  const searchMajeur = async () => {
    if (!majeurQuery.trim()) {
      showError("Veuillez entrer une adresse email");
      return;
    }
    setMajeurSearching(true);
    try {
      setMajeurResults(await searchUsersByEmail(majeurQuery.trim()));
    } catch {
      showError("Erreur lors de la recherche d'utilisateurs");
    } finally {
      setMajeurSearching(false);
    }
  };

  const addMajeurStudent = async (u: AnyUser) => {
    setActionLoading(`add-${u.id}`);
    try {
      await accederService.demanderAcces({
        utilisateurId: u.id,
        classeId: classId,
        codeActivation: classDetails?.codeActivation,
      });
      // demanderAcces doesn't surface the request id on mobile → web's fallback path
      const reqs = ((await accederService.getRequestsForClass(classId)) || []) as AnyUser[];
      const r = reqs.find((x) => x.utilisateurId === u.id && x.etat === "EN_ATTENTE");
      if (r) await accederService.approveRequest(r.id);
      showSuccess(`${fullName(u)} ajouté(e)`);
      setMajeurQuery("");
      setMajeurResults([]);
      await reloadAfterMutation();
    } catch (e) {
      showError(errMsg(e, "Erreur"));
    } finally {
      setActionLoading(null);
    }
  };

  // ── Render: states ──

  if (loading && !classDetails) {
    return (
      <View style={styles.container}>
        <LoadingSpinner label="Chargement des détails de la classe..." />
      </View>
    );
  }

  if (!classDetails) {
    return (
      <View style={[styles.container, { padding: 16, paddingTop: 12 }]}>
        <View style={[styles.banner, styles.bannerError]}>
          <FontAwesome5 name="exclamation-circle" size={14} color="#EF4444" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerText, { color: "#B91C1C", fontWeight: "700" }]}>Classe non trouvée</Text>
            <Text style={[styles.bannerText, { color: "#B91C1C" }]}>
              La classe que vous recherchez n'existe pas ou vous n'avez pas les droits d'accès.
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.outlineBtn} onPress={onBack}>
          <FontAwesome5 name="arrow-left" size={12} color={colors.text} />
          <Text style={styles.outlineBtnText}>Retour</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.outlineBtn, { marginTop: 8 }]} onPress={() => loadAll("initial")}>
          <FontAwesome5 name="sync-alt" size={12} color={colors.text} />
          <Text style={styles.outlineBtnText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Render: pieces ──

  const etat = classDetails.etat as string | undefined;
  const etatBadge =
    etat === "ACTIF"
      ? { label: "Actif", tone: "green" as Tone }
      : etat === "EN_ATTENTE_APPROBATION"
        ? { label: "En attente", tone: "orange" as Tone }
        : { label: "Inactif", tone: "red" as Tone };
  const canManageModerator =
    isAdmin || classDetails.createurId === currentUserId || classDetails.moderatorId === currentUserId;

  const renderBanners = () => (
    <>
      {success ? (
        <View style={[styles.banner, styles.bannerSuccess]}>
          <FontAwesome5 name="check-circle" size={14} color="#22C55E" solid />
          <Text style={[styles.bannerText, { color: isDark ? "#4ADE80" : "#15803D" }]}>{success}</Text>
          <TouchableOpacity onPress={() => setSuccess("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <FontAwesome5 name="times" size={12} color="#4ADE80" />
          </TouchableOpacity>
        </View>
      ) : null}
      {error ? (
        <View style={[styles.banner, styles.bannerError]}>
          <FontAwesome5 name="exclamation-circle" size={14} color="#EF4444" />
          <Text style={[styles.bannerText, { color: isDark ? "#F87171" : "#B91C1C" }]}>{error}</Text>
          <TouchableOpacity onPress={() => setError("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <FontAwesome5 name="times" size={12} color="#F87171" />
          </TouchableOpacity>
        </View>
      ) : null}
    </>
  );

  const renderHero = () => (
    <LinearGradient colors={HERO_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <View style={styles.heroBubble} pointerEvents="none" />
      {/* Row 1: back + admin delete */}
      <View style={styles.heroTopRow}>
        <TouchableOpacity style={styles.heroBack} onPress={onBack} activeOpacity={0.8}>
          <FontAwesome5 name="arrow-left" size={12} color="#FFFFFF" />
          <Text style={styles.heroBackText}>Retour</Text>
        </TouchableOpacity>
        {isAdmin ? (
          <TouchableOpacity
            style={[styles.heroDelete, actionLoading === "delete" && { opacity: 0.6 }]}
            onPress={askDeleteClass}
            disabled={actionLoading === "delete"}
            activeOpacity={0.85}
          >
            {actionLoading === "delete" ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <FontAwesome5 name="trash-alt" size={11} color="#FFFFFF" />
            )}
            <Text style={styles.heroBackText}>Supprimer</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Row 2: identity */}
      <View style={styles.heroIdentity}>
        <View style={styles.heroIcon}>
          <FontAwesome5 name="graduation-cap" size={18} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.heroTitle}>{classDetails.nom || selectedClass.name}</Text>
          <View style={styles.heroBadges}>
            {etat ? <Tag tone={etatBadge.tone} label={etatBadge.label} /> : null}
            {roleBadge ? <Tag tone={roleBadge.tone} label={roleBadge.label} /> : null}
          </View>
          <View style={styles.heroMeta}>
            {classDetails.niveau ? <Text style={styles.heroMetaText}>{classDetails.niveau}</Text> : null}
            {classDetails.etablissement?.nom ? (
              <View style={styles.heroMetaItem}>
                <FontAwesome5 name="school" size={10} color="#DBEAFE" />
                <Text style={styles.heroMetaText} numberOfLines={1}>
                  {classDetails.etablissement.nom}
                </Text>
              </View>
            ) : null}
            <View style={styles.heroMetaItem}>
              <FontAwesome5 name="user-friends" size={10} color="#DBEAFE" />
              <Text style={styles.heroMetaText}>{users.eleves.length} participants</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Row 3: management actions */}
      <View style={styles.heroActions}>
        <HeroButton icon="sync-alt" label="Actualiser" onPress={() => loadAll("refresh")} loading={refreshing} />
        {canManageModerator ? (
          <HeroButton
            icon="user-plus"
            label="Modérateur"
            onPress={() => setModeratorOpen(true)}
            disabled={etat === "EN_ATTENTE_APPROBATION"}
          />
        ) : null}
        {isAdmin || isModerator ? (
          <HeroButton icon="shield-alt" label="Droits" onPress={() => setRightsOpen(true)} disabled={etat === "EN_ATTENTE_APPROBATION"} />
        ) : null}
        <HeroButton icon="history" label="Historique" onPress={openHistory} loading={actionLoading === "history"} />
        {isAdmin && isPending ? (
          <>
            <HeroButton icon="check" label="Approuver" variant="success" onPress={askApproveClass} loading={actionLoading === "approve"} />
            <HeroButton icon="times" label="Rejeter" variant="danger" onPress={() => openClassReject("admin")} loading={actionLoading === "admin-reject"} />
          </>
        ) : null}
        {canSelfManage ? (
          <>
            <HeroButton icon="check" label="Approuver" variant="success" onPress={() => handleApprove(true)} loading={actionLoading === "self-approve"} />
            <HeroButton icon="times" label="Rejeter" variant="dangerSoft" onPress={() => openClassReject("self")} loading={actionLoading === "self-reject"} />
          </>
        ) : null}
      </View>
    </LinearGradient>
  );

  const renderQuickActions = () => {
    if (!showQuickActions) return null;
    const items: { key: string; label: string; icon: string; gradient: string[]; onPress: () => void }[] = [];
    if (navCoursManagement) items.push({ key: "cm", label: "Gestion des Cours", icon: "book", gradient: ["#0EA5E9", "#4F46E5"], onPress: () => navCoursManagement(classId) });
    if (navCourseCreation) items.push({ key: "cc", label: "Créer un cours", icon: "plus", gradient: ["#4F46E5", "#7C3AED"], onPress: () => navCourseCreation(classId) });
    if (navExercises) items.push({ key: "ex", label: "Exercices Programmer", icon: "file-alt", gradient: ["#F093FB", "#F5576C"], onPress: () => navExercises(classId) });
    if (navEvents) items.push({ key: "ev", label: "Événements", icon: "calendar-alt", gradient: ["#F6A623", "#E07B00"], onPress: () => navEvents(classId) });
    return (
      <View style={[styles.card, styles.quickCard]}>
        <Text style={styles.quickTitle}>ACTIONS RAPIDES</Text>
        <View style={styles.quickGrid}>
          {items.map((it) => (
            <TouchableOpacity key={it.key} style={styles.quickItem} onPress={it.onPress} activeOpacity={0.85}>
              <LinearGradient colors={it.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.quickBtn}>
                <FontAwesome5 name={it.icon as any} size={13} color="#FFFFFF" />
                <Text style={styles.quickBtnText} numberOfLines={1}>
                  {it.label}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: "overview", label: "Aperçu", icon: "book" },
    { key: "professeurs", label: `Professeurs (${users.professeurs.length})`, icon: "user" },
    { key: "eleves", label: `Élèves (${users.eleves.length})`, icon: "user-friends" },
    { key: "parents", label: `Parents (${users.parents.length})`, icon: "user-friends" },
    { key: "utilisateurs", label: `Utilisateurs (${users.utilisateurs.length})`, icon: "user" },
    { key: "access-requests", label: `Demandes (${users.accessRequests.length})`, icon: "clock" },
    ...(!isAdmin
      ? ([
          { key: "courses", label: `Cours (${courses.length})`, icon: "book" },
          { key: "exercises", label: `Exercices (${exercises.length})`, icon: "file-alt" },
        ] as { key: TabKey; label: string; icon: string }[])
      : []),
    { key: "events", label: `Événements (${events.length})`, icon: "calendar-alt" },
  ];

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContent}>
        {tabs.map((t) => {
          const active = activeTab === t.key;
          return (
            <TouchableOpacity key={t.key} style={[styles.tab, active && styles.tabActive]} onPress={() => handleTabChange(t.key)} activeOpacity={0.8}>
              <FontAwesome5 name={t.icon as any} size={11} color={active ? (isDark ? "#A5B4FC" : "#4338CA") : colors.textMuted} solid />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderModeratorInfo = () => {
    const current = classDetails.moderator || (moderatorsWithRights.length > 0 ? moderatorsWithRights[0] : null);
    if (!current) return <Text style={styles.mutedText}>Aucun modérateur assigné</Text>;
    return (
      <View>
        <View style={styles.modRow}>
          <LinearGradient colors={["#6366F1", "#9333EA"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(current)}</Text>
          </LinearGradient>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.userName}>{fullName(current)}</Text>
            {current.email ? <Text style={styles.userSub}>{current.email}</Text> : null}
          </View>
        </View>
        <View style={styles.linkRow}>
          <TouchableOpacity style={styles.linkBtn} onPress={() => setProfileUser(current)}>
            <FontAwesome5 name="user" size={11} color="#4F46E5" />
            <Text style={[styles.linkText, { color: "#4F46E5" }]}>Voir le profil</Text>
          </TouchableOpacity>
          {moderatorsWithRights.length > 0 ? (
            <TouchableOpacity style={styles.linkBtn} onPress={removeModerator} disabled={actionLoading === "removeModerator"}>
              {actionLoading === "removeModerator" ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <FontAwesome5 name="user-times" size={11} color="#DC2626" />
              )}
              <Text style={[styles.linkText, { color: "#DC2626" }]}>Retirer</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  const renderOverview = () => {
    const status = classDetails.expireParOffre
      ? { tone: "red" as Tone, text: "Offre expirée" }
      : CLASS_STATUS[etat || ""] || { tone: "gray" as Tone, text: etat || "—" };
    const pub = PUBLICATION_RIGHTS[classDetails.droitPublication] || { tone: "gray" as Tone, text: classDetails.droitPublication || "—" };
    return (
      <>
        <SectionCard icon="book" title="INFORMATIONS DE LA CLASSE">
          <View style={styles.cardBody}>
            <InfoRow label="Nom">{classDetails.nom || "—"}</InfoRow>
            <InfoRow label="Niveau">{classDetails.niveau || "—"}</InfoRow>
            <InfoRow label="Date de création">
              {classDetails.dateCreation ? formatDate(classDetails.dateCreation) : "—"}
            </InfoRow>
            <InfoRow label="Établissement">{classDetails.etablissement?.nom || "Classe indépendante"}</InfoRow>
            <InfoRow label="Code d'activation">
              <View style={styles.codeRow}>
                <Text style={styles.code} selectable>
                  {classDetails.codeActivation || "—"}
                </Text>
                {classDetails.codeActivation ? (
                  <TouchableOpacity onPress={shareCode} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Partager le code">
                    <FontAwesome5 name="copy" size={12} color={colors.textLight} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </InfoRow>
            <InfoRow label="Statut">
              <Tag tone={status.tone} label={status.text} />
            </InfoRow>
            <InfoRow label="Droits de publication">
              <Tag tone={pub.tone} label={pub.text} />
            </InfoRow>
            <InfoRow label="Accès majeur">
              {classDetails.accesMajeur ? (
                <Tag tone="purple" icon="certificate" label="Classe Majeure — email" />
              ) : (
                <Tag tone="gray" label="Accès standard" />
              )}
            </InfoRow>
          </View>
        </SectionCard>

        <View style={{ marginBottom: 14 }}>
          <OffreInfoPanel type="CLASSE" entityId={classId} />
        </View>

        <SectionCard icon="crown" title="MODÉRATEUR">
          <View style={styles.cardBody}>{renderModeratorInfo()}</View>
        </SectionCard>
      </>
    );
  };

  const renderUserCard = (u: AnyUser, type: ListType) => {
    const isSelf = !!currentUserId && u.id === currentUserId;
    const typeTone: Record<ListType, string[]> = {
      professeurs: ["#3B82F6", "#4F46E5"],
      eleves: ["#10B981", "#059669"],
      parents: ["#F59E0B", "#D97706"],
      utilisateurs: ["#8B5CF6", "#7C3AED"],
      "access-requests": ["#6366F1", "#9333EA"],
    };
    const reqType = REQUEST_TYPE[u.typeUtilisateur] || { tone: "purple" as Tone, text: u.typeUtilisateur || "—" };
    return (
      <View key={u.id} style={styles.userCard}>
        <View style={styles.userHead}>
          <LinearGradient colors={typeTone[type]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(u)}</Text>
          </LinearGradient>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.userName} numberOfLines={1}>
              {fullName(u) || "Non renseigné"}
              {isSelf ? <Text style={styles.youText}>  (vous)</Text> : null}
            </Text>
            <Text style={styles.userSub} numberOfLines={1}>
              {u.email || "—"}
            </Text>
          </View>
          {type !== "access-requests" ? (
            <Tag tone={isActiveEtat(u.etat) ? "green" : "red"} label={isActiveEtat(u.etat) ? "Actif" : "Inactif"} />
          ) : null}
        </View>

        <View style={styles.userGrid}>
          <InfoRow label="Téléphone">{u.telephone || "—"}</InfoRow>
          {type === "professeurs" ? (
            <>
              <InfoRow label="Établissement">{u.nomEtablissement || "—"}</InfoRow>
              <InfoRow label="Matricule">{u.matriculeProfesseur || "—"}</InfoRow>
              <InfoRow label="Date de création">{userDate(u)}</InfoRow>
            </>
          ) : null}
          {type === "eleves" ? (
            <>
              <InfoRow label="Niveau">{u.niveau || "—"}</InfoRow>
              <InfoRow label="Date de création">{userDate(u)}</InfoRow>
            </>
          ) : null}
          {type === "parents" ? (
            <>
              <InfoRow label="Adresse">{u.adresse || "—"}</InfoRow>
              <InfoRow label="Date de création">{userDate(u)}</InfoRow>
            </>
          ) : null}
          {type === "utilisateurs" ? (
            <>
              <InfoRow label="Adresse">{u.adresse || "—"}</InfoRow>
              <InfoRow label="Type">
                <Tag tone="purple" label={u.type === "utilisateur" ? "Utilisateur" : u.type || "—"} />
              </InfoRow>
              <InfoRow label="Admin">
                <Tag tone={u.admin ? "gold" : "gray"} label={u.admin ? "Oui" : "Non"} />
              </InfoRow>
              <InfoRow label="Date de création">{userDate(u)}</InfoRow>
            </>
          ) : null}
          {type === "access-requests" ? (
            <>
              <InfoRow label="Date demande">{fmtDate(u.dateDemande)}</InfoRow>
              <InfoRow label="Type">
                <Tag tone={reqType.tone} label={reqType.text} />
              </InfoRow>
              <InfoRow label="Statut demande">
                <Tag tone={u.etat === "EN_ATTENTE" ? "orange" : "gray"} label={u.etat === "EN_ATTENTE" ? "En attente" : u.etat || "—"} />
              </InfoRow>
            </>
          ) : null}
        </View>

        {type === "professeurs" && isModerator ? (
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Droit de publication</Text>
              {isSelf ? <Text style={styles.switchHint}>Vous ne pouvez pas modifier vos propres droits de publication</Text> : null}
            </View>
            {actionLoading === `toggle-${u.id}` ? <ActivityIndicator size="small" color="#4F46E5" /> : null}
            <Switch
              value={!!publicationRightsMap[u.id]}
              disabled={isSelf || actionLoading === `toggle-${u.id}`}
              onValueChange={(v) => togglePublicationRight(u, v)}
              trackColor={{ false: colors.border, true: "#818CF8" }}
              thumbColor={publicationRightsMap[u.id] ? "#4F46E5" : "#F8FAFC"}
            />
          </View>
        ) : null}

        <View style={styles.userActions}>
          <TouchableOpacity style={styles.actBtn} onPress={() => setProfileUser(u)}>
            <FontAwesome5 name="eye" size={11} color={colors.textMuted} />
            <Text style={styles.actText}>Détails</Text>
          </TouchableOpacity>
          {type === "access-requests" ? (
            isModerator ? (
              <>
                <TouchableOpacity
                  style={[styles.actBtn, styles.actPrimary]}
                  onPress={() => approveRequest(u)}
                  disabled={actionLoading === `approve-${u.id}`}
                >
                  {actionLoading === `approve-${u.id}` ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <FontAwesome5 name="check" size={11} color="#FFFFFF" />
                  )}
                  <Text style={[styles.actText, { color: "#FFFFFF" }]}>Approuver</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actBtn, styles.actDanger]}
                  onPress={() => {
                    setRejectReqUser(u);
                    setRejectReqReason("");
                    setRejectReqError("");
                  }}
                >
                  <FontAwesome5 name="times" size={11} color="#DC2626" />
                  <Text style={[styles.actText, { color: "#DC2626" }]}>Rejeter</Text>
                </TouchableOpacity>
              </>
            ) : null
          ) : (
            <>
              {isModerator && !isSelf ? (
                <TouchableOpacity style={[styles.actBtn, styles.actDanger]} onPress={() => askRemoveAccess(u)}>
                  <FontAwesome5 name="user-times" size={11} color="#DC2626" />
                  <Text style={[styles.actText, { color: "#DC2626" }]}>Retirer l'accès</Text>
                </TouchableOpacity>
              ) : null}
              {isAdmin ? (
                <TouchableOpacity style={[styles.actBtn, styles.actDangerSolid]} onPress={() => askDeleteUser(u, type as UserCategory)}>
                  <FontAwesome5 name="trash" size={11} color="#FFFFFF" />
                  <Text style={[styles.actText, { color: "#FFFFFF" }]}>Supprimer</Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      </View>
    );
  };

  const renderUserList = (type: ListType) => {
    const source = type === "access-requests" ? users.accessRequests : users[type];
    const filtered = source.filter((u) => {
      if (type === "access-requests") return typeFilter === "all" || u.typeUtilisateur === typeFilter;
      if (statusFilter === "all") return true;
      return statusFilter === "ACTIVE" ? isActiveEtat(u.etat) : !isActiveEtat(u.etat);
    });
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
    const isReq = type === "access-requests";
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={[styles.listTitle, { flex: 1 }]}>{LIST_TITLES[type]}</Text>
          <Tag tone="blue" label={`${source.length} ${isReq ? "demande(s)" : "utilisateur(s)"}`} />
        </View>
        <View style={styles.filterRow}>
          {isReq ? (
            <SelectPill
              icon="filter"
              title="Type"
              value={typeFilter}
              onChange={(v) => {
                setTypeFilter(v);
                setPage(1);
              }}
              options={[
                { value: "all", label: "Tous les types" },
                { value: "PROFESSEUR", label: "Professeur" },
                { value: "ELEVE", label: "Élève" },
                { value: "PARENT", label: "Parent" },
                { value: "UTILISATEUR", label: "Utilisateur" },
              ]}
            />
          ) : (
            <SelectPill
              icon="filter"
              title="Statut"
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
              options={[
                { value: "all", label: "Tous les statuts" },
                { value: "ACTIVE", label: "Actif" },
                { value: "INACTIVE", label: "Inactif" },
              ]}
            />
          )}
        </View>
        <View style={styles.cardBody}>
          {refreshing && source.length === 0 ? (
            <ActivityIndicator color="#4F46E5" style={{ paddingVertical: 20 }} />
          ) : pageItems.length === 0 ? (
            <View style={styles.empty}>
              <FontAwesome5 name={isReq ? "inbox" : "users"} size={26} color={colors.textLight} />
              <Text style={styles.emptyText}>{LIST_EMPTY[type]}</Text>
            </View>
          ) : (
            pageItems.map((u) => renderUserCard(u, type))
          )}
          <Pager page={safePage} total={filtered.length} onChange={setPage} noun={isReq ? "demandes" : "utilisateurs"} />
        </View>
      </View>
    );
  };

  const renderMajeurBox = () => {
    if (!classDetails.accesMajeur) return null;
    const t = tone("blue");
    return (
      <View style={[styles.majeurBox, { backgroundColor: t.bg, borderColor: t.bd }]}>
        <View style={styles.majeurTitleRow}>
          <FontAwesome5 name="key" size={12} color={t.fg} />
          <Text style={[styles.majeurTitle, { color: t.fg }]}>Classe Majeure — Ajouter un élève par email</Text>
        </View>
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <FontAwesome5 name="search" size={11} color={colors.textLight} />
            <TextInput
              style={styles.searchInput}
              placeholder="Email de l'élève..."
              placeholderTextColor={colors.textLight}
              value={majeurQuery}
              onChangeText={setMajeurQuery}
              onSubmitEditing={searchMajeur}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="search"
            />
          </View>
          <PrimaryBtn label="Rechercher" icon="search" onPress={searchMajeur} loading={majeurSearching} />
        </View>
        {majeurResults.map((u) => (
          <View key={u.id} style={styles.resultRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.userName} numberOfLines={1}>
                {fullName(u)}
              </Text>
              <Text style={styles.userSub} numberOfLines={1}>
                {u.email}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.actBtn, styles.actPrimary]}
              onPress={() => addMajeurStudent(u)}
              disabled={actionLoading === `add-${u.id}`}
            >
              {actionLoading === `add-${u.id}` ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
              <Text style={[styles.actText, { color: "#FFFFFF" }]}>Ajouter</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  };

  const renderModuleList = (kind: "courses" | "exercises" | "events") => {
    const conf = {
      courses: {
        title: "Cours programmés",
        subtitle: "Cours de la classe (visibles par tous les membres)",
        count: `${courses.length} cours`,
        countTone: "blue" as Tone,
        empty: "Aucun cours programmé pour cette classe",
        data: courses,
        icon: "book",
      },
      exercises: {
        title: "Exercices programmés",
        subtitle: "Liste des exercices pour cette classe",
        count: `${exercises.length} exercices`,
        countTone: "purple" as Tone,
        empty: "Aucun exercice programmé pour cette classe",
        data: exercises,
        icon: "file-alt",
      },
      events: {
        title: "Événements de la classe",
        subtitle: "Actualités et événements à venir",
        count: `${events.length} événements`,
        countTone: "orange" as Tone,
        empty: "Aucun événement pour cette classe",
        data: events,
        icon: "calendar-alt",
      },
    }[kind];
    const totalPages = Math.max(1, Math.ceil(conf.data.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const items = conf.data.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.listTitle}>{conf.title}</Text>
            <Text style={styles.cardHeaderSub}>{conf.subtitle}</Text>
          </View>
        </View>
        <View style={styles.moduleToolbar}>
          <Tag tone={conf.countTone} label={conf.count} />
          <View style={styles.moduleBtns}>
            {kind === "courses" && navCoursManagement ? (
              <TouchableOpacity style={styles.smallOutline} onPress={() => navCoursManagement(classId)}>
                <FontAwesome5 name="book" size={10} color={colors.text} />
                <Text style={styles.smallOutlineText}>Voir tout</Text>
              </TouchableOpacity>
            ) : null}
            {kind === "courses" && isModerator && navCourseCreation ? (
              <TouchableOpacity style={[styles.smallSolid, { backgroundColor: "#4F46E5" }]} onPress={() => navCourseCreation(classId)}>
                <FontAwesome5 name="plus" size={10} color="#FFFFFF" />
                <Text style={styles.smallSolidText}>Programmer</Text>
              </TouchableOpacity>
            ) : null}
            {kind === "exercises" && isModerator && navExercises ? (
              <TouchableOpacity style={[styles.smallSolid, { backgroundColor: "#9333EA" }]} onPress={() => navExercises(classId)}>
                <FontAwesome5 name="plus" size={10} color="#FFFFFF" />
                <Text style={styles.smallSolidText}>Programmer</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        <View style={styles.cardBody}>
          {items.length === 0 ? (
            <View style={styles.empty}>
              <FontAwesome5 name={conf.icon as any} size={26} color={colors.textLight} />
              <Text style={styles.emptyText}>{conf.empty}</Text>
            </View>
          ) : (
            items.map((it) => {
              if (kind === "courses") {
                const st = COURSE_STATUS[it.etatCoursProgramme] || { tone: "gray" as Tone, text: it.etatCoursProgramme || "—" };
                return (
                  <View key={it.id} style={styles.moduleItem}>
                    <View style={styles.moduleHead}>
                      <View style={[styles.moduleIcon, { backgroundColor: tone("indigo").bg }]}>
                        <FontAwesome5 name="book-open" size={13} color={tone("indigo").fg} />
                      </View>
                      <Text style={styles.moduleTitle} numberOfLines={2}>
                        {it.cours?.titre || it.description || "—"}
                      </Text>
                      <Tag tone={st.tone} label={st.text} />
                    </View>
                    <View style={styles.moduleMeta}>
                      <View style={styles.metaItem}>
                        <FontAwesome5 name="clock" size={10} color={colors.textLight} />
                        <Text style={styles.metaText}>{fmtDateTime(it.dateCoursPrevue)}</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <FontAwesome5 name="map-marker-alt" size={10} color={colors.textLight} />
                        <Text style={styles.metaText}>{it.lieu || "—"}</Text>
                      </View>
                    </View>
                  </View>
                );
              }
              if (kind === "exercises") {
                return (
                  <View key={it.id} style={styles.moduleItem}>
                    <View style={styles.moduleHead}>
                      <View style={[styles.moduleIcon, { backgroundColor: tone("purple").bg }]}>
                        <FontAwesome5 name="file-alt" size={13} color={tone("purple").fg} />
                      </View>
                      <Text style={styles.moduleTitle} numberOfLines={2}>
                        {it.nom || it.exercise?.nom || it.exerciseNom || "—"}
                      </Text>
                      <Tag tone={EXERCISE_TONE[it.etat] || "gray"} label={it.etat || "—"} />
                    </View>
                    <View style={styles.moduleMeta}>
                      <View style={styles.metaItem}>
                        <FontAwesome5 name="clock" size={10} color={colors.textLight} />
                        <Text style={styles.metaText}>{fmtDateTime(it.dateExoPrevue)}</Text>
                      </View>
                      {navExercises ? (
                        <TouchableOpacity onPress={() => navExercises(classId)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                          <Text style={[styles.linkText, { color: "#4F46E5" }]}>Détails</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                );
              }
              return (
                <View key={it.id} style={styles.moduleItem}>
                  <View style={styles.moduleHead}>
                    <View style={[styles.moduleIcon, { backgroundColor: tone("orange").bg }]}>
                      <FontAwesome5 name="calendar-alt" size={13} color={tone("orange").fg} />
                    </View>
                    <Text style={styles.moduleTitle} numberOfLines={2}>
                      {it.titre || "—"}
                    </Text>
                    <Tag tone={EVENT_TONE[it.etat] || "gray"} label={it.etat || "—"} />
                  </View>
                  <View style={styles.moduleMeta}>
                    <View style={styles.metaItem}>
                      <FontAwesome5 name="clock" size={10} color={colors.textLight} />
                      <Text style={styles.metaText}>{fmtDateTime(it.heureDebut)}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <FontAwesome5 name="map-marker-alt" size={10} color={colors.textLight} />
                      <Text style={styles.metaText}>{it.lieu || "—"}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
          <Pager page={safePage} total={conf.data.length} onChange={setPage} noun="éléments" />
        </View>
      </View>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return renderOverview();
      case "professeurs":
      case "parents":
      case "utilisateurs":
      case "access-requests":
        return renderUserList(activeTab);
      case "eleves":
        return (
          <>
            {renderMajeurBox()}
            {renderUserList("eleves")}
          </>
        );
      case "courses":
      case "exercises":
      case "events":
        return renderModuleList(activeTab);
      default:
        return null;
    }
  };

  // ── Modals ──

  const renderProfileSheet = () => {
    const u = profileUser;
    const t = u ? String(u.typeUtilisateur || u.type || u.role || "").toUpperCase() : "";
    const typeLabel =
      t === "PROFESSEUR" || t === "PROFESSOR"
        ? "Professeur"
        : t === "ELEVE" || t === "ÉLÈVE"
          ? "Élève"
          : t === "PARENT"
            ? "Parent"
            : "Utilisateur";
    return (
      <BottomSheet visible={!!u} onClose={() => setProfileUser(null)} title="Détails de l'utilisateur">
        {u ? (
          <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
            <View style={styles.profileHead}>
              <LinearGradient colors={["#6366F1", "#9333EA"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarLg}>
                <Text style={styles.avatarLgText}>{initials(u)}</Text>
              </LinearGradient>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.profileName}>{fullName(u) || "Non renseigné"}</Text>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                  <Tag tone="indigo" label={typeLabel} />
                  {u.etat && !u.dateDemande ? (
                    <Tag tone={isActiveEtat(u.etat) ? "green" : "red"} label={isActiveEtat(u.etat) ? "Actif" : "Inactif"} />
                  ) : null}
                </View>
              </View>
            </View>
            <View style={styles.profileBody}>
              <InfoRow label="Email">{u.email || "—"}</InfoRow>
              <InfoRow label="Téléphone">{u.telephone || "—"}</InfoRow>
              {u.niveau ? <InfoRow label="Niveau">{u.niveau}</InfoRow> : null}
              {u.nomEtablissement ? <InfoRow label="Établissement">{u.nomEtablissement}</InfoRow> : null}
              {u.matriculeProfesseur ? <InfoRow label="Matricule">{u.matriculeProfesseur}</InfoRow> : null}
              {u.adresse ? <InfoRow label="Adresse">{u.adresse}</InfoRow> : null}
              {u.dateDemande ? <InfoRow label="Date de la demande">{fmtDate(u.dateDemande)}</InfoRow> : <InfoRow label="Date de création">{userDate(u)}</InfoRow>}
            </View>
          </ScrollView>
        ) : null}
      </BottomSheet>
    );
  };

  const renderSearchBox = (
    value: string,
    onChange: (v: string) => void,
    onSubmit: () => void,
    placeholder: string,
    searching: boolean
  ) => (
    <View style={styles.searchRow}>
      <View style={styles.searchInputWrap}>
        <FontAwesome5 name="search" size={11} color={colors.textLight} />
        <TextInput
          style={styles.searchInput}
          placeholder={placeholder}
          placeholderTextColor={colors.textLight}
          value={value}
          onChangeText={onChange}
          onSubmitEditing={onSubmit}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </View>
      <PrimaryBtn label="Rechercher" icon="search" onPress={onSubmit} loading={searching} />
    </View>
  );

  const renderModeratorSheet = () => (
    <BottomSheet visible={moderatorOpen} onClose={closeModerator} title="Assigner un modérateur">
      <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.fieldLabel}>Rechercher un professeur par nom ou email :</Text>
        {renderSearchBox(modQuery, setModQuery, searchModerator, "Nom ou email du professeur", modSearching)}
        {modError ? <Text style={styles.inlineError}>{modError}</Text> : null}
        {modSearched && modResults.length === 0 ? <Text style={styles.mutedText}>Aucun professeur trouvé avec ces critères</Text> : null}
        {modResults.length > 0 ? <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Professeurs trouvés :</Text> : null}
        {modResults.map((p) => {
          const sel = selectedModerator?.id === p.id;
          return (
            <TouchableOpacity key={p.id} style={[styles.resultRow, sel && styles.resultRowSelected]} onPress={() => setSelectedModerator(p)} activeOpacity={0.8}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.userName} numberOfLines={1}>
                  {`${p.nom || ""} ${p.prenom || ""}`.trim()}
                </Text>
                <Text style={styles.userSub} numberOfLines={1}>
                  {p.email}
                </Text>
                {p.nomEtablissement ? <Text style={styles.userSub}>Établissement : {p.nomEtablissement}</Text> : null}
                {p.matriculeProfesseur ? <Text style={styles.userSub}>Matricule : {p.matriculeProfesseur}</Text> : null}
              </View>
              <Text style={[styles.linkText, { color: sel ? colors.textLight : "#4F46E5" }]}>{sel ? "Sélectionné" : "Sélectionner"}</Text>
            </TouchableOpacity>
          );
        })}
        {selectedModerator ? (
          <View style={styles.selectedBox}>
            <Text style={styles.userName}>
              Modérateur sélectionné : {selectedModerator.nom} {selectedModerator.prenom}
            </Text>
            <Text style={styles.userSub}>Email : {selectedModerator.email}</Text>
            {selectedModerator.nomEtablissement ? <Text style={styles.userSub}>Établissement : {selectedModerator.nomEtablissement}</Text> : null}
            <View style={styles.sheetFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setSelectedModerator(null);
                  setModQuery("");
                  setModResults([]);
                  setModSearched(false);
                }}
              >
                <Text style={styles.cancelText}>Annuler la sélection</Text>
              </TouchableOpacity>
              <PrimaryBtn label="Assigner" icon="user-plus" onPress={assignModerator} loading={actionLoading === "moderator"} />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );

  const CheckRow = ({ checked, label, onPress }: { checked: boolean; label: string; onPress: () => void }) => (
    <TouchableOpacity style={styles.checkRow} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.checkbox, checked && styles.checkboxOn]}>{checked ? <FontAwesome5 name="check" size={10} color="#FFFFFF" /> : null}</View>
      <Text style={styles.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );

  const renderRightsSheet = () => (
    <BottomSheet visible={rightsOpen} onClose={closeRights} title="Gérer les droits de publication">
      <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.fieldLabel}>Rechercher un utilisateur par nom ou email :</Text>
        {renderSearchBox(rightsQuery, setRightsQuery, searchRights, "Email de l'utilisateur", rightsSearching)}
        {rightsError ? <Text style={styles.inlineError}>{rightsError}</Text> : null}
        {rightsSearched && rightsResults.length === 0 ? <Text style={styles.mutedText}>Aucun utilisateur trouvé</Text> : null}
        {rightsResults.length > 0 ? <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Résultats de la recherche :</Text> : null}
        {rightsResults.map((u) => {
          const sel = rightsUser?.id === u.id;
          return (
            <TouchableOpacity key={u.id} style={[styles.resultRow, sel && styles.resultRowSelected]} onPress={() => setRightsUser(u)} activeOpacity={0.8}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.userName} numberOfLines={1}>
                  {`${u.nom || ""} ${u.prenom || ""}`.trim()}
                </Text>
                <Text style={styles.userSub} numberOfLines={1}>
                  {u.email}
                </Text>
                <Text style={styles.userSub}>Type : {u.type || u.typeUtilisateur || "Utilisateur"}</Text>
              </View>
              <Text style={[styles.linkText, { color: sel ? colors.textLight : "#4F46E5" }]}>{sel ? "Sélectionné" : "Sélectionner"}</Text>
            </TouchableOpacity>
          );
        })}
        {rightsUser ? (
          <View style={styles.selectedBox}>
            <Text style={styles.userName}>
              Droits à assigner à {rightsUser.nom} {rightsUser.prenom} :
            </Text>
            <CheckRow
              checked={rightsFlags.peutPublier}
              label="Peut publier"
              onPress={() => setRightsFlags((f) => ({ ...f, peutPublier: !f.peutPublier }))}
            />
            <CheckRow
              checked={rightsFlags.peutModerer}
              label="Peut modérer"
              onPress={() => setRightsFlags((f) => ({ ...f, peutModerer: !f.peutModerer }))}
            />
            <View style={styles.sheetFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setRightsUser(null);
                  setRightsQuery("");
                  setRightsResults([]);
                  setRightsSearched(false);
                }}
              >
                <Text style={styles.cancelText}>Annuler la sélection</Text>
              </TouchableOpacity>
              <PrimaryBtn label="Assigner les droits" icon="shield-alt" onPress={assignRights} loading={actionLoading === "assignPublicationRights"} />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );

  const renderHistorySheet = () => (
    <BottomSheet visible={historyOpen} onClose={() => setHistoryOpen(false)} title="Historique d'activation">
      <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
        {history.length === 0 ? (
          <View style={styles.empty}>
            <FontAwesome5 name="history" size={26} color={colors.textLight} />
            <Text style={styles.emptyText}>Aucun historique disponible</Text>
          </View>
        ) : (
          history.map((item, idx) => (
            <View key={item.id ?? idx} style={styles.historyItem}>
              <View style={styles.historyHead}>
                <Text style={styles.historyTitle}>
                  {item.active ? "Activation" : "Désactivation"} - {item.etatClasse}
                </Text>
                <Tag tone={item.active ? "green" : "red"} label={item.active ? "Actif" : "Inactif"} />
              </View>
              <Text style={styles.userSub}>{fmtDateTime(item.dateActivation)}</Text>
              {item.dateDesactivation ? (
                <Text style={styles.historyLine}>Date de désactivation : {fmtDateTime(item.dateDesactivation)}</Text>
              ) : null}
              {item.motifDesactivation ? <Text style={styles.historyLine}>Motif : {item.motifDesactivation}</Text> : null}
            </View>
          ))
        )}
      </ScrollView>
    </BottomSheet>
  );

  const renderRejectRequestDialog = () => (
    <Dialog
      visible={!!rejectReqUser}
      onClose={() => {
        setRejectReqUser(null);
        setRejectReqReason("");
      }}
      title="Rejeter la demande d'accès"
      icon="times"
      footer={
        <>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setRejectReqUser(null)}>
            <Text style={styles.cancelText}>Annuler</Text>
          </TouchableOpacity>
          <PrimaryBtn label="Rejeter" icon="times" onPress={confirmRejectRequest} loading={actionLoading === "reject-request"} gradient={["#EF4444", "#DC2626"]} />
        </>
      }
    >
      <Text style={styles.confirmText}>
        Veuillez saisir le motif du rejet pour {rejectReqUser?.prenom} {rejectReqUser?.nom} :
      </Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        multiline
        value={rejectReqReason}
        onChangeText={(v) => {
          setRejectReqReason(v);
          if (rejectReqError) setRejectReqError("");
        }}
        placeholder="Motif du rejet..."
        placeholderTextColor={colors.textLight}
      />
      {rejectReqError ? <Text style={styles.inlineError}>{rejectReqError}</Text> : null}
    </Dialog>
  );

  const renderClassRejectDialog = () => (
    <Dialog
      visible={!!classRejectMode}
      onClose={() => setClassRejectMode(null)}
      title={classRejectMode === "self" ? "Confirmer le rejet de la classe" : tr("classConfirm.rejectTitle")}
      subtitle={classDetails.nom}
      icon="times"
      footer={
        <>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => setClassRejectMode(null)}
            disabled={actionLoading === "admin-reject" || actionLoading === "self-reject"}
          >
            <Text style={styles.cancelText}>{tr("classConfirm.cancel")}</Text>
          </TouchableOpacity>
          <PrimaryBtn
            label={tr("classConfirm.confirm")}
            icon="times"
            onPress={confirmClassReject}
            disabled={classRejectCodes.length === 0}
            loading={actionLoading === "admin-reject" || actionLoading === "self-reject"}
            gradient={["#EF4444", "#DC2626"]}
          />
        </>
      }
    >
      <Text style={styles.confirmText}>
        {classRejectMode === "self"
          ? "Êtes-vous sûr de vouloir rejeter cette classe ?"
          : getClassActionTexts("reject", classDetails?.nom || selectedClass?.name, tr).message}
      </Text>
      <Text style={styles.fieldLabel}>
        {classRejectMode === "self" ? "Motifs de rejet" : "Motif de rejet"} <Text style={{ color: "#EF4444" }}>*</Text>
      </Text>
      {classRejectMotifsLoading ? (
        <View style={styles.inlineLoading}>
          <ActivityIndicator size="small" color={colors.textMuted} />
          <Text style={styles.mutedText}>Chargement des motifs...</Text>
        </View>
      ) : classRejectMotifs.length === 0 ? (
        <Text style={[styles.mutedText, { fontStyle: "italic" }]}>Aucun motif disponible.</Text>
      ) : (
        classRejectMotifs.map((m) => {
          const code = m.code || m.id;
          const sel = classRejectCodes.includes(code);
          const t = tone("red");
          return (
            <TouchableOpacity
              key={m.id}
              style={[styles.motifRow, sel && { borderColor: t.fg, backgroundColor: t.bg }]}
              onPress={() => {
                toggleRejectCode(code);
                if (classRejectError) setClassRejectError("");
              }}
              activeOpacity={0.8}
            >
              <View style={[classRejectMode === "self" ? styles.checkbox : styles.radio, sel && styles.checkboxDanger]}>
                {sel ? (
                  classRejectMode === "self" ? (
                    <FontAwesome5 name="check" size={9} color="#FFFFFF" />
                  ) : (
                    <View style={styles.radioDot} />
                  )
                ) : null}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.motifCode}>{m.code}</Text>
                {m.descriptif ? <Text style={styles.userSub}>{m.descriptif}</Text> : null}
              </View>
            </TouchableOpacity>
          );
        })
      )}
      <Text style={[styles.fieldLabel, { marginTop: 12 }]}>
        Commentaire supplémentaire <Text style={{ color: colors.textLight, fontWeight: "400" }}>(optionnel)</Text>
      </Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        multiline
        value={classRejectComment}
        onChangeText={setClassRejectComment}
        placeholder={classRejectMode === "self" ? "Détails supplémentaires (optionnel)" : "Précisez si nécessaire..."}
        placeholderTextColor={colors.textLight}
      />
      {classRejectError ? <Text style={styles.inlineError}>{classRejectError}</Text> : null}
    </Dialog>
  );

  const renderConfirmDialog = () => (
    <Dialog
      visible={!!confirm}
      onClose={() => !confirmBusy && setConfirm(null)}
      title={confirm?.title || ""}
      icon="exclamation-circle"
      iconTone={confirm?.danger ? "red" : "indigo"}
      footer={
        <>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirm(null)} disabled={confirmBusy}>
            <Text style={styles.cancelText}>{tr("classConfirm.cancel")}</Text>
          </TouchableOpacity>
          <PrimaryBtn
            label={confirm?.okLabel || "OK"}
            icon={confirm?.danger ? "trash-alt" : "check"}
            onPress={runConfirm}
            loading={confirmBusy}
            gradient={confirm?.danger ? ["#EF4444", "#DC2626"] : ["#4F46E5", "#7C3AED"]}
          />
        </>
      }
    >
      <Text style={styles.confirmText}>{confirm?.message}</Text>
      {confirm?.warning ? <Text style={[styles.confirmText, { color: "#DC2626", fontWeight: "700" }]}>{confirm.warning}</Text> : null}
    </Dialog>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 150 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAll("refresh")} tintColor="#4F46E5" colors={["#4F46E5"]} />}
      >
        <View style={styles.gutter}>
          {renderBanners()}
          {renderHero()}
          {renderQuickActions()}
        </View>
        {renderTabBar()}
        <View style={[styles.gutter, { paddingTop: 14 }]}>{renderTabContent()}</View>
      </ScrollView>

      {renderProfileSheet()}
      {renderModeratorSheet()}
      {renderRightsSheet()}
      {renderHistorySheet()}
      {renderRejectRequestDialog()}
      {renderClassRejectDialog()}
      {renderConfirmDialog()}
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const createStyles = (c: ReturnType<typeof useThemeColors>, isDark: boolean) => {
  const card = c.surface;
  const cardAlt = isDark ? "#172033" : "#F8FAFF";
  const input = isDark ? "#0F172A" : "#F8FAFC";
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    gutter: { paddingHorizontal: 16 },
    disabled: { opacity: 0.4 },

    // Banners
    banner: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
    bannerText: { flex: 1, fontSize: 12 },
    bannerSuccess: { backgroundColor: isDark ? "rgba(34,197,94,0.12)" : "#F0FDF4", borderColor: isDark ? "rgba(34,197,94,0.35)" : "#BBF7D0" },
    bannerError: { backgroundColor: isDark ? "rgba(239,68,68,0.12)" : "#FEF2F2", borderColor: isDark ? "rgba(239,68,68,0.35)" : "#FECACA" },

    // Hero
    hero: { borderRadius: 18, padding: 14, overflow: "hidden", marginBottom: 12 },
    heroBubble: { position: "absolute", top: -32, right: -32, width: 128, height: 128, borderRadius: 64, backgroundColor: "#FFFFFF", opacity: 0.1 },
    heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 },
    heroBack: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
      backgroundColor: "rgba(255,255,255,0.15)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.3)",
    },
    heroBackText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
    heroDelete: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
      backgroundColor: "#DC2626",
      borderWidth: 2,
      borderColor: "#B91C1C",
    },
    heroIdentity: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
    heroIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.2)",
      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.35)",
    },
    heroTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "800", lineHeight: 22 },
    heroBadges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
    heroMeta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 12, rowGap: 4, marginTop: 8 },
    heroMetaItem: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "100%" },
    heroMetaText: { color: "#DBEAFE", fontSize: 12 },
    heroActions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
    heroBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
    heroBtnGhost: { backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.25)" },
    heroBtnSuccess: { backgroundColor: "#16A34A", borderColor: "#15803D" },
    heroBtnDanger: { backgroundColor: "#DC2626", borderColor: "#B91C1C" },
    heroBtnDangerSoft: { backgroundColor: "rgba(239,68,68,0.2)", borderColor: "rgba(239,68,68,0.35)" },
    heroBtnText: { fontSize: 12, fontWeight: "700" },

    // Tags
    tag: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start", maxWidth: "100%" },
    tagText: { fontSize: 11, fontWeight: "700", flexShrink: 1 },

    // Cards
    card: {
      backgroundColor: card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      marginBottom: 14,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOpacity: isDark ? 0 : 0.04,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: isDark ? 0 : 1,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: cardAlt,
    },
    cardHeaderTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    cardHeaderTitle: { fontSize: 11, fontWeight: "800", color: c.textMuted, letterSpacing: 0.6, flexShrink: 1 },
    cardHeaderSub: { fontSize: 11, color: c.textLight, marginTop: 2 },
    cardBody: { paddingHorizontal: 14, paddingVertical: 12 },
    listTitle: { fontSize: 14, fontWeight: "800", color: c.text },

    infoRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, paddingVertical: 5 },
    infoLabel: { fontSize: 12, color: c.textLight, fontWeight: "500", flexShrink: 0, maxWidth: "45%" },
    infoValueWrap: { flex: 1, alignItems: "flex-end" },
    infoValue: { fontSize: 13, color: c.text, fontWeight: "500", textAlign: "right" },
    codeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    code: {
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 13,
      fontWeight: "800",
      color: isDark ? "#A5B4FC" : "#4338CA",
      backgroundColor: isDark ? "rgba(99,102,241,0.18)" : "#EEF2FF",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      overflow: "hidden",
    },
    mutedText: { fontSize: 13, color: c.textLight },

    // Moderator
    modRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    linkRow: { flexDirection: "row", gap: 18, marginTop: 12 },
    linkBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
    linkText: { fontSize: 13, fontWeight: "700" },

    // Quick actions
    quickCard: { padding: 14 },
    quickTitle: { fontSize: 11, fontWeight: "800", color: c.textMuted, letterSpacing: 0.8, marginBottom: 10 },
    quickGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
    quickItem: { width: "50%", padding: 4 },
    quickBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 11, paddingHorizontal: 8, borderRadius: 12 },
    quickBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700", flexShrink: 1 },

    // Tab bar
    tabBar: { backgroundColor: card, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.border },
    tabBarContent: { paddingHorizontal: 12 },
    tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
    tabActive: { borderBottomColor: "#4F46E5" },
    tabText: { fontSize: 13, fontWeight: "600", color: c.textMuted },
    tabTextActive: { color: isDark ? "#A5B4FC" : "#4338CA" },

    // Lists
    filterRow: { flexDirection: "row", paddingHorizontal: 14, paddingTop: 10 },
    selectPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: input,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    selectPillText: { fontSize: 12, color: c.text, fontWeight: "600" },
    sheetOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border },
    sheetOptionText: { fontSize: 14, color: c.text },
    sheetOptionTextActive: { color: "#4F46E5", fontWeight: "700" },

    userCard: { borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 12, marginBottom: 10, backgroundColor: isDark ? "#1A2436" : "#FFFFFF" },
    userHead: { flexDirection: "row", alignItems: "center", gap: 10 },
    avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
    avatarText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
    userName: { fontSize: 14, fontWeight: "700", color: c.text },
    youText: { fontSize: 11, fontWeight: "600", color: c.textLight },
    userSub: { fontSize: 12, color: c.textMuted, marginTop: 1 },
    userGrid: { marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: c.border },
    switchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.border },
    switchLabel: { fontSize: 13, fontWeight: "600", color: c.text },
    switchHint: { fontSize: 11, color: c.textLight, marginTop: 2 },
    userActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
    actBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: input,
    },
    actPrimary: { backgroundColor: "#4F46E5", borderColor: "#4F46E5" },
    actDanger: { backgroundColor: isDark ? "rgba(239,68,68,0.12)" : "#FEF2F2", borderColor: isDark ? "rgba(239,68,68,0.35)" : "#FECACA" },
    actDangerSolid: { backgroundColor: "#DC2626", borderColor: "#DC2626" },
    actText: { fontSize: 12, fontWeight: "700", color: c.textMuted },
    empty: { alignItems: "center", paddingVertical: 28, gap: 10 },
    emptyText: { fontSize: 13, color: c.textLight, textAlign: "center" },

    pager: { marginTop: 6, gap: 8, alignItems: "center" },
    pageInfo: { fontSize: 12, color: c.textMuted },
    pageBtns: { flexDirection: "row", alignItems: "center", gap: 4 },
    pageBtn: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
    pageNum: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    pageNumIdle: { borderWidth: 1, borderColor: c.border },
    pageNumText: { fontSize: 12, fontWeight: "600", color: c.text },
    pageEllipsis: { paddingHorizontal: 2, fontSize: 12, color: c.textMuted },

    // Majeur box
    majeurBox: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 14 },
    majeurTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
    majeurTitle: { fontSize: 13, fontWeight: "700", flex: 1 },

    // Search
    searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    searchInputWrap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: input,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 12,
    },
    searchInput: { flex: 1, paddingVertical: Platform.OS === "ios" ? 11 : 8, fontSize: 14, color: c.text },
    resultRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: 10,
      marginTop: 8,
      backgroundColor: card,
    },
    resultRowSelected: { borderColor: "#818CF8", backgroundColor: isDark ? "rgba(99,102,241,0.15)" : "#EEF2FF" },
    selectedBox: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border, gap: 4 },
    sheetFooter: { flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: 8, marginTop: 14 },
    fieldLabel: { fontSize: 13, fontWeight: "700", color: c.text, marginBottom: 8 },
    inlineError: { fontSize: 12, color: "#EF4444", marginTop: 8 },
    inlineLoading: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },

    checkRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
    checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: c.grayMid, alignItems: "center", justifyContent: "center" },
    checkboxOn: { backgroundColor: "#4F46E5", borderColor: "#4F46E5" },
    checkboxDanger: { backgroundColor: "#DC2626", borderColor: "#DC2626" },
    radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: c.grayMid, alignItems: "center", justifyContent: "center" },
    radioDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#FFFFFF" },
    checkLabel: { fontSize: 14, color: c.text },
    motifRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 10, marginBottom: 8 },
    motifCode: { fontSize: 12, fontWeight: "700", color: c.text },

    // History
    historyItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
    historyHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    historyTitle: { fontSize: 14, fontWeight: "700", color: c.text, flex: 1 },
    historyLine: { fontSize: 13, color: c.text, marginTop: 6 },

    // Modules
    moduleToolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, paddingHorizontal: 14, paddingTop: 10 },
    moduleBtns: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    smallOutline: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: c.border },
    smallOutlineText: { fontSize: 12, fontWeight: "600", color: c.text },
    smallSolid: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    smallSolidText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },
    moduleItem: { borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 12, marginBottom: 10 },
    moduleHead: { flexDirection: "row", alignItems: "center", gap: 10 },
    moduleIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    moduleTitle: { flex: 1, fontSize: 14, fontWeight: "700", color: c.text },
    moduleMeta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 8 },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
    metaText: { fontSize: 12, color: c.textMuted, flexShrink: 1 },

    // Profile sheet
    profileHead: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.border },
    avatarLg: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
    avatarLgText: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
    profileName: { fontSize: 17, fontWeight: "800", color: c.text },
    profileBody: { paddingTop: 8 },

    // Dialogs
    overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.55)", justifyContent: "center", padding: 16 },
    dialog: { backgroundColor: card, borderRadius: 18, overflow: "hidden", maxHeight: "90%" },
    dialogHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border },
    dialogIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    dialogTitle: { fontSize: 15, fontWeight: "800", color: c.text },
    dialogSub: { fontSize: 12, color: c.textMuted, marginTop: 1 },
    dialogBody: { padding: 16 },
    dialogFooter: {
      flexDirection: "row",
      justifyContent: "flex-end",
      flexWrap: "wrap",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: cardAlt,
    },
    confirmText: { fontSize: 14, color: c.text, lineHeight: 20, marginBottom: 10 },
    input: {
      backgroundColor: input,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: c.text,
    },
    textarea: { height: 96, textAlignVertical: "top" },
    cancelBtn: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: c.border, justifyContent: "center" },
    cancelText: { fontSize: 13, color: c.text, fontWeight: "600" },
    primaryBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12 },
    primaryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
    outlineBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 11,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: card,
    },
    outlineBtnText: { fontSize: 14, fontWeight: "600", color: c.text },
  });
};

export default ClassDetails;
