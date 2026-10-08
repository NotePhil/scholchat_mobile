import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet, LoadingSpinner } from '../../../../components/ui';
import { useThemeColors } from '../../../../styles/theme';
import { useThemeStore } from '../../../../store/useThemeStore';
import { classService } from '../../../../services/classService';
import {
  accederService,
  exerciseProgrammerService,
  exerciseService,
  learningService,
  programmeCoursId,
  programmeCoursTitre,
  userService,
} from '../../../../services/api';
import type { CoursResume } from '../../../../services/api';
import { GENERAL_COURSE_ID, loadClassCourses } from '../../../../utils/classCourses';
import CoursePickerField, {
  CoursParClasseValue,
  classesWithoutCourse,
  countProgrammations,
  toCoursParClasse,
} from './CoursePickerField';
import { translate, useT } from '../../../../i18n';
import { useUser } from '../../../../context/UserContext';
import { ClassEntity, ExerciseProgramme } from '../../../../types';
import { formatDateTime, formatTime, parseServerDate, serverDateMs, toServerDateTime } from '../../../../utils/dates';

// LinearGradient via expo-linear-gradient (safe fallback to View if unavailable)
let LinearGradient: any;
try {
  LinearGradient = require('expo-linear-gradient').LinearGradient;
} catch {
  LinearGradient = ({ children, style, colors: c }: any) => (
    <View style={[style, { backgroundColor: c?.[0] }]}>{children}</View>
  );
}

/** Minimal exercise shape needed by the form (compatible with the parent's local Exercise type). */
export interface ScheduleExerciseOption {
  id: string;
  nom?: string;
  titre?: string;
  niveau?: string;
}

export interface ScheduleExerciseViewProps {
  /** Leave the scheduling page (back to the exercises list). */
  onBack: () => void;
  /**
   * Kept for compatibility with the parent. The web stays on the scheduling
   * list after a successful programmation, so this view does not call it on
   * create/delete (the parent's handler navigates away).
   */
  onScheduled?: () => void;
  /** Seed for the exercise dropdown; the list is refreshed from the API like the web. */
  exercises?: ScheduleExerciseOption[];
  /** Open straight on the create form instead of the list. */
  initialView?: 'list' | 'form';
  /** Pre-filter the list on a class (web: ?classId= query param). */
  initialClassId?: string | null;
}

type TypeAssignation = 'EXERCICE' | 'DEVOIR';

interface ProgItem extends ExerciseProgramme {
  isOwn: boolean;
  programmeParNom?: string;
}

interface FormState {
  exerciseId: string;
  typeAssignation: TypeAssignation;
  classeIds: string[];
  /** Course chosen per selected class: classeId → course id | GENERAL_COURSE_ID (required for every class). */
  coursParClasse: CoursParClasseValue;
  dateExoPrevue: string;
  dateDebutExoEffectif: string;
  dateFinExoEffectif: string;
}

const EMPTY_FORM: FormState = {
  exerciseId: '',
  typeAssignation: 'EXERCICE',
  classeIds: [],
  coursParClasse: {},
  dateExoPrevue: '',
  dateDebutExoEffectif: '',
  dateFinExoEffectif: '',
};

const PAGE_SIZE = 8;

/** Web tints (light) with translucent dark-mode equivalents. */
type Tone = { bg: string; fg: string; border: string; bgDark: string; fgDark: string; borderDark: string };
const TONES: Record<string, Tone> = {
  blue: { bg: '#EFF6FF', fg: '#2563EB', border: '#BFDBFE', bgDark: 'rgba(59,130,246,0.18)', fgDark: '#93C5FD', borderDark: 'rgba(59,130,246,0.35)' },
  purple: { bg: '#F5F3FF', fg: '#7C3AED', border: '#DDD6FE', bgDark: 'rgba(139,92,246,0.18)', fgDark: '#C4B5FD', borderDark: 'rgba(139,92,246,0.35)' },
  green: { bg: '#F0FDF4', fg: '#16A34A', border: '#BBF7D0', bgDark: 'rgba(34,197,94,0.18)', fgDark: '#86EFAC', borderDark: 'rgba(34,197,94,0.35)' },
  amber: { bg: '#FFFBEB', fg: '#D97706', border: '#FDE68A', bgDark: 'rgba(245,158,11,0.15)', fgDark: '#FCD34D', borderDark: 'rgba(245,158,11,0.35)' },
  gray: { bg: '#F9FAFB', fg: '#6B7280', border: '#E5E7EB', bgDark: 'rgba(148,163,184,0.18)', fgDark: '#CBD5E1', borderDark: 'rgba(148,163,184,0.35)' },
  red: { bg: '#FEF2F2', fg: '#991B1B', border: '#FECACA', bgDark: 'rgba(239,68,68,0.15)', fgDark: '#FCA5A5', borderDark: 'rgba(239,68,68,0.35)' },
  redSoft: { bg: '#FEF2F2', fg: '#DC2626', border: '#FEE2E2', bgDark: 'rgba(239,68,68,0.12)', fgDark: '#FCA5A5', borderDark: 'rgba(239,68,68,0.3)' },
  indigo: { bg: '#EEF2FF', fg: '#4338CA', border: '#E0E7FF', bgDark: 'rgba(99,102,241,0.2)', fgDark: '#A5B4FC', borderDark: 'rgba(99,102,241,0.4)' },
  ownAmber: { bg: '#FFFBEB', fg: '#B45309', border: '#FEF3C7', bgDark: 'rgba(245,158,11,0.15)', fgDark: '#FCD34D', borderDark: 'rgba(245,158,11,0.35)' },
  cyan: { bg: '#ECFEFF', fg: '#0E7490', border: '#CFFAFE', bgDark: 'rgba(6,182,212,0.15)', fgDark: '#67E8F9', borderDark: 'rgba(6,182,212,0.35)' },
};

const TYPE_CONFIG: Record<TypeAssignation, { label: string; icon: string; tone: keyof typeof TONES; desc: string }> = {
  EXERCICE: { label: 'Exercice libre', icon: 'book-open', tone: 'blue', desc: 'Auto-corrigé, résultat immédiat' },
  DEVOIR: { label: 'Devoir', icon: 'file-alt', tone: 'purple', desc: 'Correction manuelle du professeur' },
};

const ETAT_CONFIG: Record<string, { label: string; tone: keyof typeof TONES }> = {
  ACTIF: { label: 'Actif', tone: 'green' },
  PUBLIE: { label: 'Publié', tone: 'blue' },
  BROUILLON: { label: 'Brouillon', tone: 'amber' },
  INACTIF: { label: 'Inactif', tone: 'gray' },
  EXPIRE: { label: 'Expiré', tone: 'red' },
};

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'ACTIF', label: 'Actif' },
  { value: 'PUBLIE', label: 'Publié' },
  { value: 'EXPIRE', label: 'Expiré' },
  { value: 'BROUILLON', label: 'Brouillon' },
  { value: 'INACTIF', label: 'Inactif' },
];

const TYPE_FILTER_OPTIONS = [
  { value: '', label: 'Tous les types' },
  { value: 'EXERCICE', label: 'Exercice libre' },
  { value: 'DEVOIR', label: 'Devoir' },
];

const EXO_STATUS_ORDER: Record<string, number> = { EN_COURS: 0, PLANIFIE: 1, ANNULE: 2 };

const fmtDateTime = (d?: string | null) =>
  d
    ? formatDateTime(d, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';
const fmtTime = (d?: string | null) =>
  d ? formatTime(d, { hour: '2-digit', minute: '2-digit' }) : '';

const exoName = (e?: ScheduleExerciseOption) => e?.nom || e?.titre || 'Exercice';
const className = (c: ClassEntity) => c.nom || (c as any).name || (c as any).titre || `Classe ${c.id}`;

/** Effective display status: an active/published programmation whose end date passed shows "Expiré". */
const getEffectiveEtat = (p: ExerciseProgramme) => {
  if ((p.etat === 'ACTIF' || p.etat === 'PUBLIE') && p.dateFinExoEffectif) {
    if (serverDateMs(p.dateFinExoEffectif, NaN) < Date.now()) return 'EXPIRE';
  }
  return p.etat ?? '';
};

/** Mirrors the web antd Form rules. */
const validateForm = (f: FormState): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (!f.exerciseId) errors.exerciseId = 'Sélectionnez un exercice';
  if (!f.typeAssignation) errors.typeAssignation = 'Requis';
  if (f.classeIds.length === 0) errors.classeIds = 'Sélectionnez au moins une classe';
  else if (classesWithoutCourse(f.coursParClasse, f.classeIds).length > 0)
    errors.coursId = translate('learning.schedule.courseRequired');
  if (!f.dateExoPrevue) errors.dateExoPrevue = 'Requis';
  if (!f.dateDebutExoEffectif) errors.dateDebutExoEffectif = 'Requis';
  if (!f.dateFinExoEffectif) errors.dateFinExoEffectif = 'Requis';
  else if (f.dateDebutExoEffectif && !(serverDateMs(f.dateFinExoEffectif, NaN) > serverDateMs(f.dateDebutExoEffectif, NaN))) {
    errors.dateFinExoEffectif = 'Doit être après le début';
  }
  return errors;
};

// ─── Styles hook ─────────────────────────────────────────────────────────────

const useSchedStyles = () => {
  const colors = useThemeColors();
  const isDark = useThemeStore((s) => s.mode === 'dark');
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const tone = useCallback(
    (key: keyof typeof TONES) => {
      const t = TONES[key];
      return isDark ? { bg: t.bgDark, fg: t.fgDark, border: t.borderDark } : { bg: t.bg, fg: t.fg, border: t.border };
    },
    [isDark]
  );
  return { styles, colors, isDark, tone, muted: '#94A3B8' };
};

// ─── Small building blocks ───────────────────────────────────────────────────

const TypeBadge = ({ type }: { type?: string }) => {
  const { styles, tone } = useSchedStyles();
  const c = TYPE_CONFIG[(type as TypeAssignation) ?? 'EXERCICE'] ?? TYPE_CONFIG.EXERCICE;
  const t = tone(c.tone);
  return (
    <View style={[styles.badge, { backgroundColor: t.bg, borderColor: t.border, borderWidth: 1 }]}>
      <FontAwesome5 name={c.icon as any} size={10} color={t.fg} />
      <Text style={[styles.badgeText, { color: t.fg, fontWeight: '700' }]}>{c.label}</Text>
    </View>
  );
};

const EtatBadge = ({ etat }: { etat?: string }) => {
  const { styles, tone } = useSchedStyles();
  const c = ETAT_CONFIG[etat ?? ''] ?? ETAT_CONFIG.INACTIF;
  const t = tone(c.tone);
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.badgeText, { color: t.fg }]}>{c.label}</Text>
    </View>
  );
};

const OptionsSheet = ({
  visible,
  title,
  options,
  value,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  options: { value: string; label: string }[];
  value: string;
  onClose: () => void;
  onSelect: (v: string) => void;
}) => {
  const { styles } = useSchedStyles();
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
        {options.length === 0 ? <Text style={styles.sheetEmpty}>Aucune option disponible</Text> : null}
        {options.map((opt) => (
          <TouchableOpacity key={opt.value} style={styles.sheetOption} onPress={() => onSelect(opt.value)}>
            <Text style={[styles.sheetOptionText, opt.value === value && styles.sheetOptionTextActive]}>{opt.label}</Text>
            {opt.value === value ? <FontAwesome5 name="check" size={13} color="#4F46E5" /> : null}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </BottomSheet>
  );
};

/** Compact select pill (web's small toolbar <select>) opening a bottom sheet. */
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
  const { styles, muted } = useSchedStyles();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) ?? options[0];
  return (
    <>
      <TouchableOpacity style={[styles.selectPill, { flex: 1 }]} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <FontAwesome5 name={icon as any} size={11} color={muted} />
        <Text style={styles.selectPillText} numberOfLines={1}>
          {selected?.label}
        </Text>
        <FontAwesome5 name="filter" size={10} color={muted} />
      </TouchableOpacity>
      <OptionsSheet
        visible={open}
        title={title}
        options={options}
        value={value}
        onClose={() => setOpen(false)}
        onSelect={(v) => {
          onChange(v);
          setOpen(false);
        }}
      />
    </>
  );
};

const FieldLabel = ({ text }: { text: string }) => {
  const { styles } = useSchedStyles();
  return (
    <View style={styles.labelRow}>
      <Text style={styles.required}>*</Text>
      <Text style={styles.label}>{text}</Text>
    </View>
  );
};

const FieldError = ({ message }: { message?: string }) => {
  const { styles } = useSchedStyles();
  if (!message) return null;
  return <Text style={styles.fieldErrorText}>{message}</Text>;
};

/** Native replacement for antd's DatePicker showTime (value is an ISO string, '' when empty). */
const DateTimeInput = ({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  error?: string;
}) => {
  const { styles, muted } = useSchedStyles();
  const [stage, setStage] = useState<'none' | 'date' | 'time' | 'ios'>('none');
  const [pending, setPending] = useState<Date>(new Date());
  const current = parseServerDate(value);

  const open = () => {
    setPending(current ?? new Date());
    setStage(Platform.OS === 'ios' ? 'ios' : 'date');
  };

  // Android only offers separate date/time dialogs, so that platform needs two stages.
  const onAndroidDate = (event: any, selected?: Date) => {
    setStage('none');
    if (event.type === 'dismissed' || !selected) return;
    const merged = new Date(selected);
    merged.setHours(pending.getHours(), pending.getMinutes(), 0, 0);
    setPending(merged);
    setStage('time');
  };

  const onAndroidTime = (event: any, selected?: Date) => {
    setStage('none');
    if (event.type === 'dismissed' || !selected) return;
    const merged = new Date(pending);
    merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    onChange(merged.toISOString());
  };

  return (
    <View style={styles.field}>
      <FieldLabel text={label} />
      <TouchableOpacity style={[styles.input, styles.inputRow, error && styles.inputError]} onPress={open} activeOpacity={0.8}>
        <Text style={[styles.inputText, !current && styles.placeholder]} numberOfLines={1}>
          {current ? `${current.toLocaleDateString('fr-FR')} ${fmtTime(value)}` : 'JJ/MM/AAAA HH:mm'}
        </Text>
        {current ? (
          <TouchableOpacity onPress={() => onChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <FontAwesome5 name="times-circle" size={14} color={muted} />
          </TouchableOpacity>
        ) : (
          <FontAwesome5 name="calendar-alt" size={14} color={muted} />
        )}
      </TouchableOpacity>
      <FieldError message={error} />

      {stage === 'date' && <DateTimePicker value={pending} mode="date" display="default" onChange={onAndroidDate} />}
      {stage === 'time' && <DateTimePicker value={pending} mode="time" display="default" onChange={onAndroidTime} />}
      {Platform.OS === 'ios' ? (
        <BottomSheet visible={stage === 'ios'} onClose={() => setStage('none')} title={label}>
          <DateTimePicker
            value={pending}
            mode="datetime"
            display="inline"
            onChange={(_e: any, d?: Date) => d && setPending(d)}
          />
          <TouchableOpacity
            onPress={() => {
              onChange(pending.toISOString());
              setStage('none');
            }}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#7C3AED', '#DB2777']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Valider</Text>
            </LinearGradient>
          </TouchableOpacity>
        </BottomSheet>
      ) : null}
    </View>
  );
};

/** Web's Popconfirm, as a centered confirmation dialog. */
const ConfirmDialog = ({
  visible,
  busy,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) => {
  const { styles, tone } = useSchedStyles();
  const red = tone('redSoft');
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.dialogOverlay}>
        <View style={styles.dialogCard}>
          <View style={[styles.dialogIcon, { backgroundColor: red.bg }]}>
            <FontAwesome5 name="trash-alt" size={20} color="#DC2626" />
          </View>
          <Text style={styles.dialogTitle}>Supprimer cette programmation ?</Text>
          <View style={styles.dialogActions}>
            <TouchableOpacity style={styles.dialogCancel} onPress={onCancel} disabled={busy}>
              <Text style={styles.dialogCancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.dialogConfirm, busy && { opacity: 0.5 }]} onPress={onConfirm} disabled={busy}>
              {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
              <Text style={styles.dialogConfirmText}>Supprimer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── Screen ──────────────────────────────────────────────────────────────────

/**
 * Port of the web's "schedule-exercise" tab (ExerciseProgrammerContent).
 * List view: gradient header with stats, filters + action bar, paginated list
 * of programmations (own + other professors' in shared classes), detail sheet,
 * delete confirmation. Form view: "Nouvelle programmation" with the same fields,
 * validation and payload as the web (programmer-et-diffuser).
 */
export const ScheduleExerciseView = ({
  onBack,
  exercises: exercisesProp = [],
  initialView = 'list',
  initialClassId = null,
}: ScheduleExerciseViewProps) => {
  const { styles, tone, muted, isDark } = useSchedStyles();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const userId = user?.userId ?? '';

  // ── data ──
  const [exercises, setExercises] = useState<ScheduleExerciseOption[]>(exercisesProp);
  const [programmations, setProgrammations] = useState<ProgItem[]>([]);
  const [classes, setClasses] = useState<ClassEntity[]>([]);

  // ── loading ──
  const [loading, setLoading] = useState(true);
  const [progsLoading, setProgsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── UI ──
  const [view, setView] = useState<'list' | 'form'>(initialView);
  const [detailProg, setDetailProg] = useState<ProgItem | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [filterClassId, setFilterClassId] = useState(initialClassId ?? '');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showPast, setShowPast] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // ── form ──
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [exoSheetOpen, setExoSheetOpen] = useState(false);
  const [exoSearch, setExoSearch] = useState('');
  const [typeSheetOpen, setTypeSheetOpen] = useState(false);
  const [classSheetOpen, setClassSheetOpen] = useState(false);
  const { t } = useT();

  // ── course of the programmed exercise ──
  // Courses programmed in a class (GET /classes/{id}/cours-programmes/resume, fallback by-classe), cached per class.
  const courseCache = useRef<Record<string, CoursResume[]>>({});
  /** Courses programmed in EVERY given class (the backend checks the course against each class). */
  const loadCommonCourses = useCallback(async (classIds: string[]): Promise<CoursResume[]> => {
    const lists = await Promise.all(
      classIds.map(async (id) => {
        if (courseCache.current[id]) return courseCache.current[id];
        const { courses } = await loadClassCourses(id);
        courseCache.current[id] = courses;
        return courses;
      })
    );
    if (lists.length === 0) return [];
    const [first, ...rest] = lists;
    return first.filter((c) => rest.every((l) => l.some((x) => x.coursId === c.coursId)));
  }, []);

  // Changing the course of an existing programmation (PATCH).
  const [courseEdit, setCourseEdit] = useState<{
    prog: ProgItem;
    status: 'loading' | 'ready' | 'error';
    list: CoursResume[];
    saving: string | null;
    error: string;
  } | null>(null);
  const openCourseEdit = async (prog: ProgItem) => {
    const ids = (prog.classesDiffusees ?? []).map((c) => String(c.id)).filter(Boolean);
    const classIds = ids.length ? ids : (prog.classeIds ?? []).map(String);
    setCourseEdit({ prog, status: 'loading', list: [], saving: null, error: '' });
    try {
      const list = await loadCommonCourses(classIds);
      setCourseEdit((prev) => (prev && prev.prog.id === prog.id ? { ...prev, status: 'ready', list } : prev));
    } catch {
      setCourseEdit((prev) => (prev && prev.prog.id === prog.id ? { ...prev, status: 'error' } : prev));
    }
  };
  const applyCourseEdit = async (coursId: string | null) => {
    if (!courseEdit || courseEdit.saving) return;
    const { prog } = courseEdit;
    if ((programmeCoursId(prog) ?? null) === coursId) {
      setCourseEdit(null);
      return;
    }
    setCourseEdit({ ...courseEdit, saving: coursId ?? GENERAL_COURSE_ID, error: '' });
    try {
      const updated = await learningService.setExerciseCourse(prog.id, coursId);
      const titre = coursId ? courseEdit.list.find((c) => c.coursId === coursId)?.titre ?? null : null;
      setProgrammations((prev) =>
        prev.map((p) =>
          p.id === prog.id
            ? {
                ...p,
                ...(updated && typeof updated === 'object' ? updated : {}),
                isOwn: p.isOwn,
                programmeParNom: p.programmeParNom,
                coursId,
                coursTitre: (updated as any)?.coursTitre ?? titre,
                coursIds: coursId ? [coursId] : [],
                coursLies: undefined,
              }
            : p
        )
      );
      setCourseEdit(null);
      setSuccess(t('learning.schedule.courseChanged'));
    } catch (e) {
      setCourseEdit((prev) =>
        prev ? { ...prev, saving: null, error: e instanceof Error && e.message ? e.message : t('learning.errors.setCourse') } : prev
      );
    }
  };
  const courseLabel = (p: ExerciseProgramme) => programmeCoursTitre(p) || (programmeCoursId(p) ? t('learning.course') : t('learning.generalExercises'));

  useEffect(() => {
    if (initialClassId) setFilterClassId(initialClassId);
  }, [initialClassId]);

  /** Web's obtenirClassesUtilisateur: classes with publication rights ∪ classes with access. */
  const fetchClasses = useCallback(async (): Promise<ClassEntity[]> => {
    const [pubRes, accRes] = await Promise.allSettled([
      classService.getClassesWithPublicationRights(userId),
      accederService.getAccessibleClasses(userId),
    ]);
    const map = new Map<string, ClassEntity>();
    [
      ...(pubRes.status === 'fulfilled' ? pubRes.value || [] : []),
      ...(accRes.status === 'fulfilled' ? accRes.value || [] : []),
    ].forEach((c) => {
      if (c?.id && !map.has(String(c.id))) map.set(String(c.id), c);
    });
    return Array.from(map.values());
  }, [userId]);

  // ── web: load() — exercises + classes for the form dropdowns ──
  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [exos, cls] = await Promise.all([
        exerciseService.getByProfessor(userId).catch(() => null),
        fetchClasses(),
      ]);
      if (exos) setExercises(exos as ScheduleExerciseOption[]);
      setClasses(cls);
    } catch {
      setError('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [userId, fetchClasses]);

  // ── web: loadProgs() — own + every accessible class's programmations ──
  const loadProgs = useCallback(async () => {
    if (!userId) return;
    setProgsLoading(true);
    try {
      const allClasses = await fetchClasses();
      const [ownResult, ...classResults] = await Promise.allSettled([
        exerciseProgrammerService.getByProfessor(userId),
        ...allClasses.map((c) => exerciseProgrammerService.getByClasse(c.id)),
      ]);
      const ownItems = ownResult.status === 'fulfilled' ? ownResult.value || [] : [];
      const classItems = classResults
        .filter((r): r is PromiseFulfilledResult<ExerciseProgramme[]> => r.status === 'fulfilled')
        .flatMap((r) => r.value || []);

      // Merge by programmer record id — class items first so other professors' entries are included.
      const merged = new Map<string, ProgItem>();
      [...classItems, ...ownItems].forEach((p) => {
        if (p?.id) merged.set(String(p.id), { ...p, isOwn: String(p.programmeParId) === String(userId) });
      });

      // Resolve professor names for non-own records.
      const nonOwnIds = [
        ...new Set(
          Array.from(merged.values())
            .filter((p) => !p.isOwn && p.programmeParId)
            .map((p) => String(p.programmeParId))
        ),
      ];
      const professorNames: Record<string, string> = {};
      await Promise.allSettled(
        nonOwnIds.map(async (profId) => {
          try {
            const u: any = await userService.getUserById(profId);
            if (u) professorNames[profId] = `${u.prenom || ''} ${u.nom || ''}`.trim() || u.email || profId;
          } catch {
            /* ignore */
          }
        })
      );
      merged.forEach((p, key) => {
        if (!p.isOwn && p.programmeParId) {
          merged.set(key, { ...p, programmeParNom: professorNames[String(p.programmeParId)] || undefined });
        }
      });

      const sorted = Array.from(merged.values()).sort((a, b) => {
        const oa = EXO_STATUS_ORDER[a.etatExoProgramme as string] ?? 3;
        const ob = EXO_STATUS_ORDER[b.etatExoProgramme as string] ?? 3;
        // Within the same status, the most imminent session first.
        return oa !== ob
          ? oa - ob
          : serverDateMs(a.dateExoPrevue ?? 0) - serverDateMs(b.dateExoPrevue ?? 0);
      });
      setProgrammations(sorted);
    } catch {
      setError('Impossible de charger les programmations');
    } finally {
      setProgsLoading(false);
    }
  }, [userId, fetchClasses]);

  useEffect(() => {
    load();
    loadProgs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Auto-clear messages.
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 4000);
    return () => clearTimeout(t);
  }, [success]);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 8000);
    return () => clearTimeout(t);
  }, [error]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProgs();
    setRefreshing(false);
  };

  // ── form helpers ──
  const openForm = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setSubmitError('');
    setView('form');
  };
  const closeForm = () => {
    setView('list');
    setForm(EMPTY_FORM);
    setErrors({});
    setSubmitError('');
  };
  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  // ── web: handleSubmit ──
  const handleSubmit = async () => {
    setSubmitError('');
    const errs = validateForm(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    if (!userId) {
      setSubmitError('Utilisateur non connecté');
      return;
    }
    setSubmitting(true);
    try {
      const created = await exerciseProgrammerService.programmerEtDiffuser({
        exerciseId: form.exerciseId,
        programmeParId: userId,
        typeAssignation: form.typeAssignation,
        dateExoPrevue: toServerDateTime(form.dateExoPrevue) ?? undefined,
        dateDebutExoEffectif: toServerDateTime(form.dateDebutExoEffectif) ?? undefined,
        dateFinExoEffectif: toServerDateTime(form.dateFinExoEffectif) ?? undefined,
        classeIds: form.classeIds,
        coursParClasse: toCoursParClasse(form.coursParClasse, form.classeIds),
        etat: 'ACTIF',
      });
      const n = countProgrammations(created);
      setSuccess(
        n > 1
          ? `Exercice programmé et diffusé : ${t('learning.schedule.createdMany', { count: n })}`
          : 'Exercice programmé et diffusé avec succès !'
      );
      setForm(EMPTY_FORM);
      await loadProgs();
      setView('list');
    } catch (e) {
      setSubmitError(e instanceof Error && e.message ? e.message : 'Erreur lors de la programmation');
    } finally {
      setSubmitting(false);
    }
  };

  // ── web: handleDelete ──
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await exerciseProgrammerService.remove(id);
      setSuccess('Programmation supprimée');
      setProgrammations((prev) => prev.filter((p) => p.id !== id));
    } catch {
      setError('Erreur lors de la suppression');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  // ── filtered list ──
  const filtered = useMemo(() => {
    const now = new Date();
    const q = searchTerm.toLowerCase();
    return programmations.filter((prog) => {
      const matchClass =
        !filterClassId ||
        (Array.isArray(prog.classesDiffusees) && prog.classesDiffusees.some((c) => String(c.id) === String(filterClassId)));
      const matchSearch = !searchTerm || (prog.nom || '').toLowerCase().includes(q);
      const matchStatus = !filterStatus || getEffectiveEtat(prog) === filterStatus;
      const matchType = !filterType || prog.typeAssignation === filterType;
      // Hidden by default: sessions whose scheduled time has passed and aren't in progress.
      const matchTiming =
        showPast || prog.etatExoProgramme === 'EN_COURS' || !prog.dateExoPrevue || serverDateMs(prog.dateExoPrevue, NaN) >= now.getTime();
      return matchClass && matchSearch && matchStatus && matchType && matchTiming;
    });
  }, [programmations, filterClassId, searchTerm, filterStatus, filterType, showPast]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const withPageReset = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setCurrentPage(1);
  };

  // ── stats (on the full list) ──
  const stats = useMemo(
    () => [
      { label: 'Total', value: programmations.length, color: '#93C5FD' },
      {
        label: 'Actifs',
        value: programmations.filter((p) => ['ACTIF', 'PUBLIE'].includes(getEffectiveEtat(p))).length,
        color: '#86EFAC',
      },
      { label: 'Libres', value: programmations.filter((p) => p.typeAssignation === 'EXERCICE').length, color: '#67E8F9' },
      { label: 'Devoirs', value: programmations.filter((p) => p.typeAssignation === 'DEVOIR').length, color: '#C4B5FD' },
    ],
    [programmations]
  );

  const selectedClassName = filterClassId
    ? (() => {
        const c = classes.find((x) => String(x.id) === String(filterClassId));
        return c ? className(c) : '';
      })()
    : '';
  const hasFilters = !!(filterStatus || filterType || filterClassId || searchTerm);
  const scrollContent = [styles.scrollContent, { paddingBottom: insets.bottom + 150 }];

  // ── render pieces ──
  const renderBanners = () => (
    <>
      {success ? (
        <View style={[styles.banner, styles.bannerSuccess]}>
          <FontAwesome5 name="check-circle" size={14} color="#22C55E" solid />
          <Text style={[styles.bannerText, { color: isDark ? '#86EFAC' : '#15803D' }]}>{success}</Text>
          <TouchableOpacity onPress={() => setSuccess('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <FontAwesome5 name="times" size={12} color="#4ADE80" />
          </TouchableOpacity>
        </View>
      ) : null}
      {error ? (
        <View style={[styles.banner, styles.bannerError]}>
          <FontAwesome5 name="exclamation-circle" size={14} color="#EF4444" />
          <Text style={[styles.bannerText, { color: isDark ? '#FCA5A5' : '#B91C1C' }]}>{error}</Text>
          <TouchableOpacity onPress={() => setError('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <FontAwesome5 name="times" size={12} color="#F87171" />
          </TouchableOpacity>
        </View>
      ) : null}
    </>
  );

  const renderListHeader = () => (
    <LinearGradient colors={['#2563EB', '#4338CA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.heroCard}>
      <View style={styles.heroRow}>
        <TouchableOpacity style={styles.heroBack} onPress={onBack} accessibilityLabel="Retour">
          <FontAwesome5 name="arrow-left" size={13} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.heroIcon}>
          <FontAwesome5 name="calendar-alt" size={16} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.heroTitle} numberOfLines={1}>
            Programmer les Exercices
          </Text>
          <Text style={[styles.heroSubtitle, { color: '#DBEAFE' }]} numberOfLines={2}>
            {selectedClassName ? `Classe : ${selectedClassName}` : 'Assignez vos exercices aux classes avec dates et type'}
          </Text>
        </View>
      </View>
      <View style={styles.heroStats}>
        {stats.map((s) => (
          <View key={s.label} style={styles.heroStat}>
            <Text style={[styles.heroStatValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.heroStatLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
    </LinearGradient>
  );

  const renderToolbar = () => {
    const resetTone = tone('redSoft');
    return (
      <View style={styles.toolbar}>
        {/* Search + refresh */}
        <View style={styles.toolbarRow}>
          <View style={styles.searchBox}>
            <FontAwesome5 name="search" size={12} color={muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher par nom d'exercice..."
              placeholderTextColor="#94A3B8"
              value={searchTerm}
              onChangeText={withPageReset(setSearchTerm)}
            />
            {searchTerm.length > 0 ? (
              <TouchableOpacity onPress={() => withPageReset(setSearchTerm)('')}>
                <FontAwesome5 name="times-circle" size={13} color={muted} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={loadProgs} disabled={progsLoading} accessibilityLabel="Actualiser">
            {progsLoading ? <ActivityIndicator size="small" color="#64748B" /> : <FontAwesome5 name="sync-alt" size={14} color="#64748B" />}
          </TouchableOpacity>
        </View>

        {/* New programmation */}
        <TouchableOpacity onPress={openForm} activeOpacity={0.85}>
          <LinearGradient colors={['#7C3AED', '#DB2777']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.newBtn}>
            <FontAwesome5 name="plus" size={13} color="#FFFFFF" />
            <Text style={styles.newBtnText}>Programmer un exercice</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Class + status + type filters, past toggle */}
        <View style={styles.toolbarRow}>
          <SelectPill
            icon="users"
            title="Classe"
            value={filterClassId}
            options={[{ value: '', label: 'Toutes les classes' }, ...classes.map((c) => ({ value: String(c.id), label: className(c) }))]}
            onChange={withPageReset(setFilterClassId)}
          />
          <SelectPill
            icon="check-circle"
            title="Statut"
            value={filterStatus}
            options={STATUS_FILTER_OPTIONS}
            onChange={withPageReset(setFilterStatus)}
          />
        </View>
        <View style={styles.toolbarRow}>
          <SelectPill icon="book-open" title="Type" value={filterType} options={TYPE_FILTER_OPTIONS} onChange={withPageReset(setFilterType)} />
          <TouchableOpacity style={styles.pastToggle} onPress={() => setShowPast((v) => !v)} activeOpacity={0.8}>
            <View style={[styles.checkbox, showPast && styles.checkboxOn]}>
              {showPast ? <FontAwesome5 name="check" size={8} color="#FFFFFF" /> : null}
            </View>
            <Text style={styles.pastToggleText} numberOfLines={1}>
              Inclure les passés
            </Text>
          </TouchableOpacity>
        </View>
        {hasFilters ? (
          <TouchableOpacity
            style={[styles.resetBtn, { backgroundColor: resetTone.bg, borderColor: resetTone.border }]}
            onPress={() => {
              setFilterStatus('');
              setFilterType('');
              setFilterClassId('');
              setSearchTerm('');
              setCurrentPage(1);
            }}
          >
            <FontAwesome5 name="exclamation-circle" size={11} color={resetTone.fg} />
            <Text style={[styles.resetBtnText, { color: resetTone.fg }]}>Réinitialiser les filtres</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  const renderRow = (prog: ProgItem, idx: number) => {
    const exo = exercises.find((e) => String(e.id) === String(prog.exerciseId));
    const isDevoir = prog.typeAssignation === 'DEVOIR';
    const iconTone = tone(isDevoir ? 'purple' : 'blue');
    const own = tone(prog.isOwn ? 'indigo' : 'ownAmber');
    const cyan = tone('cyan');
    const deleting = deletingId === prog.id;
    return (
      <View key={prog.id} style={[styles.row, idx > 0 && styles.rowBorder]}>
        <View style={styles.rowTop}>
          <View style={[styles.rowIcon, { backgroundColor: iconTone.bg }]}>
            <FontAwesome5 name={isDevoir ? 'file-alt' : 'book-open'} size={16} color={iconTone.fg} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.rowTitle} numberOfLines={2}>
              {prog.nom || exo?.nom || 'Exercice'}
            </Text>
            <View style={styles.badgeWrap}>
              <TypeBadge type={prog.typeAssignation} />
              <EtatBadge etat={getEffectiveEtat(prog)} />
              <View style={[styles.badge, { backgroundColor: own.bg, borderColor: own.border, borderWidth: 1 }]}>
                <FontAwesome5 name={prog.isOwn ? 'check-circle' : 'users'} size={9} color={own.fg} />
                <Text style={[styles.badgeText, { color: own.fg, fontWeight: '700' }]}>
                  {prog.isOwn ? 'Votre programmation' : 'Autre professeur'}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.rowActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setDetailProg(prog)} accessibilityLabel="Détail">
              <FontAwesome5 name="eye" size={14} color={muted} />
            </TouchableOpacity>
            {prog.isOwn ? (
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => setConfirmDeleteId(prog.id)}
                disabled={deleting}
                accessibilityLabel="Supprimer"
              >
                {deleting ? <ActivityIndicator size="small" color="#F87171" /> : <FontAwesome5 name="trash-alt" size={14} color={muted} />}
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={styles.rowMeta}>
          <View style={styles.metaRow}>
            <FontAwesome5 name="clock" size={10} color={muted} />
            <Text style={styles.metaText}>{fmtDateTime(prog.dateDebutExoEffectif)}</Text>
          </View>
          <FontAwesome5 name="chevron-right" size={9} color={isDark ? '#475569' : '#D1D5DB'} />
          <Text style={styles.metaText}>{fmtDateTime(prog.dateFinExoEffectif)}</Text>
        </View>

        <View style={styles.classChips}>
          <FontAwesome5 name="book" size={10} color={muted} />
          <View
            style={[
              styles.classChip,
              programmeCoursId(prog)
                ? { backgroundColor: tone('indigo').bg, borderColor: tone('indigo').border }
                : { backgroundColor: tone('gray').bg, borderColor: tone('gray').border },
            ]}
          >
            <Text style={[styles.classChipText, { color: programmeCoursId(prog) ? tone('indigo').fg : tone('gray').fg }]} numberOfLines={1}>
              {courseLabel(prog)}
            </Text>
          </View>
          {prog.isOwn ? (
            <TouchableOpacity onPress={() => openCourseEdit(prog)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel={t('learning.schedule.changeCourse')}>
              <Text style={styles.linkText}>{t('learning.schedule.changeCourse')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {prog.classesDiffusees && prog.classesDiffusees.length > 0 ? (
          <View style={styles.classChips}>
            <FontAwesome5 name="users" size={10} color={muted} />
            {prog.classesDiffusees.map((c) => (
              <View key={c.id} style={[styles.classChip, { backgroundColor: cyan.bg, borderColor: cyan.border }]}>
                <Text style={[styles.classChipText, { color: cyan.fg }]}>{c.nom}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  const renderPagination = () => {
    if (progsLoading || filtered.length <= PAGE_SIZE) return null;
    const items = Array.from({ length: totalPages }, (_, i) => i + 1)
      .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
      .reduce<(number | string)[]>((acc, p, i, arr) => {
        if (i > 0 && p - arr[i - 1] > 1) acc.push('…');
        acc.push(p);
        return acc;
      }, []);
    return (
      <View style={styles.pagination}>
        <Text style={styles.paginationInfo}>
          {filtered.length} résultat{filtered.length !== 1 ? 's' : ''} · page {safePage}/{totalPages}
        </Text>
        <View style={styles.pageBtns}>
          <TouchableOpacity
            style={[styles.pageBtn, safePage === 1 && { opacity: 0.4 }]}
            disabled={safePage === 1}
            onPress={() => setCurrentPage(Math.max(1, safePage - 1))}
          >
            <FontAwesome5 name="chevron-left" size={10} color={styles.pageBtnText.color as string} />
          </TouchableOpacity>
          {items.map((p, i) =>
            p === '…' ? (
              <Text key={`e${i}`} style={styles.pageEllipsis}>
                …
              </Text>
            ) : (
              <TouchableOpacity
                key={p}
                style={[styles.pageBtn, p === safePage && styles.pageBtnActive]}
                onPress={() => setCurrentPage(p as number)}
              >
                <Text style={[styles.pageBtnText, p === safePage && { color: '#FFFFFF' }]}>{p}</Text>
              </TouchableOpacity>
            )
          )}
          <TouchableOpacity
            style={[styles.pageBtn, safePage === totalPages && { opacity: 0.4 }]}
            disabled={safePage === totalPages}
            onPress={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
          >
            <FontAwesome5 name="chevron-right" size={10} color={styles.pageBtnText.color as string} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderList = () => {
    const indigo = tone('indigo');
    return (
      <View style={styles.listCard}>
        <View style={styles.listHeader}>
          <FontAwesome5 name="clipboard-list" size={14} color="#2563EB" />
          <Text style={styles.listTitle}>Programmations</Text>
          <View style={[styles.countBadge, { backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : '#DBEAFE' }]}>
            <Text style={[styles.countBadgeText, { color: isDark ? '#93C5FD' : '#2563EB' }]}>{filtered.length}</Text>
          </View>
          {filtered.length !== programmations.length ? <Text style={styles.metaText}>sur {programmations.length}</Text> : null}
          {filterClassId && selectedClassName ? (
            <View style={[styles.badge, { backgroundColor: indigo.bg, borderColor: indigo.border, borderWidth: 1 }]}>
              <Text style={[styles.badgeText, { color: indigo.fg }]} numberOfLines={1}>
                {selectedClassName}
              </Text>
            </View>
          ) : null}
          {filterStatus ? <EtatBadge etat={filterStatus} /> : null}
          {filterType ? <TypeBadge type={filterType} /> : null}
        </View>

        {progsLoading ? (
          <View style={{ paddingVertical: 36 }}>
            <ActivityIndicator size="small" color="#2563EB" />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <FontAwesome5 name="calendar-alt" size={34} color={isDark ? '#475569' : '#D1D5DB'} />
            <Text style={styles.emptyTitle}>
              {filterClassId ? 'Aucune programmation pour cette classe' : 'Aucune programmation'}
            </Text>
            <Text style={styles.emptyText}>Appuyez sur « Programmer un exercice » pour commencer</Text>
          </View>
        ) : (
          paged.map(renderRow)
        )}
        {renderPagination()}
      </View>
    );
  };

  /** Course options (shared by the form picker and the "change course" sheet). */
  const renderCourseOptions = (
    status: 'idle' | 'loading' | 'ready' | 'error',
    list: CoursResume[],
    value: string,
    onSelect: (id: string) => void,
    onRetry: () => void,
    savingId?: string | null
  ) => {
    if (status === 'loading' && list.length === 0) {
      return (
        <View style={{ paddingVertical: 24, alignItems: 'center', gap: 8 }}>
          <ActivityIndicator size="small" color="#4F46E5" />
          <Text style={styles.metaText}>{t('learning.schedule.loadingCourses')}</Text>
        </View>
      );
    }
    const options = [
      ...(status === 'error'
        ? []
        : list.map((c) => ({ id: c.coursId, label: c.titre || t('learning.course'), sub: c.matiere, icon: 'book' }))),
      { id: GENERAL_COURSE_ID, label: t('learning.schedule.generalOption'), sub: t('learning.schedule.generalHint'), icon: 'layer-group' },
    ];
    return (
      <>
        {status === 'error' ? (
          <TouchableOpacity style={[styles.sheetOption, { gap: 8 }]} onPress={onRetry}>
            <FontAwesome5 name="exclamation-triangle" size={13} color="#EF4444" />
            <Text style={[styles.metaText, { flex: 1 }]}>{t('learning.errors.courses')}</Text>
            <Text style={styles.linkText}>{t('classDetails.retry')}</Text>
          </TouchableOpacity>
        ) : list.length === 0 ? (
          <Text style={styles.sheetEmpty}>{t('learning.schedule.noCourses')}</Text>
        ) : null}
        {options.map((o) => {
          const on = o.id === value;
          return (
            <TouchableOpacity key={o.id} style={[styles.sheetOption, { gap: 10 }]} onPress={() => onSelect(o.id)} disabled={!!savingId}>
              <FontAwesome5 name={o.icon as any} size={13} color={on ? '#4F46E5' : muted} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.sheetOptionText, on && styles.sheetOptionTextActive]} numberOfLines={2}>
                  {o.label}
                </Text>
                {o.sub ? <Text style={styles.metaText} numberOfLines={1}>{o.sub}</Text> : null}
              </View>
              {savingId === o.id ? (
                <ActivityIndicator size="small" color="#4F46E5" />
              ) : on ? (
                <FontAwesome5 name="check" size={13} color="#4F46E5" />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </>
    );
  };

  // ── form view ──
  const renderForm = () => {
    const selectedExo = exercises.find((e) => String(e.id) === String(form.exerciseId));
    const q = exoSearch.trim().toLowerCase();
    const exoOptions = exercises.filter((e) => !q || exoName(e).toLowerCase().includes(q));
    const typeCfg = TYPE_CONFIG[form.typeAssignation];
    const typeTone = tone(typeCfg.tone);
    const selectedClasses = form.classeIds
      .map((id) => classes.find((c) => String(c.id) === id))
      .filter(Boolean) as ClassEntity[];
    const indigo = tone('indigo');

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <LinearGradient colors={['#9333EA', '#DB2777']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.heroCard}>
          <View style={styles.heroRow}>
            <TouchableOpacity style={styles.heroBackLabel} onPress={closeForm}>
              <FontAwesome5 name="arrow-left" size={12} color="#FFFFFF" />
              <Text style={styles.heroBackText}>Retour</Text>
            </TouchableOpacity>
            <View style={styles.heroIcon}>
              <FontAwesome5 name="plus" size={14} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.heroTitle} numberOfLines={1}>
                Nouvelle programmation
              </Text>
              <Text style={[styles.heroSubtitle, { color: '#F3E8FF' }]} numberOfLines={2}>
                Assignez un exercice à vos classes avec dates et type
              </Text>
            </View>
          </View>
        </LinearGradient>

        {submitError ? (
          <View style={[styles.banner, styles.bannerError]}>
            <FontAwesome5 name="exclamation-circle" size={14} color="#EF4444" />
            <Text style={[styles.bannerText, { color: isDark ? '#FCA5A5' : '#B91C1C' }]}>{submitError}</Text>
          </View>
        ) : null}

        <View style={styles.formCard}>
          <View style={styles.formCardHeader}>
            <FontAwesome5 name="clipboard-list" size={14} color="#9333EA" />
            <Text style={styles.listTitle}>Détails de la programmation</Text>
          </View>

          <View style={styles.formBody}>
            {/* Exercice */}
            <View style={styles.field}>
              <FieldLabel text="Exercice" />
              <TouchableOpacity
                style={[styles.input, styles.inputRow, errors.exerciseId && styles.inputError]}
                onPress={() => {
                  setExoSearch('');
                  setExoSheetOpen(true);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.inputText, !selectedExo && styles.placeholder]} numberOfLines={1}>
                  {selectedExo ? exoName(selectedExo) : 'Choisir un exercice'}
                </Text>
                {selectedExo?.niveau ? <Text style={styles.inputAside}>{selectedExo.niveau}</Text> : null}
                <FontAwesome5 name="chevron-down" size={12} color={muted} />
              </TouchableOpacity>
              <FieldError message={errors.exerciseId} />
            </View>

            {/* Type d'assignation */}
            <View style={styles.field}>
              <FieldLabel text="Type d'assignation" />
              <TouchableOpacity style={[styles.input, styles.inputRow]} onPress={() => setTypeSheetOpen(true)} activeOpacity={0.8}>
                <FontAwesome5 name={typeCfg.icon as any} size={14} color={typeTone.fg} />
                <Text style={styles.inputText} numberOfLines={1}>
                  {typeCfg.label}
                </Text>
                <FontAwesome5 name="chevron-down" size={12} color={muted} />
              </TouchableOpacity>
              <FieldError message={errors.typeAssignation} />
            </View>

            {/* Classes (multiple) */}
            <View style={styles.field}>
              <FieldLabel text="Classes" />
              <TouchableOpacity
                style={[styles.input, styles.inputRow, errors.classeIds && styles.inputError]}
                onPress={() => setClassSheetOpen(true)}
                activeOpacity={0.8}
              >
                <Text style={[styles.inputText, selectedClasses.length === 0 && styles.placeholder]} numberOfLines={1}>
                  {selectedClasses.length === 0
                    ? 'Sélectionner les classes'
                    : `${selectedClasses.length} classe${selectedClasses.length > 1 ? 's' : ''} sélectionnée${selectedClasses.length > 1 ? 's' : ''}`}
                </Text>
                <FontAwesome5 name="chevron-down" size={12} color={muted} />
              </TouchableOpacity>
              {selectedClasses.length > 0 ? (
                <View style={styles.selectedChips}>
                  {selectedClasses.map((c) => (
                    <View key={c.id} style={[styles.selectedChip, { backgroundColor: indigo.bg, borderColor: indigo.border }]}>
                      <Text style={[styles.selectedChipText, { color: indigo.fg }]} numberOfLines={1}>
                        {className(c)}
                      </Text>
                      <TouchableOpacity
                        onPress={() => setField('classeIds', form.classeIds.filter((id) => id !== String(c.id)))}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <FontAwesome5 name="times" size={10} color={indigo.fg} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : null}
              <FieldError message={errors.classeIds} />
            </View>

            {/* Cours: one per selected class (a course programmed in that class, or a general exercise) */}
            <CoursePickerField
              classes={selectedClasses.map((c) => ({ id: String(c.id), nom: className(c) }))}
              value={form.coursParClasse}
              onChange={(classeId, v) => {
                setForm((prev) => ({ ...prev, coursParClasse: { ...prev.coursParClasse, [classeId]: v } }));
                if (errors.coursId) setErrors((prev) => ({ ...prev, coursId: '' }));
              }}
              error={errors.coursId}
            />

            {/* Dates (web: grid-cols-1 below sm) */}
            <DateTimeInput
              label="Date prévue"
              value={form.dateExoPrevue}
              onChange={(v) => setField('dateExoPrevue', v)}
              error={errors.dateExoPrevue}
            />
            <DateTimeInput
              label="Début effectif"
              value={form.dateDebutExoEffectif}
              onChange={(v) => setField('dateDebutExoEffectif', v)}
              error={errors.dateDebutExoEffectif}
            />
            <DateTimeInput
              label="Fin effective"
              value={form.dateFinExoEffectif}
              onChange={(v) => setField('dateFinExoEffectif', v)}
              error={errors.dateFinExoEffectif}
            />

            {/* Actions */}
            <View style={styles.formActions}>
              <TouchableOpacity style={[styles.secondaryBtn, { flex: 1 }]} onPress={closeForm} disabled={submitting}>
                <Text style={styles.secondaryBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 2 }} onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
                <LinearGradient
                  colors={['#7C3AED', '#DB2777']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.primaryBtn, submitting && { opacity: 0.7 }]}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <FontAwesome5 name="paper-plane" size={14} color="#FFFFFF" />
                  )}
                  <Text style={styles.primaryBtnText} numberOfLines={1}>
                    Programmer et diffuser
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Exercise picker (antd Select showSearch) */}
        <BottomSheet visible={exoSheetOpen} onClose={() => setExoSheetOpen(false)} title="Exercice">
          <View style={[styles.searchBox, { marginBottom: 8, flex: 0 }]}>
            <FontAwesome5 name="search" size={12} color={muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un exercice..."
              placeholderTextColor="#94A3B8"
              value={exoSearch}
              onChangeText={setExoSearch}
            />
          </View>
          <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {exoOptions.length === 0 ? <Text style={styles.sheetEmpty}>Aucun exercice</Text> : null}
            {exoOptions.map((e) => {
              const on = String(e.id) === String(form.exerciseId);
              return (
                <TouchableOpacity
                  key={e.id}
                  style={styles.sheetOption}
                  onPress={() => {
                    setField('exerciseId', String(e.id));
                    setExoSheetOpen(false);
                  }}
                >
                  <Text style={[styles.sheetOptionText, on && styles.sheetOptionTextActive]} numberOfLines={1}>
                    {exoName(e)}
                  </Text>
                  {e.niveau ? <Text style={styles.inputAside}>{e.niveau}</Text> : null}
                  {on ? <FontAwesome5 name="check" size={13} color="#4F46E5" style={{ marginLeft: 8 }} /> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </BottomSheet>

        {/* Type picker (rich options like the web) */}
        <BottomSheet visible={typeSheetOpen} onClose={() => setTypeSheetOpen(false)} title="Type d'assignation">
          {(Object.keys(TYPE_CONFIG) as TypeAssignation[]).map((key) => {
            const cfg = TYPE_CONFIG[key];
            const t = tone(cfg.tone);
            const on = form.typeAssignation === key;
            return (
              <TouchableOpacity
                key={key}
                style={styles.sheetOption}
                onPress={() => {
                  setField('typeAssignation', key);
                  setTypeSheetOpen(false);
                }}
              >
                <View style={[styles.typeIcon, { backgroundColor: t.bg }]}>
                  <FontAwesome5 name={cfg.icon as any} size={14} color={t.fg} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetOptionText, on && styles.sheetOptionTextActive]}>{cfg.label}</Text>
                  <Text style={styles.metaText}>{cfg.desc}</Text>
                </View>
                {on ? <FontAwesome5 name="check" size={13} color="#4F46E5" /> : null}
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 12 }} />
        </BottomSheet>

        {/* Classes multi-select */}
        <BottomSheet visible={classSheetOpen} onClose={() => setClassSheetOpen(false)} title="Classes">
          <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
            {classes.length === 0 ? <Text style={styles.sheetEmpty}>Aucune classe disponible</Text> : null}
            {classes.map((c) => {
              const id = String(c.id);
              const on = form.classeIds.includes(id);
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.multiOption, on && styles.multiOptionOn]}
                  onPress={() =>
                    setField('classeIds', on ? form.classeIds.filter((x) => x !== id) : [...form.classeIds, id])
                  }
                >
                  <View style={[styles.checkbox, on && styles.checkboxOn]}>
                    {on ? <FontAwesome5 name="check" size={8} color="#FFFFFF" /> : null}
                  </View>
                  <Text style={styles.multiOptionText} numberOfLines={1}>
                    {className(c)}
                    {c.niveau ? ` — ${c.niveau}` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity onPress={() => setClassSheetOpen(false)} activeOpacity={0.85} style={{ marginTop: 12, marginBottom: 8 }}>
            <LinearGradient colors={['#7C3AED', '#DB2777']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Valider</Text>
            </LinearGradient>
          </TouchableOpacity>
        </BottomSheet>
      </ScrollView>
    );
  };

  // ── detail sheet (web: detail Modal) ──
  const renderDetail = () => {
    const d = detailProg;
    if (!d) return null;
    const own = tone('ownAmber');
    const rows: [string, React.ReactNode][] = [
      ['Exercice', d.nom || '—'],
      ['Type', <TypeBadge key="t" type={d.typeAssignation} />],
      ['Statut', <EtatBadge key="s" etat={getEffectiveEtat(d)} />],
      ['Date prévue', fmtDateTime(d.dateExoPrevue)],
      ['Début effectif', fmtDateTime(d.dateDebutExoEffectif)],
      ['Fin effective', fmtDateTime(d.dateFinExoEffectif)],
      [t('learning.course'), courseLabel(d)],
      ['Classes', d.classesDiffusees && d.classesDiffusees.length > 0 ? d.classesDiffusees.map((c) => c.nom).join(', ') : 'Aucune'],
    ];
    return (
      <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
        {rows.map(([k, v]) => (
          <View key={k} style={styles.detailRow}>
            <Text style={styles.detailLabel}>{k}</Text>
            {typeof v === 'string' ? <Text style={styles.detailValue}>{v}</Text> : <View style={{ flexDirection: 'row' }}>{v}</View>}
          </View>
        ))}
        {!d.isOwn ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Programmé par</Text>
            <View style={styles.metaRow}>
              <FontAwesome5 name="users" size={12} color="#F59E0B" />
              <Text style={[styles.detailValue, { color: own.fg, fontWeight: '600' }]}>{d.programmeParNom || 'Autre professeur'}</Text>
            </View>
          </View>
        ) : null}
        <TouchableOpacity style={[styles.secondaryBtn, { marginTop: 14, marginBottom: 10 }]} onPress={() => setDetailProg(null)}>
          <Text style={styles.secondaryBtnText}>Fermer</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <LoadingSpinner label="Chargement..." />
        </View>
      ) : view === 'form' ? (
        renderForm()
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#4F46E5" />}
        >
          {renderListHeader()}
          {renderBanners()}
          {renderToolbar()}
          {renderList()}
        </ScrollView>
      )}

      <BottomSheet visible={!!detailProg} onClose={() => setDetailProg(null)} title="Détail de la programmation">
        {renderDetail()}
      </BottomSheet>

      <BottomSheet
        visible={!!courseEdit}
        onClose={() => !courseEdit?.saving && setCourseEdit(null)}
        title={t('learning.schedule.changeCourseTitle')}
      >
        {courseEdit ? (
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            <Text style={[styles.metaText, { marginBottom: 6 }]} numberOfLines={2}>
              {courseEdit.prog.nom || 'Exercice'}
            </Text>
            {courseEdit.error ? (
              <View style={[styles.banner, styles.bannerError]}>
                <FontAwesome5 name="exclamation-circle" size={14} color="#EF4444" />
                <Text style={[styles.bannerText, { color: isDark ? '#FCA5A5' : '#B91C1C' }]}>{courseEdit.error}</Text>
              </View>
            ) : null}
            {renderCourseOptions(
              courseEdit.status,
              courseEdit.list,
              programmeCoursId(courseEdit.prog) ?? GENERAL_COURSE_ID,
              (id) => applyCourseEdit(id === GENERAL_COURSE_ID ? null : id),
              () => openCourseEdit(courseEdit.prog),
              courseEdit.saving
            )}
            <View style={{ height: 12 }} />
          </ScrollView>
        ) : null}
      </BottomSheet>

      <ConfirmDialog
        visible={!!confirmDeleteId}
        busy={!!deletingId}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
      />
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>, isDark: boolean) => {
  const title = isDark ? '#F8FAFC' : '#111827';
  const label = isDark ? '#E2E8F0' : '#374151';
  const body = isDark ? '#CBD5E1' : '#4B5563';
  const sub = isDark ? '#94A3B8' : '#6B7280';
  const card = isDark ? '#1E293B' : '#FFFFFF';
  const border = isDark ? '#334155' : '#F3F4F6';
  const input = isDark ? '#0F172A' : '#F8FAFC';
  const fieldBg = isDark ? '#0F172A' : '#FFFFFF';
  const inputBorder = isDark ? '#475569' : '#E2E8F0';
  const shadow = {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  };

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: 12, paddingTop: 12 },

    // Gradient header card
    heroCard: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12, gap: 12, ...shadow },
    heroRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    heroBack: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    heroBackLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      height: 32,
      borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    heroBackText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
    heroIcon: {
      width: 36,
      height: 36,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    heroTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', lineHeight: 20 },
    heroSubtitle: { fontSize: 12 },
    heroStats: { flexDirection: 'row', justifyContent: 'flex-start', gap: 20, paddingLeft: 2 },
    heroStat: { alignItems: 'center' },
    heroStatValue: { fontSize: 18, fontWeight: '800' },
    heroStatLabel: { fontSize: 11, color: '#BFDBFE' },

    // Banners
    banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
    bannerText: { flex: 1, fontSize: 12 },
    bannerSuccess: {
      backgroundColor: isDark ? 'rgba(34,197,94,0.12)' : '#F0FDF4',
      borderColor: isDark ? 'rgba(34,197,94,0.35)' : '#BBF7D0',
    },
    bannerError: {
      backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#FEF2F2',
      borderColor: isDark ? 'rgba(239,68,68,0.35)' : '#FECACA',
    },

    // Toolbar
    toolbar: { backgroundColor: card, borderWidth: 1, borderColor: border, borderRadius: 12, padding: 12, gap: 8, marginBottom: 12, ...shadow },
    toolbarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    searchBox: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: input,
      borderWidth: 1,
      borderColor: inputBorder,
      borderRadius: 8,
      paddingHorizontal: 10,
      height: 38,
    },
    searchInput: { flex: 1, fontSize: 13, color: title, paddingVertical: 0 },
    refreshBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
    newBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 40, borderRadius: 8, ...shadow },
    newBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
    selectPill: {
      flexDirection: 'row',
      alignItems: 'center',
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
    pastToggle: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: input,
      borderWidth: 1,
      borderColor: inputBorder,
      borderRadius: 8,
      paddingHorizontal: 10,
      height: 36,
      minWidth: 0,
    },
    pastToggleText: { flexShrink: 1, fontSize: 12, color: body },
    checkbox: {
      width: 16,
      height: 16,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: isDark ? '#64748B' : '#CBD5E1',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: fieldBg,
    },
    checkboxOn: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
    resetBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: 1,
      borderRadius: 8,
      height: 36,
    },
    resetBtnText: { fontSize: 12, fontWeight: '600' },

    // Sheets
    sheetOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    sheetOptionText: { flex: 1, fontSize: 15, color: colors.text },
    sheetOptionTextActive: { color: '#4F46E5', fontWeight: '700' },
    sheetEmpty: { fontSize: 13, color: sub, fontStyle: 'italic', paddingVertical: 12 },
    typeIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    multiOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 6, borderRadius: 8 },
    multiOptionOn: { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : '#EEF2FF' },
    multiOptionText: { flex: 1, fontSize: 14, color: title },

    // Badges
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      alignSelf: 'flex-start',
      maxWidth: '100%',
    },
    badgeText: { fontSize: 11, fontWeight: '500' },
    badgeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },

    // List card
    listCard: { backgroundColor: card, borderRadius: 12, overflow: 'hidden', borderWidth: isDark ? 1 : 0, borderColor: border, ...shadow },
    listHeader: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: border,
    },
    listTitle: { fontSize: 14, fontWeight: '700', color: isDark ? '#F1F5F9' : '#1F2937' },
    countBadge: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    countBadgeText: { fontSize: 12, fontWeight: '700' },
    row: { paddingHorizontal: 14, paddingVertical: 12, gap: 6 },
    rowBorder: { borderTopWidth: 1, borderTopColor: isDark ? '#334155' : '#F9FAFB' },
    rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    rowTitle: { fontSize: 14, fontWeight: '700', color: title },
    rowActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    iconBtn: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    rowMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingLeft: 50 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    metaText: { flexShrink: 1, fontSize: 12, color: sub },
    classChips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, paddingLeft: 50 },
    classChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
    classChipText: { fontSize: 11 },
    linkText: { fontSize: 12, fontWeight: '700', color: '#4F46E5' },
    empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 16, gap: 6 },
    emptyTitle: { fontSize: 14, fontWeight: '600', color: body, textAlign: 'center', marginTop: 4 },
    emptyText: { fontSize: 12, color: sub, textAlign: 'center' },

    // Pagination
    pagination: {
      borderTopWidth: 1,
      borderTopColor: border,
      backgroundColor: isDark ? '#172033' : '#F9FAFB',
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 8,
    },
    paginationInfo: { fontSize: 12, color: sub },
    pageBtns: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
    pageBtn: {
      minWidth: 30,
      height: 30,
      paddingHorizontal: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: inputBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pageBtnActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
    pageBtnText: { fontSize: 12, fontWeight: '600', color: body },
    pageEllipsis: { fontSize: 12, color: sub, paddingHorizontal: 4 },

    // Form
    formCard: { backgroundColor: card, borderRadius: 12, overflow: 'hidden', borderWidth: isDark ? 1 : 0, borderColor: border, ...shadow },
    formCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: border,
    },
    formBody: { padding: 16 },
    field: { marginBottom: 18 },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
    required: { color: '#EF4444', fontSize: 14 },
    label: { fontSize: 14, fontWeight: '500', color: label },
    input: {
      backgroundColor: fieldBg,
      borderWidth: 1,
      borderColor: inputBorder,
      borderRadius: 8,
      paddingHorizontal: 12,
      minHeight: 44,
      paddingVertical: 10,
    },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    inputText: { flex: 1, fontSize: 15, color: title },
    inputAside: { fontSize: 12, color: '#9CA3AF' },
    placeholder: { color: '#9CA3AF' },
    inputError: { borderColor: '#FF4D4F' },
    fieldErrorText: { fontSize: 13, color: '#FF4D4F', marginTop: 4 },
    selectedChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    selectedChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      maxWidth: '100%',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
    },
    selectedChipText: { flexShrink: 1, fontSize: 12, fontWeight: '600' },
    formActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 46,
      paddingHorizontal: 10,
      borderRadius: 10,
    },
    primaryBtnText: { flexShrink: 1, color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
    secondaryBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 46,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: inputBorder,
      backgroundColor: fieldBg,
    },
    secondaryBtnText: { color: body, fontWeight: '600', fontSize: 14 },

    // Detail
    detailRow: { flexDirection: 'column', gap: 4, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
    detailLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
    detailValue: { fontSize: 14, color: title },

    // Dialog
    dialogOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 16 },
    dialogCard: { width: '100%', maxWidth: 380, backgroundColor: card, borderRadius: 16, padding: 24 },
    dialogIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
    dialogTitle: { fontSize: 16, fontWeight: '800', color: title, textAlign: 'center', marginBottom: 20 },
    dialogActions: { flexDirection: 'row', gap: 12 },
    dialogCancel: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: isDark ? '#334155' : '#F3F4F6' },
    dialogCancelText: { fontSize: 14, fontWeight: '700', color: isDark ? '#E2E8F0' : '#4B5563' },
    dialogConfirm: {
      flex: 1,
      flexDirection: 'row',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#DC2626',
    },
    dialogConfirmText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  });
};

export default ScheduleExerciseView;
