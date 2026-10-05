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
import { useNavigation } from '@react-navigation/native';
import { BottomSheet, LoadingSpinner } from '../../../../components/ui';
import { useThemeColors } from '../../../../styles/theme';
import { useThemeStore } from '../../../../store/useThemeStore';
import { classService } from '../../../../services/classService';
import {
  accederService,
  coursProgrammerService,
  coursService,
  liveSessionService,
} from '../../../../services/api';
import { SessionMode } from '../../../../services/api/liveSessionService';
import { useUser } from '../../../../context/UserContext';
import { ClassEntity, ClassUser, CoursProgramme } from '../../../../types';
import { Cours } from './DashboardCoursBody';
import { formatDate, formatDateTime, formatTime, parseServerDate, serverDateMs, toServerDateTime } from '../../../../utils/dates';

// LinearGradient via expo-linear-gradient (safe fallback to View if unavailable)
let LinearGradient: any;
try {
  LinearGradient = require('expo-linear-gradient').LinearGradient;
} catch {
  LinearGradient = ({ children, style, colors: c }: any) => (
    <View style={[style, { backgroundColor: c?.[0] }]}>{children}</View>
  );
}

export interface CoursProgrammerScreenProps {
  onClose: () => void;
  onScheduled?: () => void;
  coursList: Cours[];
  /** Open straight on the create form instead of the list. */
  initialView?: 'list' | 'form';
  /** Pre-select this course in the create form (web: location.state.course). */
  initialCoursId?: string | null;
}

type Etat = 'PLANIFIE' | 'EN_COURS' | 'TERMINE' | 'ANNULE';
type ModalMode = 'create' | 'edit';

/** Scheduled course enriched with its course object, like the web's loadData(). */
type ScheduledItem = CoursProgramme & { cours: { id?: string; titre?: string; description?: string } };

interface Participant {
  id: string;
  name: string;
  email: string;
}

interface FormState {
  coursId: string;
  etatCoursProgramme: Etat;
  classeId: string;
  capaciteMax: string;
  dateCoursPrevue: string;
  dateDebutEffectif: string;
  dateFinEffectif: string;
  lieu: string;
  description: string;
}

const EMPTY_FORM: FormState = {
  coursId: '',
  etatCoursProgramme: 'PLANIFIE',
  classeId: '',
  capaciteMax: '',
  dateCoursPrevue: '',
  dateDebutEffectif: '',
  dateFinEffectif: '',
  lieu: '',
  description: '',
};

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 25, 50, 100];

const STATUS_LABELS: Record<string, string> = {
  PLANIFIE: 'Planifié',
  EN_COURS: 'En cours',
  TERMINE: 'Terminé',
  ANNULE: 'Annulé',
};

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'PLANIFIE', label: 'Planifié' },
  { value: 'EN_COURS', label: 'En cours' },
  { value: 'TERMINE', label: 'Terminé' },
  { value: 'ANNULE', label: 'Annulé' },
];

const ETAT_OPTIONS = STATUS_FILTER_OPTIONS.filter((o) => o.value !== 'all');

/** Tailwind tints used by the web (light) with translucent dark-mode equivalents. */
type Tone = { bg: string; fg: string; bgDark: string; fgDark: string };
const TONES: Record<string, Tone> = {
  blue: { bg: '#DBEAFE', fg: '#1D4ED8', bgDark: 'rgba(59,130,246,0.18)', fgDark: '#93C5FD' },
  green: { bg: '#DCFCE7', fg: '#15803D', bgDark: 'rgba(34,197,94,0.18)', fgDark: '#86EFAC' },
  gray: { bg: '#F3F4F6', fg: '#374151', bgDark: 'rgba(148,163,184,0.18)', fgDark: '#CBD5E1' },
  red: { bg: '#FEE2E2', fg: '#B91C1C', bgDark: 'rgba(239,68,68,0.18)', fgDark: '#FCA5A5' },
  redSoft: { bg: '#FEF2F2', fg: '#DC2626', bgDark: 'rgba(239,68,68,0.12)', fgDark: '#FCA5A5' },
  orange: { bg: '#FFEDD5', fg: '#C2410C', bgDark: 'rgba(249,115,22,0.18)', fgDark: '#FDBA74' },
  indigo: { bg: '#E0E7FF', fg: '#4338CA', bgDark: 'rgba(99,102,241,0.2)', fgDark: '#A5B4FC' },
  slate: { bg: '#F1F5F9', fg: '#334155', bgDark: '#334155', fgDark: '#E2E8F0' },
  amber: { bg: '#FFFBEB', fg: '#B45309', bgDark: 'rgba(245,158,11,0.15)', fgDark: '#FCD34D' },
};
const STATUS_TONE: Record<string, keyof typeof TONES> = {
  PLANIFIE: 'blue',
  EN_COURS: 'green',
  TERMINE: 'gray',
  ANNULE: 'red',
};

const STATUS_ORDER: Record<string, number> = { EN_COURS: 0, PLANIFIE: 1, ANNULE: 2 };

const getInitials = (title?: string) =>
  title
    ?.split(' ')
    .map((w) => w.charAt(0))
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'CP';

const fmtDate = (d?: string | null) => (d ? formatDate(d) : '');
const fmtTime = (d?: string | null) =>
  d ? formatTime(d, { hour: '2-digit', minute: '2-digit' }) : '';
const fmtDateTime = (d?: string | null) =>
  d
    ? formatDateTime(d, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

const className = (c: ClassEntity) => c.nom || (c as any).name || (c as any).titre || `Classe ${c.id}`;

/** Same student filter as the web form: only ELEVE accounts can be participants. */
const isStudent = (u: ClassUser) => {
  const t = String(u.typeUtilisateur || u.type || u.role || '').toUpperCase();
  return t === 'ELEVE' || t === 'ÉLÈVE' || t === 'STUDENT';
};

const toParticipant = (u: ClassUser): Participant => {
  const fullName = `${u.prenom || ''} ${u.nom || ''}`.trim();
  return { id: u.id, name: fullName || u.email || `User ${u.id}`, email: u.email || '' };
};

/** Mirrors the web's yup `schedulingSchema`. */
const validateForm = (f: FormState): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (!f.coursId) errors.coursId = 'Le cours est obligatoire';
  if (!f.classeId) errors.classeId = 'La classe est obligatoire';
  if (!f.dateCoursPrevue) errors.dateCoursPrevue = 'La date prevue est obligatoire';
  if (f.dateDebutEffectif && !f.dateFinEffectif) {
    errors.dateDebutEffectif =
      'Si vous fournissez une date de début, vous devez aussi fournir une date de fin';
  } else if (
    f.dateDebutEffectif &&
    f.dateCoursPrevue &&
    serverDateMs(f.dateDebutEffectif, NaN) < serverDateMs(f.dateCoursPrevue, NaN)
  ) {
    errors.dateDebutEffectif = 'La date de début ne peut pas être avant la date prévue';
  }
  if (f.dateFinEffectif && !f.dateDebutEffectif) {
    errors.dateFinEffectif =
      'Si vous fournissez une date de fin, vous devez aussi fournir une date de début';
  } else if (
    f.dateFinEffectif &&
    f.dateDebutEffectif &&
    serverDateMs(f.dateFinEffectif, NaN) < serverDateMs(f.dateDebutEffectif, NaN)
  ) {
    errors.dateFinEffectif = 'La date de fin ne peut pas être avant la date de début';
  }
  if (!f.lieu.trim()) errors.lieu = 'Le lieu est obligatoire';
  if (f.capaciteMax.trim() !== '') {
    const n = Number(f.capaciteMax);
    if (isNaN(n)) errors.capaciteMax = 'La capacité doit être un nombre entier';
    else if (n <= 0) errors.capaciteMax = 'La capacité doit être positive';
    else if (!Number.isInteger(n)) errors.capaciteMax = 'La capacité doit être un nombre entier';
  }
  return errors;
};

// ─── Styles hook ─────────────────────────────────────────────────────────────

const useProgStyles = () => {
  const colors = useThemeColors();
  const isDark = useThemeStore((s) => s.mode === 'dark');
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const tone = useCallback(
    (key: keyof typeof TONES) => {
      const t = TONES[key];
      return isDark ? { bg: t.bgDark, fg: t.fgDark } : { bg: t.bg, fg: t.fg };
    },
    [isDark]
  );
  return { styles, colors, isDark, tone, muted: '#94A3B8' };
};

// ─── Small building blocks ───────────────────────────────────────────────────

/** Compact select pill (web's small toolbar <select>) that opens a bottom sheet. */
const SelectPill = ({
  icon,
  value,
  options,
  onChange,
  title,
  grow = true,
}: {
  icon: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  title: string;
  grow?: boolean;
}) => {
  const { styles, muted } = useProgStyles();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) ?? options[0];
  return (
    <>
      <TouchableOpacity
        style={[styles.selectPill, grow && { flex: 1 }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <FontAwesome5 name={icon as any} size={11} color={muted} />
        <Text style={styles.selectPillText} numberOfLines={1}>
          {selected?.label}
        </Text>
        <FontAwesome5 name="chevron-down" size={10} color={muted} />
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
  const { styles } = useProgStyles();
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
        {options.length === 0 ? <Text style={styles.sheetEmpty}>Aucune option disponible</Text> : null}
        {options.map((opt) => (
          <TouchableOpacity key={opt.value} style={styles.sheetOption} onPress={() => onSelect(opt.value)}>
            <Text style={[styles.sheetOptionText, opt.value === value && styles.sheetOptionTextActive]}>
              {opt.label}
            </Text>
            {opt.value === value ? <FontAwesome5 name="check" size={13} color="#4F46E5" /> : null}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </BottomSheet>
  );
};

const FieldLabel = ({ icon, iconColor = '#4F46E5', text }: { icon: string; iconColor?: string; text: string }) => {
  const { styles } = useProgStyles();
  return (
    <View style={styles.labelRow}>
      <FontAwesome5 name={icon as any} size={14} color={iconColor} solid />
      <Text style={styles.label}>{text}</Text>
    </View>
  );
};

const FieldError = ({ message }: { message?: string }) => {
  const { styles } = useProgStyles();
  if (!message) return null;
  return (
    <View style={styles.fieldErrorRow}>
      <FontAwesome5 name="exclamation-circle" size={12} color="#DC2626" />
      <Text style={styles.fieldErrorText}>{message}</Text>
    </View>
  );
};

/** Full-size select (web form <select>) opening a bottom sheet. */
const SelectField = ({
  icon,
  label,
  placeholder,
  value,
  options,
  onChange,
  disabled,
  error,
}: {
  icon: string;
  label: string;
  placeholder: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
  error?: string;
}) => {
  const { styles, muted } = useProgStyles();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={styles.field}>
      <FieldLabel icon={icon} text={label} />
      <TouchableOpacity
        style={[styles.input, styles.inputRow, error && styles.inputError, disabled && styles.inputDisabled]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={disabled ? 1 : 0.8}
      >
        <Text style={[styles.inputText, !selected && styles.placeholder]} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        {!disabled ? <FontAwesome5 name="chevron-down" size={12} color={muted} /> : null}
      </TouchableOpacity>
      <FieldError message={error} />
      <OptionsSheet
        visible={open}
        title={label.replace(/\s*\*$/, '')}
        options={options}
        value={value}
        onClose={() => setOpen(false)}
        onSelect={(v) => {
          onChange(v);
          setOpen(false);
        }}
      />
    </View>
  );
};

/** Native replacement for the web's `datetime-local` input (value is an ISO string, '' when empty). */
const DateTimeInput = ({
  icon,
  iconColor,
  label,
  value,
  onChange,
  minimumDate,
  clearable,
  error,
}: {
  icon: string;
  iconColor: string;
  label: string;
  value: string;
  onChange: (iso: string) => void;
  minimumDate?: Date;
  clearable?: boolean;
  error?: string;
}) => {
  const { styles, muted } = useProgStyles();
  const [stage, setStage] = useState<'none' | 'date' | 'time' | 'ios'>('none');
  const [pending, setPending] = useState<Date>(new Date());
  const current = parseServerDate(value);

  const open = () => {
    const start = current ?? (minimumDate && minimumDate > new Date() ? minimumDate : new Date());
    setPending(start);
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
      <FieldLabel icon={icon} iconColor={iconColor} text={label} />
      <TouchableOpacity
        style={[styles.input, styles.inputRow, error && styles.inputError]}
        onPress={open}
        activeOpacity={0.8}
      >
        <FontAwesome5 name="calendar-alt" size={13} color={muted} />
        <Text style={[styles.inputText, { flex: 1 }, !current && styles.placeholder]} numberOfLines={1}>
          {current
            ? `${current.toLocaleDateString('fr-FR')} ${fmtTime(value)}`
            : 'jj/mm/aaaa --:--'}
        </Text>
        {clearable && current ? (
          <TouchableOpacity onPress={() => onChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <FontAwesome5 name="times-circle" size={14} color={muted} />
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
      <FieldError message={error} />

      {stage === 'date' && (
        <DateTimePicker value={pending} mode="date" display="default" minimumDate={minimumDate} onChange={onAndroidDate} />
      )}
      {stage === 'time' && <DateTimePicker value={pending} mode="time" display="default" onChange={onAndroidTime} />}
      {Platform.OS === 'ios' ? (
        <BottomSheet visible={stage === 'ios'} onClose={() => setStage('none')} title={label.replace(/\s*\*$/, '')}>
          <DateTimePicker
            value={pending}
            mode="datetime"
            display="inline"
            minimumDate={minimumDate}
            onChange={(_e: any, d?: Date) => d && setPending(d)}
          />
          <TouchableOpacity
            onPress={() => {
              onChange(pending.toISOString());
              setStage('none');
            }}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#4F46E5', '#9333EA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Valider</Text>
            </LinearGradient>
          </TouchableOpacity>
        </BottomSheet>
      ) : null}
    </View>
  );
};

/** Tinted action button (web's `bg-*-100 text-*-700` card buttons). */
const ActionBtn = ({
  icon,
  label,
  toneKey,
  onPress,
  solid,
  grow,
}: {
  icon: string;
  label?: string;
  toneKey: keyof typeof TONES;
  onPress: () => void;
  solid?: boolean;
  grow?: boolean;
}) => {
  const { styles, tone } = useProgStyles();
  const t = tone(toneKey);
  const bg = solid ? '#4F46E5' : t.bg;
  const fg = solid ? '#FFFFFF' : t.fg;
  return (
    <TouchableOpacity
      style={[styles.actionBtn, { backgroundColor: bg }, grow && styles.actionBtnGrow]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <FontAwesome5 name={icon as any} size={12} color={fg} />
      {label ? <Text style={[styles.actionBtnText, { color: fg }]}>{label}</Text> : null}
    </TouchableOpacity>
  );
};

const StatusChip = ({ etat }: { etat?: string }) => {
  const { styles, tone } = useProgStyles();
  const t = tone(STATUS_TONE[etat ?? ''] ?? 'red');
  return (
    <View style={[styles.statusChip, { backgroundColor: t.bg }]}>
      <Text style={[styles.statusChipText, { color: t.fg }]}>{STATUS_LABELS[etat ?? ''] ?? etat}</Text>
    </View>
  );
};

/** Web's centered confirmation dialog (delete / cancel). */
const ConfirmDialog = ({
  visible,
  icon,
  title,
  message,
  cancelLabel,
  confirmLabel,
  busyLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  icon: string;
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) => {
  const { styles, tone } = useProgStyles();
  const red = tone('red');
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.dialogOverlay}>
        <View style={styles.dialogCard}>
          <View style={[styles.dialogIcon, { backgroundColor: red.bg }]}>
            <FontAwesome5 name={icon as any} size={20} color="#DC2626" />
          </View>
          <Text style={styles.dialogTitle}>{title}</Text>
          <Text style={styles.dialogMessage}>{message}</Text>
          <View style={styles.dialogActions}>
            <TouchableOpacity style={styles.dialogCancel} onPress={onCancel}>
              <Text style={styles.dialogCancelText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.dialogConfirm, busy && { opacity: 0.5 }]} onPress={onConfirm} disabled={busy}>
              {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
              <Text style={styles.dialogConfirmText}>{busy ? busyLabel : confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── Screen ──────────────────────────────────────────────────────────────────

/**
 * Port of the web's "schedule-course" tab (CoursProgrammerContent + Stats +
 * List + CoursProgrammerForm). List view: header, stats, control bar, grid /
 * list of scheduled sessions. Form view: create / edit / reprogramme, same
 * fields, validation and payload as the web form.
 */
export const CoursProgrammerScreen = ({
  onClose,
  onScheduled,
  coursList,
  initialView = 'list',
  initialCoursId = null,
}: CoursProgrammerScreenProps) => {
  const { styles, tone, muted } = useProgStyles();
  const { user } = useUser();
  const navigation = useNavigation<any>();
  const professorId = user?.userId ?? '';

  // ── page state ──
  const [view, setView] = useState<'list' | 'form'>('list');
  const [scheduled, setScheduled] = useState<ScheduledItem[]>([]);
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterClassId, setFilterClassId] = useState('');
  const [showPast, setShowPast] = useState(false);
  const [layout, setLayout] = useState<'grid' | 'table'>('grid');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [detailItem, setDetailItem] = useState<ScheduledItem | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [launcherItem, setLauncherItem] = useState<ScheduledItem | null>(null);
  const launching = false;

  // ── form state ──
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [selected, setSelected] = useState<ScheduledItem | null>(null);
  const [reprogrammeOfId, setReprogrammeOfId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);
  const [classParticipants, setClassParticipants] = useState<Participant[]>([]);
  const [participantsIds, setParticipantsIds] = useState<string[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const keepParticipantsRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const isReprogramme = !!reprogrammeOfId;

  // ── data loading (web: loadData) ──
  const loadData = useCallback(async () => {
    if (!professorId) {
      setError('ID du professeur non trouvé. Veuillez vous reconnecter.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [pubRes, accRes, schedRes] = await Promise.allSettled([
        classService.getClassesWithPublicationRights(professorId),
        accederService.getAccessibleClasses(professorId),
        coursProgrammerService.getAccessible(professorId),
      ]);
      // Web's obtenirClassesUtilisateur: classes with publication rights ∪ classes with access.
      const classMap = new Map<string, ClassEntity>();
      [
        ...(pubRes.status === 'fulfilled' ? pubRes.value || [] : []),
        ...(accRes.status === 'fulfilled' ? accRes.value || [] : []),
      ].forEach((c) => {
        if (c?.id && !classMap.has(String(c.id))) classMap.set(String(c.id), c);
      });
      setClasses(Array.from(classMap.values()));

      const raw = schedRes.status === 'fulfilled' ? schedRes.value || [] : [];
      if (schedRes.status === 'rejected') {
        setError(
          'Erreur lors du chargement des données: ' +
            (schedRes.reason instanceof Error ? schedRes.reason.message : String(schedRes.reason))
        );
      }

      const coursesMap = new Map<string, { id?: string; titre?: string; description?: string }>(
        coursList.map((c) => [String(c.id), c])
      );
      const missing = raw.some((sc) => sc.coursId && !coursesMap.has(String(sc.coursId)));
      if (missing) {
        try {
          const accessible = await coursService.getAccessible(professorId);
          (accessible || []).forEach((c: any) => {
            if (c?.id) coursesMap.set(String(c.id), c);
          });
        } catch {
          /* non-blocking — titles fall back to the description */
        }
      }

      const enriched: ScheduledItem[] = raw.map((sc) => ({
        ...sc,
        cours: sc.cours ||
          coursesMap.get(String(sc.coursId)) || {
            id: sc.coursId,
            titre: sc.description || 'Cours sans titre',
            description: '',
          },
      }));
      enriched.sort((a, b) => {
        const oa = STATUS_ORDER[a.etatCoursProgramme ?? ''] ?? 3;
        const ob = STATUS_ORDER[b.etatCoursProgramme ?? ''] ?? 3;
        return oa !== ob
          ? oa - ob
          : serverDateMs(a.dateCoursPrevue ?? 0) - serverDateMs(b.dateCoursPrevue ?? 0);
      });
      setScheduled(enriched);
    } catch (err) {
      setError('Erreur lors du chargement des données: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setLoading(false);
    }
  }, [professorId, coursList]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professorId]);

  // Back from the live class (started / ended there) → refresh the states.
  const loadDataRef = useRef(loadData);
  loadDataRef.current = loadData;
  useEffect(() => {
    let blurred = false;
    const offBlur = navigation.addListener('blur', () => {
      blurred = true;
    });
    const offFocus = navigation.addListener('focus', () => {
      if (blurred) loadDataRef.current();
    });
    return () => {
      offBlur();
      offFocus();
    };
  }, [navigation]);

  // Auto-open the create form (web: location.state.course).
  const didAutoOpen = useRef(false);
  useEffect(() => {
    if (didAutoOpen.current) return;
    if (initialView === 'form' || initialCoursId) {
      didAutoOpen.current = true;
      openCreate(initialCoursId ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-clear messages (5 s success, 10 s error) like the web.
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 5000);
    return () => clearTimeout(t);
  }, [success]);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 10000);
    return () => clearTimeout(t);
  }, [error]);

  // ── participants of the selected class (web: fetchClassParticipants) ──
  useEffect(() => {
    if (view !== 'form') return;
    const keep = keepParticipantsRef.current;
    keepParticipantsRef.current = false;
    if (!form.classeId) {
      setClassParticipants([]);
      setParticipantsIds([]);
      return;
    }
    let cancelled = false;
    setLoadingParticipants(true);
    accederService
      .getUsersWithAccess(form.classeId)
      .then((users) => {
        if (cancelled) return;
        const list = (users || [])
          .filter(isStudent)
          .map(toParticipant)
          .sort((a, b) => a.name.localeCompare(b.name));
        setClassParticipants(list);
        // Selections are cleared when the class changes; an opened edit keeps its saved selection.
        if (!keep) setParticipantsIds([]);
      })
      .catch(() => {
        if (cancelled) return;
        setClassParticipants([]);
        setSubmitError('Erreur lors du chargement des participants de la classe');
      })
      .finally(() => {
        if (!cancelled) setLoadingParticipants(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.classeId, view]);

  // ── filtering (web: filterScheduledCourses) ──
  const filtered = useMemo(() => {
    let list = scheduled;
    if (!showPast) {
      const now = new Date();
      list = list.filter(
        (sc) => sc.etatCoursProgramme === 'EN_COURS' || !sc.dateCoursPrevue || serverDateMs(sc.dateCoursPrevue, NaN) >= now.getTime()
      );
    }
    if (filterClassId) {
      list = list.filter(
        (sc) => Array.isArray(sc.classesIds) && sc.classesIds.some((id) => String(id) === String(filterClassId))
      );
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (sc) =>
          sc.cours?.titre?.toLowerCase().includes(q) ||
          sc.lieu?.toLowerCase().includes(q) ||
          sc.description?.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') list = list.filter((sc) => sc.etatCoursProgramme === filterStatus);
    return list;
  }, [scheduled, showPast, filterClassId, searchTerm, filterStatus]);

  useEffect(() => setCurrentPage(1), [filtered.length, pageSize, layout]);

  const classNameOf = (id?: string) => {
    const c = classes.find((x) => String(x.id) === String(id));
    return c ? className(c) : undefined;
  };
  const classNamesOf = (sc: ScheduledItem) => {
    const fromIds = (sc.classesIds ?? []).map((id) => classNameOf(id)).filter(Boolean) as string[];
    if (fromIds.length) return fromIds.join(', ');
    return (sc.classes ?? []).map((c) => c.nom).filter(Boolean).join(', ');
  };
  const firstClassName = (sc: ScheduledItem) => {
    const id = sc.classeId || sc.classesIds?.[0];
    return id ? classNameOf(id) || sc.classes?.[0]?.nom || 'Classe' : '';
  };

  // ── form open helpers (web: handleScheduleCourse / handleEditSchedule) ──
  const openCreate = (coursId = '') => {
    setModalMode('create');
    setSelected(null);
    setReprogrammeOfId(null);
    setForm({ ...EMPTY_FORM, coursId });
    setParticipantsIds([]);
    setClassParticipants([]);
    setErrors({});
    setSubmitError('');
    setError('');
    setSuccess('');
    setView('form');
  };

  const openEdit = (sc: ScheduledItem) => {
    const reprog = sc.etatCoursProgramme === 'TERMINE' || sc.etatCoursProgramme === 'ANNULE';
    const coursId = sc.coursId || sc.cours?.id || '';
    const classeId = sc.classeId || sc.classesIds?.[0] || sc.classes?.[0]?.id || '';
    const toIso = (d?: string) => (toServerDateTime(d) ?? '');
    setModalMode(reprog ? 'create' : 'edit');
    setReprogrammeOfId(reprog ? sc.id : null);
    setSelected(sc);
    setForm({
      coursId,
      classeId,
      etatCoursProgramme: reprog ? 'PLANIFIE' : ((sc.etatCoursProgramme as Etat) || 'PLANIFIE'),
      capaciteMax: sc.capaciteMax != null ? String(sc.capaciteMax) : '',
      // Reprogramming clears the dates so the user picks a new one.
      dateCoursPrevue: reprog ? '' : toIso(sc.dateCoursPrevue),
      dateDebutEffectif: reprog ? '' : toIso(sc.dateDebutEffectif),
      dateFinEffectif: reprog ? '' : toIso(sc.dateFinEffectif),
      lieu: sc.lieu || '',
      description: reprog && sc.description?.includes('Annulé:') ? '' : sc.description || '',
    });
    keepParticipantsRef.current = !reprog;
    setParticipantsIds(reprog ? [] : sc.participantsIds ?? []);
    setErrors({});
    setSubmitError('');
    setError('');
    setSuccess('');
    setDetailItem(null);
    setView('form');
  };

  const closeForm = () => {
    setView('list');
    setSelected(null);
    setReprogrammeOfId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setSubmitError('');
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const handleEtatChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      etatCoursProgramme: value as Etat,
      dateDebutEffectif: value === 'PLANIFIE' ? '' : prev.dateDebutEffectif,
      dateFinEffectif: value === 'PLANIFIE' || value === 'EN_COURS' ? '' : prev.dateFinEffectif,
    }));
    setErrors((prev) => ({ ...prev, dateDebutEffectif: '', dateFinEffectif: '' }));
  };

  // ── submit (web: CoursProgrammerForm.handleFormSubmit + Content.handleFormSubmit) ──
  const handleSubmit = async () => {
    setSubmitError('');
    const errs = validateForm(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (!professorId) {
      setSubmitError('ID du professeur non disponible');
      return;
    }
    if (modalMode === 'create') {
      const now = new Date();
      now.setMinutes(now.getMinutes() - 5); // 5 min buffer
      if (serverDateMs(form.dateCoursPrevue, NaN) <= now.getTime()) {
        setSubmitError('La date ne peut pas être dans le passé');
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        return;
      }
    }
    const isPlanifie = form.etatCoursProgramme === 'PLANIFIE';
    // Same body as the web form (capaciteMax is not part of it there either).
    const payload: any = {
      coursId: form.coursId,
      professeurId: professorId,
      dateCoursPrevue: form.dateCoursPrevue,
      dateDebutEffectif: isPlanifie ? null : form.dateDebutEffectif || null,
      dateFinEffectif: isPlanifie ? null : form.dateFinEffectif || null,
      lieu: form.lieu.trim(),
      description: form.description.trim() || null,
      etatCoursProgramme: form.etatCoursProgramme,
      classesIds: form.classeId ? [form.classeId] : [],
      participantsIds: participantsIds.filter((id) => id && typeof id === 'string' && id.trim()).map((id) => id.trim()),
    };
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (modalMode === 'create') {
        await coursProgrammerService.programmer(payload);
        // Reprogramming replaces the old record.
        if (reprogrammeOfId) {
          try {
            await coursProgrammerService.remove(reprogrammeOfId);
          } catch {
            /* non-blocking */
          }
        }
        setSuccess('Cours programmé avec succès !');
      } else if (selected) {
        await coursProgrammerService.update(selected.id, payload);
        setSuccess('Programmation modifiée avec succès !');
      }
      closeForm();
      onScheduled?.();
      await loadData();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSaving(false);
    }
  };

  // ── lifecycle actions ──
  const runAction = async (fn: () => Promise<unknown>, ok: string, failPrefix: string) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      setSuccess(ok);
      onScheduled?.();
      await loadData();
    } catch (err) {
      setError(`${failPrefix}: ${err instanceof Error ? err.message : ''}`);
    } finally {
      setBusy(false);
    }
  };

  const handleEnd = (id: string) =>
    runAction(
      () =>
        coursProgrammerService.update(id, {
          etatCoursProgramme: 'TERMINE',
          dateFinEffectif: new Date().toISOString(),
        }),
      'Cours terminé avec succès !',
      'Erreur lors de la fin'
    );

  const handleCancel = (id: string, reason: string) =>
    runAction(
      () =>
        coursProgrammerService.update(id, {
          etatCoursProgramme: 'ANNULE',
          description: reason ? `Annulé: ${reason}` : 'Cours annulé',
          dateDebutEffectif: null,
          dateFinEffectif: null,
        } as any),
      'Cours annulé avec succès !',
      "Erreur lors de l'annulation"
    );

  const handleDelete = async (id: string) => {
    await runAction(() => coursProgrammerService.remove(id), 'Cours supprimé avec succès !', 'Erreur lors de la suppression');
    setConfirmDeleteId(null);
  };

  /**
   * Web: handleLaunchSession. The mode is picked here; LiveSession then asks for
   * camera/microphone, marks the programmation EN_COURS, starts the session and
   * joins it as moderator — so nothing goes live before the permissions are resolved.
   */
  const handleLaunch = (mode: SessionMode) => {
    if (!launcherItem) return;
    const coursId = launcherItem.cours?.id || launcherItem.coursId;
    if (!coursId) return;
    const item = launcherItem;
    setLauncherItem(null);
    navigation.navigate('LiveSession', {
      coursId,
      isHost: true,
      scheduledId: item.id,
      launchMode: mode,
      coursTitle: item.cours?.titre,
    });
  };

  /** EN_COURS card: the professor re-enters his running class as moderator. */
  const handleJoin = (sc: ScheduledItem) => {
    navigation.navigate('LiveSession', {
      coursId: sc.cours?.id || sc.coursId,
      isHost: true,
      scheduledId: sc.id,
      coursTitle: sc.cours?.titre,
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ── stats (web: CoursProgrammerStats) ──
  const stats = useMemo(() => {
    const count = (s: string) => scheduled.filter((c) => c.etatCoursProgramme === s).length;
    return [
      { label: 'Total Programmé', value: scheduled.length, icon: 'calendar-alt', toneKey: 'slate', bar: ['#64748B', '#475569'], filter: 'all', ring: '#64748B' },
      { label: 'Planifiés', value: count('PLANIFIE'), icon: 'clock', toneKey: 'blue', bar: ['#3B82F6', '#2563EB'], filter: 'PLANIFIE', ring: '#3B82F6' },
      { label: 'En Cours', value: count('EN_COURS'), icon: 'play-circle', toneKey: 'green', bar: ['#22C55E', '#16A34A'], filter: 'EN_COURS', ring: '#22C55E' },
      { label: 'Terminés', value: count('TERMINE'), icon: 'check-circle', toneKey: 'gray', bar: ['#6B7280', '#4B5563'], filter: 'TERMINE', ring: '#6B7280' },
      { label: 'Annulés', value: count('ANNULE'), icon: 'times-circle', toneKey: 'red', bar: ['#EF4444', '#DC2626'], filter: 'ANNULE', ring: '#EF4444' },
    ] as const;
  }, [scheduled]);

  // ── render pieces ──
  const renderBanners = () => (
    <>
      {filterClassId ? (
        <View style={[styles.banner, styles.bannerIndigo]}>
          <FontAwesome5 name="users" size={13} color="#4338CA" />
          <Text style={[styles.bannerText, { color: '#4338CA' }]} numberOfLines={2}>
            Cours publics de la classe : <Text style={{ fontWeight: '800' }}>{classNameOf(filterClassId) || filterClassId}</Text>
          </Text>
          <TouchableOpacity onPress={() => setFilterClassId('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <FontAwesome5 name="times" size={12} color="#818CF8" />
          </TouchableOpacity>
        </View>
      ) : null}
      {success ? (
        <View style={[styles.banner, styles.bannerSuccess]}>
          <FontAwesome5 name="check-circle" size={14} color="#22C55E" solid />
          <Text style={[styles.bannerText, { color: '#15803D' }]}>{success}</Text>
          <TouchableOpacity onPress={() => setSuccess('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <FontAwesome5 name="times" size={12} color="#4ADE80" />
          </TouchableOpacity>
        </View>
      ) : null}
      {error ? (
        <View style={[styles.banner, styles.bannerError]}>
          <FontAwesome5 name="exclamation-circle" size={14} color="#EF4444" />
          <Text style={[styles.bannerText, { color: '#B91C1C' }]}>{error}</Text>
          <TouchableOpacity onPress={() => setError('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <FontAwesome5 name="times" size={12} color="#F87171" />
          </TouchableOpacity>
        </View>
      ) : null}
    </>
  );

  const renderHeader = (title: string, subtitle: string, onBack: () => void, icon = 'calendar-plus') => (
    <View style={styles.pageHeader}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Retour">
        <FontAwesome5 name="arrow-left" size={14} color={styles.pageTitle.color as string} />
      </TouchableOpacity>
      <LinearGradient colors={['#4F46E5', '#9333EA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.headerIcon}>
        <FontAwesome5 name={icon as any} size={15} color="#FFFFFF" />
      </LinearGradient>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.pageTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.pageSubtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </View>
  );

  const renderStats = () => {
    const total = scheduled.length;
    return (
      <View style={styles.statsGrid}>
        {stats.map((s, i) => {
          const t = tone(s.toneKey);
          const active = filterStatus === s.filter;
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <TouchableOpacity
              key={s.label}
              style={[styles.statCard, i === 0 ? styles.statCardFull : styles.statCardHalf, active && { borderColor: s.ring, borderWidth: 2 }]}
              onPress={() => setFilterStatus(s.filter)}
              activeOpacity={0.85}
            >
              <View style={styles.statTop}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.statLabel} numberOfLines={1}>
                    {s.label}
                  </Text>
                  <View style={styles.statValueRow}>
                    <Text style={[styles.statValue, i > 0 && { color: t.fg }]}>{s.value}</Text>
                    {total > 0 ? (
                      <View style={[styles.statPct, { backgroundColor: t.bg }]}>
                        <Text style={[styles.statPctText, { color: t.fg }]}>{pct}%</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={[styles.statIcon, { backgroundColor: t.bg }]}>
                  <FontAwesome5 name={s.icon as any} size={13} color={t.fg} />
                </View>
              </View>
              {total > 0 ? (
                <View style={styles.statTrack}>
                  <LinearGradient
                    colors={s.bar as unknown as string[]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.statBar, { width: `${Math.min(pct, 100)}%` }]}
                  />
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderToolbar = () => (
    <View style={styles.toolbar}>
      {/* Row 1: search + Programmer */}
      <View style={styles.toolbarRow}>
        <View style={styles.searchBox}>
          <FontAwesome5 name="search" size={13} color={muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher par cours, lieu, classe..."
            placeholderTextColor="#94A3B8"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          {searchTerm.length > 0 ? (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <FontAwesome5 name="times-circle" size={14} color={muted} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity onPress={() => openCreate()} disabled={loading} activeOpacity={0.85}>
          <LinearGradient colors={['#4F46E5', '#9333EA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.newBtn, loading && { opacity: 0.5 }]}>
            <FontAwesome5 name="plus" size={13} color="#FFFFFF" />
            <Text style={styles.newBtnText}>Programmer</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Row 2: class + status filters */}
      <View style={styles.toolbarRow}>
        <SelectPill
          icon="users"
          value={filterClassId}
          title="Classe"
          options={[{ value: '', label: 'Toutes les classes' }, ...classes.map((c) => ({ value: String(c.id), label: className(c) }))]}
          onChange={setFilterClassId}
        />
        <SelectPill icon="filter" value={filterStatus} title="Statut" options={STATUS_FILTER_OPTIONS} onChange={setFilterStatus} />
      </View>

      {/* Row 3: past toggle, page size, layout, refresh */}
      <View style={styles.toolbarRow}>
        <TouchableOpacity style={styles.pastToggle} onPress={() => setShowPast((v) => !v)} activeOpacity={0.8}>
          <View style={[styles.checkbox, showPast && styles.checkboxOn]}>
            {showPast ? <FontAwesome5 name="check" size={8} color="#FFFFFF" /> : null}
          </View>
          <Text style={styles.pastToggleText} numberOfLines={1}>
            Inclure les passés
          </Text>
        </TouchableOpacity>
        <SelectPill
          icon="hashtag"
          grow={false}
          value={String(pageSize)}
          title="Éléments par page"
          options={PAGE_SIZE_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
          onChange={(v) => setPageSize(Number(v))}
        />
        <View style={styles.toggleWrap}>
          {(['grid', 'table'] as const).map((m) => (
            <TouchableOpacity key={m} style={[styles.toggleBtn, layout === m && styles.toggleBtnActive]} onPress={() => setLayout(m)}>
              <FontAwesome5 name={m === 'grid' ? 'th' : 'list'} size={13} color={layout === m ? '#4F46E5' : '#64748B'} />
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadData} disabled={loading} accessibilityLabel="Actualiser">
          {loading ? <ActivityIndicator size="small" color="#64748B" /> : <FontAwesome5 name="sync-alt" size={14} color="#64748B" />}
        </TouchableOpacity>
      </View>

      {filtered.length > 0 ? (
        <View style={styles.resultsRow}>
          <Text style={styles.resultsText}>
            <Text style={styles.resultsCount}>{filtered.length}</Text> {filtered.length === 1 ? 'cours trouvé' : 'cours trouvés'}
            {searchTerm ? (
              <Text>
                {' '}
                pour "<Text style={styles.resultsCount}>{searchTerm}</Text>"
              </Text>
            ) : null}
          </Text>
        </View>
      ) : null}
    </View>
  );

  const isOwner = (sc: ScheduledItem) => String(sc.professeurId) === String(professorId);

  const renderActions = (sc: ScheduledItem) => {
    const etat = sc.etatCoursProgramme;
    const reprog = etat === 'TERMINE' || etat === 'ANNULE';
    return (
      <View style={styles.cardActions}>
        {etat === 'PLANIFIE' ? <ActionBtn icon="play-circle" label="Démarrer" toneKey="green" grow onPress={() => setLauncherItem(sc)} /> : null}
        {etat === 'EN_COURS' ? (
          <>
            <ActionBtn icon="pause-circle" label="Terminer" toneKey="orange" grow onPress={() => handleEnd(sc.id)} />
            <ActionBtn icon="play-circle" label="Rejoindre" toneKey="indigo" solid grow onPress={() => handleJoin(sc)} />
          </>
        ) : null}
        {etat === 'PLANIFIE' || etat === 'EN_COURS' ? (
          <ActionBtn icon="times-circle" toneKey="redSoft" onPress={() => setConfirmCancelId(sc.id)} />
        ) : null}
        <ActionBtn icon="eye" label="Voir" toneKey="slate" onPress={() => setDetailItem(sc)} />
        <ActionBtn
          icon={reprog ? 'calendar-plus' : 'pen'}
          label={reprog ? 'Reprogrammer' : 'Modifier'}
          toneKey="indigo"
          onPress={() => openEdit(sc)}
        />
        {isOwner(sc) ? <ActionBtn icon="trash-alt" label="Supprimer" toneKey="red" onPress={() => setConfirmDeleteId(sc.id)} /> : null}
      </View>
    );
  };

  const renderGrid = () => (
    <View style={{ gap: 12 }}>
      {filtered.slice(0, pageSize).map((sc) => {
        const owner = isOwner(sc);
        const ownTone = tone(owner ? 'indigo' : 'amber');
        const classe = firstClassName(sc);
        const allClasses = classNamesOf(sc);
        return (
          <View key={sc.id} style={styles.card}>
            <View style={[styles.ownerBadge, { backgroundColor: ownTone.bg }]}>
              <FontAwesome5 name={owner ? 'user-check' : 'users'} size={10} color={ownTone.fg} />
              <Text style={[styles.ownerBadgeText, { color: ownTone.fg }]}>{owner ? 'Votre cours' : "Cours d'un autre professeur"}</Text>
            </View>

            <View style={styles.cardHeader}>
              <LinearGradient colors={['#6366F1', '#9333EA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(sc.cours?.titre)}</Text>
              </LinearGradient>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.cardTitle}>{sc.cours?.titre || (sc as any).titre || 'Cours sans titre'}</Text>
                {classe ? <Text style={styles.cardSub}>{classe}</Text> : null}
                {sc.lieu ? (
                  <View style={styles.metaRow}>
                    <FontAwesome5 name="map-marker-alt" size={10} color={styles.cardBody.color as string} />
                    <Text style={styles.cardBody} numberOfLines={2}>
                      {sc.lieu}
                    </Text>
                  </View>
                ) : null}
              </View>
              <StatusChip etat={sc.etatCoursProgramme} />
            </View>

            <View style={styles.cardDetails}>
              {sc.dateCoursPrevue ? (
                <View style={styles.metaRow}>
                  <FontAwesome5 name="calendar-alt" size={10} color={muted} />
                  <Text style={styles.metaText}>
                    Prévu: {fmtDate(sc.dateCoursPrevue)} à {fmtTime(sc.dateCoursPrevue)}
                  </Text>
                </View>
              ) : null}
              {sc.etatCoursProgramme !== 'PLANIFIE' && sc.dateDebutEffectif ? (
                <View style={styles.metaRow}>
                  <FontAwesome5 name="clock" size={10} color="#16A34A" />
                  <Text style={[styles.metaText, { color: '#16A34A' }]}>Début: {fmtTime(sc.dateDebutEffectif)}</Text>
                </View>
              ) : null}
              {sc.etatCoursProgramme === 'TERMINE' && sc.dateFinEffectif ? (
                <View style={styles.metaRow}>
                  <FontAwesome5 name="clock" size={10} color="#6B7280" />
                  <Text style={[styles.metaText, { color: '#6B7280' }]}>Fin: {fmtTime(sc.dateFinEffectif)}</Text>
                </View>
              ) : null}
              {allClasses ? (
                <View style={styles.metaRow}>
                  <FontAwesome5 name="users" size={10} color={muted} />
                  <Text style={styles.metaText}>{allClasses}</Text>
                </View>
              ) : null}
              {sc.description ? (
                <Text style={styles.cardDescription} numberOfLines={2}>
                  {sc.description}
                </Text>
              ) : null}
            </View>

            {renderActions(sc)}
          </View>
        );
      })}
    </View>
  );

  const renderTable = () => {
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const start = (currentPage - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);
    const maxVisible = 5;
    const startPage = Math.max(1, Math.min(currentPage - Math.floor(maxVisible / 2), totalPages - maxVisible + 1));
    const pages = Array.from({ length: Math.min(maxVisible, totalPages) }, (_, i) => startPage + i);
    return (
      <>
        <View style={styles.tableCard}>
          {items.map((sc, idx) => {
            const etat = sc.etatCoursProgramme;
            return (
              <View key={sc.id} style={[styles.tableRow, idx > 0 && styles.tableRowBorder]}>
                <View style={styles.tableRowTop}>
                  <LinearGradient colors={['#6366F1', '#A855F7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.avatarSm}>
                    <Text style={styles.avatarSmText}>{getInitials(sc.cours?.titre)}</Text>
                  </LinearGradient>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.tableTitle} numberOfLines={1}>
                      {sc.cours?.titre || 'Cours sans titre'}
                    </Text>
                    <Text style={styles.metaText} numberOfLines={1}>
                      {firstClassName(sc) || 'Classe non définie'}
                    </Text>
                  </View>
                  <StatusChip etat={etat} />
                </View>
                <View style={styles.tableMeta}>
                  <View style={styles.metaRow}>
                    <FontAwesome5 name="calendar-alt" size={10} color={muted} />
                    <Text style={styles.metaText}>{fmtDateTime(sc.dateCoursPrevue)}</Text>
                  </View>
                  {sc.lieu ? (
                    <View style={[styles.metaRow, { flexShrink: 1 }]}>
                      <FontAwesome5 name="map-marker-alt" size={10} color={muted} />
                      <Text style={styles.metaText} numberOfLines={1}>
                        {sc.lieu}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.tableActions}>
                  {etat === 'PLANIFIE' ? <ActionBtn icon="play-circle" toneKey="green" onPress={() => setLauncherItem(sc)} /> : null}
                  {etat === 'EN_COURS' ? <ActionBtn icon="pause-circle" toneKey="orange" onPress={() => handleEnd(sc.id)} /> : null}
                  {etat === 'PLANIFIE' || etat === 'EN_COURS' ? (
                    <ActionBtn icon="times-circle" toneKey="redSoft" onPress={() => setConfirmCancelId(sc.id)} />
                  ) : null}
                  <ActionBtn icon="eye" toneKey="slate" onPress={() => setDetailItem(sc)} />
                  <ActionBtn
                    icon={etat === 'TERMINE' || etat === 'ANNULE' ? 'calendar-plus' : 'pen'}
                    toneKey="indigo"
                    onPress={() => openEdit(sc)}
                  />
                </View>
              </View>
            );
          })}
        </View>
        {totalPages > 1 ? (
          <View style={styles.pagination}>
            <TouchableOpacity
              style={[styles.pageBtn, currentPage === 1 && { opacity: 0.4 }]}
              disabled={currentPage === 1}
              onPress={() => setCurrentPage((p) => p - 1)}
            >
              <FontAwesome5 name="chevron-left" size={12} color="#64748B" />
            </TouchableOpacity>
            {pages.map((p) => (
              <TouchableOpacity key={p} style={[styles.pageBtn, p === currentPage && styles.pageBtnActive]} onPress={() => setCurrentPage(p)}>
                <Text style={[styles.pageBtnText, p === currentPage && { color: '#FFFFFF' }]}>{p}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.pageBtn, currentPage === totalPages && { opacity: 0.4 }]}
              disabled={currentPage === totalPages}
              onPress={() => setCurrentPage((p) => p + 1)}
            >
              <FontAwesome5 name="chevron-right" size={12} color="#64748B" />
            </TouchableOpacity>
          </View>
        ) : null}
      </>
    );
  };

  const renderEmpty = () => {
    const filteredOut = !!searchTerm || filterStatus !== 'all';
    return (
      <View style={styles.emptyCard}>
        <View style={styles.emptyIcon}>
          <FontAwesome5 name="calendar-plus" size={28} color="#94A3B8" />
        </View>
        <Text style={styles.emptyTitle}>{filteredOut ? 'Aucun cours programmé trouvé' : 'Aucun cours programmé'}</Text>
        <Text style={styles.emptyText}>
          {filteredOut
            ? 'Essayez de modifier vos critères de recherche ou de filtrage.'
            : 'Commencez par programmer votre premier cours.'}
        </Text>
        {!filteredOut ? (
          <TouchableOpacity onPress={() => openCreate()} activeOpacity={0.85}>
            <LinearGradient colors={['#4F46E5', '#9333EA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.emptyBtn}>
              <FontAwesome5 name="plus" size={14} color="#FFFFFF" />
              <Text style={styles.newBtnText}>Programmer mon premier cours</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  // ── form view ──
  const renderForm = () => {
    const isPlanifie = form.etatCoursProgramme === 'PLANIFIE';
    const formTitle = isReprogramme ? 'Reprogrammer le Cours' : modalMode === 'create' ? 'Programmer un Cours' : 'Modifier la Programmation';
    const coursOptions = coursList.map((c) => ({ value: String(c.id), label: c.titre }));
    // Keep the current course visible in edit mode even if it isn't one of the professor's own.
    if (form.coursId && !coursOptions.some((o) => o.value === String(form.coursId))) {
      coursOptions.unshift({ value: String(form.coursId), label: selected?.cours?.titre || 'Cours' });
    }
    const classOptions = classes.map((c) => ({ value: String(c.id), label: className(c) }));
    if (form.classeId && !classOptions.some((o) => o.value === String(form.classeId))) {
      classOptions.unshift({ value: String(form.classeId), label: selected?.classes?.[0]?.nom || 'Classe' });
    }
    const selectedParticipants = participantsIds
      .map((id) => classParticipants.find((p) => p.id === id))
      .filter(Boolean) as Participant[];
    const blue = tone('blue');
    const amber = tone('amber');

    return (
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderHeader(formTitle, 'Planifiez et gérez les sessions de vos cours', closeForm, 'calendar-alt')}

        {submitError ? (
          <View style={[styles.banner, styles.bannerError]}>
            <FontAwesome5 name="exclamation-circle" size={14} color="#EF4444" />
            <Text style={[styles.bannerText, { color: '#B91C1C' }]}>{submitError}</Text>
          </View>
        ) : null}

        <View style={styles.formCard}>
          {/* Cours + État */}
          <SelectField
            icon="book-open"
            label="Cours *"
            placeholder="Sélectionnez un cours"
            value={form.coursId}
            options={coursOptions}
            onChange={(v) => setField('coursId', v)}
            disabled={modalMode === 'edit' || isReprogramme}
            error={errors.coursId}
          />
          <SelectField
            icon="heartbeat"
            label="État *"
            placeholder="Planifié"
            value={form.etatCoursProgramme}
            options={ETAT_OPTIONS}
            onChange={handleEtatChange}
          />

          {/* Classe + Capacité */}
          <SelectField
            icon="user-friends"
            label="Classe *"
            placeholder="Sélectionnez une classe"
            value={form.classeId}
            options={classOptions}
            onChange={(v) => setField('classeId', v)}
            error={errors.classeId}
          />
          <View style={styles.field}>
            <FieldLabel icon="hashtag" text="Capacité maximale" />
            <TextInput
              style={[styles.input, styles.inputText, errors.capaciteMax && styles.inputError]}
              value={form.capaciteMax}
              onChangeText={(v) => setField('capaciteMax', v)}
              placeholder="30 (optionnel)"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
            />
            <FieldError message={errors.capaciteMax} />
          </View>

          {/* Planning des dates */}
          <View style={styles.sectionBox}>
            <View style={styles.sectionTitleRow}>
              <FontAwesome5 name="clock" size={16} color="#4F46E5" />
              <Text style={styles.sectionTitle}>Planning des dates</Text>
            </View>
            <DateTimeInput
              icon="calendar-alt"
              iconColor="#2563EB"
              label="Date prévue *"
              value={form.dateCoursPrevue}
              onChange={(v) => setField('dateCoursPrevue', v)}
              error={errors.dateCoursPrevue}
            />
            {!isPlanifie ? (
              <>
                <DateTimeInput
                  icon="heartbeat"
                  iconColor="#16A34A"
                  label="Date début effectif"
                  value={form.dateDebutEffectif}
                  onChange={(v) => setField('dateDebutEffectif', v)}
                  minimumDate={parseServerDate(form.dateCoursPrevue) ?? new Date()}
                  clearable
                  error={errors.dateDebutEffectif}
                />
                <DateTimeInput
                  icon="book-open"
                  iconColor="#4B5563"
                  label="Date fin effectif"
                  value={form.dateFinEffectif}
                  onChange={(v) => setField('dateFinEffectif', v)}
                  minimumDate={parseServerDate(form.dateDebutEffectif) ?? new Date()}
                  clearable
                  error={errors.dateFinEffectif}
                />
              </>
            ) : null}
          </View>

          {/* Lieu */}
          <View style={styles.field}>
            <FieldLabel icon="map-marker-alt" text="Lieu *" />
            <TextInput
              style={[styles.input, styles.inputText, errors.lieu && styles.inputError]}
              value={form.lieu}
              onChangeText={(v) => setField('lieu', v)}
              placeholder="Salle 203, Bâtiment A"
              placeholderTextColor="#94A3B8"
            />
            <FieldError message={errors.lieu} />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <FieldLabel icon="file-alt" text="Description / Notes" />
            <TextInput
              style={[styles.input, styles.inputText, styles.textarea]}
              value={form.description}
              onChangeText={(v) => setField('description', v)}
              placeholder="Notes spéciales pour cette session..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Participants */}
          <View style={[styles.sectionBox, { marginBottom: 0 }]}>
            <View style={styles.sectionTitleRow}>
              <FontAwesome5 name="user-friends" size={14} color="#4F46E5" />
              <Text style={styles.label}>Participants (optionnel)</Text>
            </View>
            {!form.classeId ? (
              <View style={[styles.metaRow, { marginBottom: 10 }]}>
                <FontAwesome5 name="exclamation-circle" size={11} color="#D97706" />
                <Text style={[styles.metaText, { color: '#D97706', fontWeight: '600' }]}>Sélectionnez d'abord une classe</Text>
              </View>
            ) : (
              <Text style={[styles.metaText, { marginBottom: 10 }]}>
                <Text style={{ fontWeight: '700' }}>Aucune sélection :</Text> Tous les étudiants de la classe peuvent participer{'\n'}
                <Text style={{ fontWeight: '700' }}>Sélection spécifique :</Text> Seuls les participants sélectionnés peuvent participer
              </Text>
            )}
            {classParticipants.length > 0 ? (
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>
                  {participantsIds.length} / {classParticipants.length} sélectionnés
                </Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.input, styles.inputRow, (!form.classeId || loadingParticipants) && styles.inputDisabled]}
              disabled={!form.classeId || loadingParticipants}
              onPress={() => setParticipantsOpen(true)}
              activeOpacity={0.8}
            >
              <FontAwesome5 name="users" size={14} color={muted} />
              {loadingParticipants ? (
                <>
                  <ActivityIndicator size="small" color="#94A3B8" />
                  <Text style={[styles.inputText, styles.placeholder, { flex: 1 }]}>Chargement...</Text>
                </>
              ) : (
                <Text style={[styles.inputText, { flex: 1 }, participantsIds.length === 0 && styles.placeholder]} numberOfLines={1}>
                  {participantsIds.length > 0
                    ? `${participantsIds.length} participant${participantsIds.length > 1 ? 's' : ''} sélectionné${participantsIds.length > 1 ? 's' : ''}`
                    : 'Sélectionnez un ou plusieurs participants...'}
                </Text>
              )}
              <FontAwesome5 name="chevron-down" size={12} color={muted} />
            </TouchableOpacity>

            {loadingParticipants ? (
              <View style={[styles.metaRow, { marginTop: 8 }]}>
                <ActivityIndicator size="small" color="#4F46E5" />
                <Text style={[styles.metaText, { color: '#4F46E5' }]}>Chargement des participants...</Text>
              </View>
            ) : null}

            {selectedParticipants.length > 0 ? (
              <View style={{ marginTop: 14 }}>
                <Text style={[styles.label, { marginBottom: 8 }]}>Participants sélectionnés :</Text>
                <View style={styles.chipsWrap}>
                  {selectedParticipants.slice(0, 10).map((p) => (
                    <View key={p.id} style={styles.participantChip}>
                      <Text style={styles.participantChipText} numberOfLines={1}>
                        {p.name}
                        {p.email ? <Text style={{ fontWeight: '400' }}> ({p.email.split('@')[0]})</Text> : null}
                      </Text>
                    </View>
                  ))}
                  {participantsIds.length > 10 ? (
                    <View style={[styles.participantChip, styles.participantChipMore]}>
                      <Text style={[styles.participantChipText, { color: styles.metaText.color }]}>+{participantsIds.length - 10} autres</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}

            {form.classeId && classParticipants.length > 0 ? (
              participantsIds.length === 0 ? (
                <View style={[styles.infoBox, { backgroundColor: blue.bg, borderColor: '#BFDBFE' }]}>
                  <FontAwesome5 name="user-friends" size={13} color={blue.fg} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.infoTitle, { color: blue.fg }]}>Cours ouvert à tous les étudiants de la classe</Text>
                    <Text style={[styles.infoText, { color: blue.fg }]}>
                      Tous les {classParticipants.length} étudiants de la classe pourront rejoindre ce cours. Leur présence sera
                      suivie automatiquement.
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={[styles.infoBox, { backgroundColor: amber.bg, borderColor: '#FDE68A' }]}>
                  <FontAwesome5 name="exclamation-circle" size={13} color={amber.fg} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.infoTitle, { color: amber.fg }]}>Cours réservé aux participants sélectionnés</Text>
                    <Text style={[styles.infoText, { color: amber.fg }]}>
                      Seuls les {participantsIds.length} participants sélectionnés pourront rejoindre ce cours. Les autres étudiants
                      de la classe n'y auront pas accès.
                    </Text>
                  </View>
                </View>
              )
            ) : null}
          </View>
        </View>

        {/* Footer actions */}
        <View style={styles.formFooter}>
          <TouchableOpacity onPress={handleSubmit} disabled={saving} activeOpacity={0.85}>
            <LinearGradient colors={['#4F46E5', '#9333EA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.primaryBtn, saving && { opacity: 0.7 }]}>
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <FontAwesome5 name={modalMode === 'create' ? 'plus' : 'book-open'} size={14} color="#FFFFFF" />
              )}
              <Text style={styles.primaryBtnText}>
                {saving
                  ? modalMode === 'create'
                    ? 'Programmation...'
                    : 'Sauvegarde...'
                  : modalMode === 'create'
                    ? 'Programmer'
                    : 'Sauvegarder'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={closeForm}>
            <FontAwesome5 name="times" size={14} color={styles.secondaryBtnText.color as string} />
            <Text style={styles.secondaryBtnText}>Annuler</Text>
          </TouchableOpacity>
        </View>

        {/* Participants multi-select (web: MultiSelectDropdown) */}
        <BottomSheet visible={participantsOpen} onClose={() => setParticipantsOpen(false)} title="Participants">
          {classParticipants.length > 0 ? (
            <TouchableOpacity
              style={styles.selectAllRow}
              onPress={() =>
                setParticipantsIds(participantsIds.length === classParticipants.length ? [] : classParticipants.map((p) => p.id))
              }
            >
              <FontAwesome5 name="check" size={13} color="#4F46E5" />
              <Text style={styles.selectAllText}>
                {participantsIds.length === classParticipants.length ? 'Désélectionner tout' : 'Sélectionner tout'}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.sheetEmpty}>Aucun participant disponible</Text>
          )}
          <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
            {classParticipants.map((p) => {
              const on = participantsIds.includes(p.id);
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.participantOption, on && styles.participantOptionOn]}
                  onPress={() => setParticipantsIds((prev) => (prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]))}
                >
                  <View style={[styles.checkbox, on && styles.checkboxOn]}>
                    {on ? <FontAwesome5 name="check" size={8} color="#FFFFFF" /> : null}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.participantName} numberOfLines={1}>
                      {p.name}
                    </Text>
                    {p.email ? (
                      <Text style={styles.metaText} numberOfLines={1}>
                        {p.email}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </BottomSheet>
      </ScrollView>
    );
  };

  // ── detail sheet (web: CoursProgrammerViewModal, condensed) ──
  const renderDetail = () => {
    const sc = detailItem;
    if (!sc) return null;
    const etat = sc.etatCoursProgramme;
    const reprog = etat === 'TERMINE' || etat === 'ANNULE';
    const rows: [string, string][] = [
      ['Cours', sc.cours?.titre || 'Cours sans titre'],
      ['Statut', STATUS_LABELS[etat ?? ''] ?? etat ?? '—'],
      ['Date prévue', fmtDateTime(sc.dateCoursPrevue)],
      ['Début effectif', fmtDateTime(sc.dateDebutEffectif)],
      ['Fin effective', fmtDateTime(sc.dateFinEffectif)],
      ['Lieu', sc.lieu || '—'],
      ['Classes', classNamesOf(sc) || '—'],
      ['Capacité maximale', sc.capaciteMax != null ? String(sc.capaciteMax) : '—'],
      ['Participants', sc.participantsIds?.length ? String(sc.participantsIds.length) : 'Toute la classe'],
    ];
    if (sc.description) rows.push(['Description', sc.description]);
    return (
      <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
        {rows.map(([k, v]) => (
          <View key={k} style={styles.detailRow}>
            <Text style={styles.detailLabel}>{k}</Text>
            <Text style={styles.detailValue}>{v}</Text>
          </View>
        ))}
        <View style={[styles.cardActions, { borderTopWidth: 0, marginBottom: 8 }]}>
          {etat === 'PLANIFIE' ? (
            <ActionBtn
              icon="play-circle"
              label="Démarrer"
              toneKey="green"
              grow
              onPress={() => {
                setDetailItem(null);
                setLauncherItem(sc);
              }}
            />
          ) : null}
          {etat === 'EN_COURS' ? (
            <ActionBtn
              icon="pause-circle"
              label="Terminer"
              toneKey="orange"
              grow
              onPress={() => {
                setDetailItem(null);
                handleEnd(sc.id);
              }}
            />
          ) : null}
          {etat === 'PLANIFIE' || etat === 'EN_COURS' ? (
            <ActionBtn
              icon="times-circle"
              label="Annuler"
              toneKey="redSoft"
              grow
              onPress={() => {
                setDetailItem(null);
                setConfirmCancelId(sc.id);
              }}
            />
          ) : null}
          <ActionBtn icon={reprog ? 'calendar-plus' : 'pen'} label={reprog ? 'Reprogrammer' : 'Modifier'} toneKey="indigo" grow onPress={() => openEdit(sc)} />
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {view === 'form' ? (
        renderForm()
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#4F46E5" />}
        >
          {renderHeader('Programmation des Cours', 'Planifiez et gérez les sessions de vos cours', onClose)}
          {renderBanners()}
          {loading && scheduled.length === 0 ? (
            <LoadingSpinner label="Chargement des programmations..." />
          ) : (
            <>
              {/* Stats omitted: web hides them below its sm breakpoint
                  (phone width), same as the course list. */}
              {renderToolbar()}
              {filtered.length === 0 ? renderEmpty() : layout === 'grid' ? renderGrid() : renderTable()}
            </>
          )}
        </ScrollView>
      )}

      {/* Processing overlay (web: "Traitement en cours...") */}
      {busy ? (
        <View style={styles.busyOverlay}>
          <View style={styles.busyCard}>
            <ActivityIndicator size="small" color="#4F46E5" />
            <Text style={styles.busyText}>Traitement en cours...</Text>
          </View>
        </View>
      ) : null}

      <BottomSheet visible={!!detailItem} onClose={() => setDetailItem(null)} title="Détails de la programmation">
        {renderDetail()}
      </BottomSheet>

      <ConfirmDialog
        visible={!!confirmDeleteId}
        icon="trash-alt"
        title="Supprimer le cours programmé"
        message="Cette action est irréversible. Le cours programmé sera définitivement supprimé."
        cancelLabel="Annuler"
        confirmLabel="Supprimer"
        busyLabel="Suppression..."
        busy={busy}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
      />

      <ConfirmDialog
        visible={!!confirmCancelId}
        icon="times-circle"
        title="Annuler le cours programmé"
        message="Êtes-vous sûr de vouloir annuler ce cours ? Cette action est irréversible."
        cancelLabel="Retour"
        confirmLabel="Confirmer"
        busyLabel="Annulation..."
        busy={busy}
        onCancel={() => setConfirmCancelId(null)}
        onConfirm={() => {
          if (!confirmCancelId) return;
          const id = confirmCancelId;
          setConfirmCancelId(null);
          handleCancel(id, 'Annulé par le professeur');
        }}
      />

      <SessionModeSheet
        visible={!!launcherItem}
        coursTitle={launcherItem?.cours?.titre ?? ''}
        loading={launching}
        onCancel={() => (launching ? null : setLauncherItem(null))}
        onStart={handleLaunch}
      />
    </View>
  );
};

const SESSION_MODES: { key: SessionMode; icon: string; label: string; desc: string }[] = [
  { key: 'VIDEO', icon: 'video', label: 'Vidéo', desc: 'Caméra + micro + contenu du cours' },
  { key: 'AUDIO', icon: 'microphone', label: 'Audio', desc: 'Micro uniquement + contenu du cours' },
  { key: 'CONTENT_ONLY', icon: 'book-open', label: 'Contenu seul', desc: 'Partage de contenu sans audio/vidéo' },
];

/** Mirrors web's SessionLauncher.jsx — pick a live-session mode before starting the Jitsi call. */
const SessionModeSheet = ({
  visible,
  coursTitle,
  loading,
  onCancel,
  onStart,
}: {
  visible: boolean;
  coursTitle: string;
  loading: boolean;
  onCancel: () => void;
  onStart: (mode: SessionMode) => void;
}) => {
  const { styles } = useProgStyles();
  const [selectedMode, setSelectedMode] = useState<SessionMode>('VIDEO');
  return (
    <BottomSheet visible={visible} onClose={onCancel} title="Démarrer la session">
      <Text style={styles.launcherSubtitle} numberOfLines={1}>
        {coursTitle}
      </Text>
      <Text style={styles.launcherHint}>Choisissez le mode de la session en direct :</Text>
      {SESSION_MODES.map((m) => {
        const active = selectedMode === m.key;
        return (
          <TouchableOpacity
            key={m.key}
            style={[styles.launcherOption, active && styles.launcherOptionActive]}
            onPress={() => setSelectedMode(m.key)}
          >
            {active ? (
              <LinearGradient colors={['#4F46E5', '#9333EA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.launcherIconWrap}>
                <FontAwesome5 name={m.icon as any} size={16} color="#FFFFFF" />
              </LinearGradient>
            ) : (
              <View style={[styles.launcherIconWrap, { backgroundColor: '#94A3B8' }]}>
                <FontAwesome5 name={m.icon as any} size={16} color="#FFFFFF" />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.launcherOptionLabel}>{m.label}</Text>
              <Text style={styles.launcherOptionDesc}>{m.desc}</Text>
            </View>
            {active ? (
              <View style={styles.launcherCheck}>
                <FontAwesome5 name="check" size={10} color="#FFFFFF" />
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
      <View style={styles.launcherActions}>
        <TouchableOpacity style={[styles.secondaryBtn, { flex: 1, marginTop: 0 }]} onPress={onCancel} disabled={loading}>
          <Text style={styles.secondaryBtnText}>Annuler</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 2 }} onPress={() => onStart(selectedMode)} disabled={loading} activeOpacity={0.85}>
          <LinearGradient colors={['#4F46E5', '#9333EA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.primaryBtn, loading && { opacity: 0.7 }]}>
            {loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <FontAwesome5 name="play-circle" size={14} color="#FFFFFF" />}
            <Text style={styles.primaryBtnText}>{loading ? 'Démarrage...' : 'Démarrer'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>, isDark: boolean) => {
  // Web's slate palette
  const title = isDark ? '#F8FAFC' : '#0F172A'; // slate-900
  const label = isDark ? '#E2E8F0' : '#334155'; // slate-700
  const body = isDark ? '#CBD5E1' : '#475569'; // slate-600
  const sub = isDark ? '#94A3B8' : '#64748B'; // slate-500
  const card = isDark ? '#1E293B' : '#FFFFFF';
  const border = isDark ? '#334155' : '#F1F5F9'; // slate-100
  const input = isDark ? '#0F172A' : '#F8FAFC'; // slate-50
  const fieldBg = isDark ? '#0F172A' : '#FFFFFF';
  const inputBorder = isDark ? '#475569' : '#E2E8F0'; // slate-200
  const section = isDark ? '#172033' : '#F8FAFC'; // slate-50
  const shadow = {
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  };

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 180 },

    // Header
    pageHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
    backBtn: {
      width: 34,
      height: 34,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: card,
      borderWidth: 1,
      borderColor: inputBorder,
    },
    headerIcon: {
      padding: 8,
      borderRadius: 8,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    pageTitle: { fontSize: 18, fontWeight: '800', color: title, lineHeight: 22 },
    pageSubtitle: { fontSize: 12, color: sub },

    // Banners
    banner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    bannerText: { flex: 1, fontSize: 12 },
    bannerIndigo: { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' },
    bannerSuccess: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
    bannerError: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },

    // Stats
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    statCard: {
      backgroundColor: card,
      borderWidth: 1,
      borderColor: border,
      borderRadius: 12,
      padding: 12,
      ...shadow,
    },
    statCardFull: { width: '100%' },
    statCardHalf: { flexGrow: 1, flexBasis: '45%' },
    statTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    statLabel: { fontSize: 11, color: sub, fontWeight: '500', marginBottom: 4 },
    statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statValue: { fontSize: 20, fontWeight: '800', color: title },
    statPct: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 999 },
    statPctText: { fontSize: 10, fontWeight: '700' },
    statIcon: { padding: 7, borderRadius: 8 },
    statTrack: { marginTop: 8, height: 4, borderRadius: 999, backgroundColor: isDark ? '#334155' : '#F1F5F9', overflow: 'hidden' },
    statBar: { height: 4, borderRadius: 999 },

    // Toolbar
    toolbar: {
      backgroundColor: card,
      borderWidth: 1,
      borderColor: border,
      borderRadius: 12,
      padding: 12,
      gap: 12,
      marginBottom: 16,
      ...shadow,
    },
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
      paddingHorizontal: 12,
      height: 40,
    },
    searchInput: { flex: 1, fontSize: 14, color: title, paddingVertical: 0 },
    newBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      height: 40,
      borderRadius: 8,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    newBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
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
    selectPillText: { flexShrink: 1, fontSize: 12, color: title },
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
    toggleWrap: { flexDirection: 'row', backgroundColor: isDark ? '#0F172A' : '#F1F5F9', borderRadius: 8, padding: 2 },
    toggleBtn: { padding: 7, borderRadius: 6 },
    toggleBtnActive: { backgroundColor: card, ...shadow },
    refreshBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
    resultsRow: { borderTopWidth: 1, borderTopColor: border, paddingTop: 10 },
    resultsText: { fontSize: 12, color: sub },
    resultsCount: { fontWeight: '700', color: label },

    sheetOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    sheetOptionText: { flex: 1, fontSize: 15, color: colors.text, paddingRight: 8 },
    sheetOptionTextActive: { color: '#4F46E5', fontWeight: '700' },
    sheetEmpty: { fontSize: 13, color: sub, fontStyle: 'italic', paddingVertical: 12 },

    // Cards (grid)
    card: {
      backgroundColor: card,
      borderWidth: 1,
      borderColor: border,
      borderRadius: 16,
      padding: 16,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    ownerBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      marginBottom: 12,
    },
    ownerBadgeText: { fontSize: 11, fontWeight: '600' },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
    avatar: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
    cardTitle: { fontSize: 14, fontWeight: '800', color: title, lineHeight: 18 },
    cardSub: { fontSize: 12, color: sub, marginTop: 2 },
    cardBody: { flexShrink: 1, fontSize: 12, color: body },
    statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginLeft: 4 },
    statusChipText: { fontSize: 11, fontWeight: '600' },
    cardDetails: { gap: 6, marginBottom: 12 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    metaText: { flexShrink: 1, fontSize: 12, color: sub },
    cardDescription: { fontSize: 12, color: body, lineHeight: 18, marginTop: 4 },
    cardActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: border,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
    },
    actionBtnGrow: { flexGrow: 1, minWidth: 90 },
    actionBtnText: { fontSize: 12, fontWeight: '600' },

    // Table / list layout
    tableCard: {
      backgroundColor: card,
      borderWidth: 1,
      borderColor: border,
      borderRadius: 16,
      overflow: 'hidden',
      ...shadow,
    },
    tableRow: { padding: 12, gap: 8 },
    tableRowBorder: { borderTopWidth: 1, borderTopColor: border },
    tableRowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatarSm: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    avatarSmText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11 },
    tableTitle: { fontSize: 13, fontWeight: '700', color: title },
    tableMeta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 },
    tableActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6 },
    pagination: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 16 },
    pageBtn: { minWidth: 32, height: 32, paddingHorizontal: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    pageBtnActive: { backgroundColor: '#4F46E5' },
    pageBtnText: { fontSize: 13, fontWeight: '600', color: body },

    // Empty state
    emptyCard: {
      backgroundColor: card,
      borderWidth: 1,
      borderColor: border,
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
      ...shadow,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: isDark ? '#334155' : '#F1F5F9',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: title, marginBottom: 6, textAlign: 'center' },
    emptyText: { fontSize: 13, color: body, textAlign: 'center', marginBottom: 16 },
    emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },

    // Form
    formCard: {
      backgroundColor: card,
      borderWidth: 1,
      borderColor: border,
      borderRadius: 16,
      padding: 16,
      ...shadow,
    },
    field: { marginBottom: 16 },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    label: { fontSize: 14, fontWeight: '700', color: label },
    input: {
      backgroundColor: fieldBg,
      borderWidth: 1,
      borderColor: inputBorder,
      borderRadius: 12,
      paddingHorizontal: 14,
      minHeight: 48,
      paddingVertical: 12,
    },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    inputText: { flex: 1, fontSize: 15, color: title },
    placeholder: { color: '#94A3B8' },
    inputError: { borderColor: '#FCA5A5', backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : '#FEF2F2' },
    inputDisabled: { backgroundColor: isDark ? '#1E293B' : '#F3F4F6', opacity: 0.8 },
    textarea: { minHeight: 90, textAlignVertical: 'top' },
    fieldErrorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 6 },
    fieldErrorText: { flex: 1, fontSize: 13, color: '#DC2626' },
    sectionBox: {
      backgroundColor: section,
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
      borderWidth: isDark ? 1 : 0,
      borderColor: inputBorder,
    },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
    sectionTitle: { fontSize: 17, fontWeight: '700', color: isDark ? '#F1F5F9' : '#1E293B' },
    countPill: {
      alignSelf: 'flex-start',
      backgroundColor: fieldBg,
      borderWidth: 1,
      borderColor: inputBorder,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 4,
      marginBottom: 10,
    },
    countPillText: { fontSize: 13, color: body },
    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    participantChip: {
      maxWidth: '100%',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : '#E0E7FF',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(99,102,241,0.4)' : '#C7D2FE',
    },
    participantChipMore: { backgroundColor: isDark ? '#334155' : '#F1F5F9', borderColor: inputBorder },
    participantChipText: { fontSize: 12, fontWeight: '600', color: isDark ? '#C7D2FE' : '#3730A3' },
    infoBox: { flexDirection: 'row', gap: 8, borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 14 },
    infoTitle: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
    infoText: { fontSize: 12, lineHeight: 17 },
    selectAllRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    selectAllText: { fontSize: 14, fontWeight: '700', color: '#4F46E5' },
    participantOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 6,
      borderRadius: 8,
    },
    participantOptionOn: { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : '#EEF2FF' },
    participantName: { fontSize: 14, fontWeight: '600', color: title },
    formFooter: { marginTop: 16, gap: 4 },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 10,
      shadowColor: '#4F46E5',
      shadowOpacity: 0.25,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
    secondaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 13,
      borderRadius: 10,
      marginTop: 8,
      backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
    },
    secondaryBtnText: { color: isDark ? '#CBD5E1' : '#475569', fontWeight: '600', fontSize: 15 },

    // Detail
    detailRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
    detailLabel: { fontSize: 10, fontWeight: '700', color: sub, textTransform: 'uppercase', marginBottom: 2 },
    detailValue: { fontSize: 14, color: title },

    // Dialog
    dialogOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 16 },
    dialogCard: { width: '100%', maxWidth: 380, backgroundColor: card, borderRadius: 16, padding: 24 },
    dialogIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
    dialogTitle: { fontSize: 17, fontWeight: '800', color: title, textAlign: 'center', marginBottom: 8 },
    dialogMessage: { fontSize: 13, color: sub, textAlign: 'center', marginBottom: 24 },
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

    // Busy overlay
    busyOverlay: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(0,0,0,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    busyCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: card, borderRadius: 16, padding: 18 },
    busyText: { fontSize: 14, fontWeight: '600', color: label },

    // Session launcher
    launcherSubtitle: { fontSize: 15, fontWeight: '700', color: title, marginBottom: 2 },
    launcherHint: { fontSize: 12, color: sub, marginBottom: 14 },
    launcherOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: inputBorder,
      marginBottom: 8,
    },
    launcherOptionActive: { borderColor: '#4F46E5', backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : '#EEF2FF' },
    launcherIconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    launcherOptionLabel: { fontSize: 14, fontWeight: '700', color: title },
    launcherOptionDesc: { fontSize: 12, color: sub, marginTop: 2 },
    launcherCheck: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center' },
    launcherActions: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 12 },
  });
};

export default CoursProgrammerScreen;
