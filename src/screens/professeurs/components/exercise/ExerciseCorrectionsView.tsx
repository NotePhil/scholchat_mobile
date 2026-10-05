import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '../../../../components/ui';
import { useThemeColors } from '../../../../styles/theme';
import { useThemeStore } from '../../../../store/useThemeStore';
import {
  accederService,
  exerciseProgrammerService,
  participationService,
  publicationRightsService,
  questionService,
  reponseService,
  userService,
} from '../../../../services/api';
import { useUser } from '../../../../context/UserContext';
import { ClassEntity, ExerciseProgramme, Participation, Question, Reponse } from '../../../../types';
import { formatDate, serverDateMs } from '../../../../utils/dates';
import { questionEarned } from '../../../../utils/devoirs';

// LinearGradient via expo-linear-gradient (safe fallback to View if unavailable)
let LinearGradient: any;
try {
  LinearGradient = require('expo-linear-gradient').LinearGradient;
} catch {
  LinearGradient = ({ children, style, colors: c }: any) => (
    <View style={[style, { backgroundColor: c?.[0] }]}>{children}</View>
  );
}

export interface ExerciseCorrectionsViewProps {
  onBack: () => void;
}

/**
 * Port of web ExerciseCorrectionsContent.jsx (professor "corrections-exercise" tab):
 * gradient header with stats, programmation list (type filter + refresh + pagination),
 * and the correction panel for the selected programmation (mini stats, paginated
 * students, per-student overall grade + per-question manual grading).
 */

type ProgItem = ExerciseProgramme & { isOwn: boolean };

interface GradeInput {
  estCorrecte?: boolean;
  note?: string;
  appreciation?: string;
}

interface Student {
  id: string;
  nom: string;
  prenom: string;
  answers: Reponse[];
  participation?: Participation;
}

const STUDENT_PAGE_SIZE = 5;
const QUESTION_PAGE_SIZE = 3;
const PROG_PAGE_SIZE = 6;

const FILTER_OPTIONS = [
  { value: 'all', label: 'Tous les types' },
  { value: 'DEVOIR', label: 'Devoirs' },
  { value: 'EXERCICE', label: 'Exercices libres' },
];

/** Web Tailwind tints (light) with translucent dark-mode equivalents. */
type Tone = { bg: string; fg: string; bgDark: string; fgDark: string };
const TONES: Record<string, Tone> = {
  amberState: { bg: '#FFFBEB', fg: '#D97706', bgDark: 'rgba(217,119,6,0.18)', fgDark: '#FCD34D' },
  blue: { bg: '#EFF6FF', fg: '#2563EB', bgDark: 'rgba(37,99,235,0.18)', fgDark: '#93C5FD' },
  orange: { bg: '#FFF7ED', fg: '#C2410C', bgDark: 'rgba(194,65,12,0.2)', fgDark: '#FDBA74' },
  purple: { bg: '#F5F3FF', fg: '#7C3AED', bgDark: 'rgba(124,58,237,0.2)', fgDark: '#C4B5FD' },
  green: { bg: '#F0FDF4', fg: '#16A34A', bgDark: 'rgba(22,163,74,0.18)', fgDark: '#86EFAC' },
  gray: { bg: '#F9FAFB', fg: '#6B7280', bgDark: 'rgba(148,163,184,0.15)', fgDark: '#CBD5E1' },
  scoreGreen: { bg: '#DCFCE7', fg: '#15803D', bgDark: 'rgba(34,197,94,0.18)', fgDark: '#86EFAC' },
  scoreYellow: { bg: '#FEF9C3', fg: '#A16207', bgDark: 'rgba(234,179,8,0.18)', fgDark: '#FDE047' },
  scoreRed: { bg: '#FEE2E2', fg: '#B91C1C', bgDark: 'rgba(239,68,68,0.18)', fgDark: '#FCA5A5' },
  indigo: { bg: '#E0E7FF', fg: '#4338CA', bgDark: 'rgba(99,102,241,0.2)', fgDark: '#A5B4FC' },
  amber: { bg: '#FFFBEB', fg: '#B45309', bgDark: 'rgba(245,158,11,0.15)', fgDark: '#FCD34D' },
};

const ETAT_CONFIG: Record<string, { tone: keyof typeof TONES; label: string }> = {
  EN_COURS: { tone: 'amberState', label: 'En cours' },
  SOUMIS: { tone: 'blue', label: 'Soumis' },
  EN_ATTENTE_CORRECTION: { tone: 'orange', label: 'À corriger' },
  CORRIGE: { tone: 'purple', label: 'Corrigé' },
  VALIDE: { tone: 'green', label: 'Validé' },
};

const fmtDate = (d?: string | null) =>
  d ? formatDate(d, { day: '2-digit', month: 'short' }) : '—';

const errMsg = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

// ─── Styles hook ─────────────────────────────────────────────────────────────

const useCorrStyles = () => {
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

const EtatBadge = ({ etat }: { etat: string }) => {
  const { styles, tone } = useCorrStyles();
  const cfg = ETAT_CONFIG[etat];
  const t = tone(cfg?.tone ?? 'gray');
  return (
    <View style={[styles.etatBadge, { backgroundColor: t.bg, borderColor: `${t.fg}4D` }]}>
      <Text style={[styles.etatBadgeText, { color: t.fg }]}>{cfg?.label ?? etat}</Text>
    </View>
  );
};

const PagerBtn = ({ label, onPress, disabled, left }: { label: string; onPress: () => void; disabled: boolean; left?: boolean }) => {
  const { styles, muted } = useCorrStyles();
  return (
    <TouchableOpacity style={[styles.pagerBtn, disabled && { opacity: 0.4 }]} onPress={onPress} disabled={disabled}>
      {left ? <FontAwesome5 name="chevron-left" size={9} color={muted} /> : null}
      <Text style={styles.pagerBtnText}>{label}</Text>
      {!left ? <FontAwesome5 name="chevron-right" size={9} color={muted} /> : null}
    </TouchableOpacity>
  );
};

/** Compact select pill (web's small antd <Select>) that opens a bottom sheet. */
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
  const { styles, muted } = useCorrStyles();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) ?? options[0];
  return (
    <>
      <TouchableOpacity style={[styles.selectPill, { flex: 1 }]} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <FontAwesome5 name={icon as any} size={11} color={muted} />
        <Text style={styles.selectPillText} numberOfLines={1}>
          {selected?.label}
        </Text>
        <FontAwesome5 name="chevron-down" size={10} color={muted} />
      </TouchableOpacity>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={title}>
        <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
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

const SaveButton = ({
  label,
  saving,
  disabled,
  onPress,
  done,
}: {
  label: string;
  saving: boolean;
  disabled?: boolean;
  onPress: () => void;
  done: boolean;
}) => {
  const { styles } = useCorrStyles();
  return (
    <TouchableOpacity
      style={[styles.saveBtn, (disabled || saving) && { opacity: disabled ? 0.45 : 0.75 }]}
      onPress={onPress}
      disabled={disabled || saving}
      activeOpacity={0.85}
    >
      {saving ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <FontAwesome5 name={done ? 'check' : 'save'} size={12} color="#FFFFFF" />
      )}
      <Text style={styles.saveBtnText}>{done ? 'Sauvegardé' : label}</Text>
    </TouchableOpacity>
  );
};

// ─── Single programmation correction view ────────────────────────────────────

const ProgrammationCorrections = ({
  prog,
  notify,
}: {
  prog: ProgItem;
  notify: (type: 'success' | 'error', text: string) => void;
}) => {
  const { styles, tone, muted, isDark } = useCorrStyles();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Reponse[]>([]);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [gradeInputs, setGradeInputs] = useState<Record<string, GradeInput>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [studentPage, setStudentPage] = useState(1);
  const [questionPages, setQuestionPages] = useState<Record<string, number>>({});

  /** Same 3-step fetch as the web's loadData(). `silent` keeps current content visible while refreshing. */
  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [freshProg, freshParticipations] = await Promise.all([
          exerciseProgrammerService.getById(prog.id).catch(() => prog as ExerciseProgramme),
          participationService.getByExerciseProgramme(prog.id).catch(() => prog.participations || []),
        ]);
        const parts = Array.isArray(freshParticipations) ? freshParticipations : [];

        const exerciseId = freshProg?.exerciseId;
        let resolvedQuestions: Question[] = [];
        if (exerciseId) {
          resolvedQuestions = await questionService.getByExercise(exerciseId).catch(() => freshProg.questions || []);
        } else {
          resolvedQuestions = freshProg?.questions || [];
        }
        if (!Array.isArray(resolvedQuestions)) resolvedQuestions = [];

        const allAnswers: Reponse[] = [];
        const participantIds = [...new Set(parts.map((p) => p.utilisateurId).filter(Boolean) as string[])];
        if (participantIds.length > 0) {
          const qIds = new Set(resolvedQuestions.map((q) => q.id));
          await Promise.all(
            participantIds.map(async (uid) => {
              const userAnswers = await reponseService.getByUser(uid).catch(() => [] as Reponse[]);
              (userAnswers || [])
                .filter((a) => qIds.size === 0 || qIds.has(a.questionId as string))
                .forEach((a) => allAnswers.push(a));
            })
          );
        }
        setQuestions(resolvedQuestions);
        setAnswers(allAnswers);
        setParticipations(parts);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prog.id]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Build student map (answers first, then participations — like the web)
  const studentMap: Record<string, Student> = {};
  answers.forEach((a) => {
    const uid = String(a.utilisateurId);
    if (!studentMap[uid]) {
      studentMap[uid] = { id: uid, nom: a.utilisateurNom || '', prenom: a.utilisateurPrenom || '', answers: [] };
    }
    studentMap[uid].answers.push(a);
  });
  participations.forEach((p) => {
    const uid = String(p.utilisateurId);
    if (!studentMap[uid]) {
      studentMap[uid] = { id: uid, nom: p.utilisateurNom || '', prenom: p.utilisateurPrenom || '', answers: [] };
    }
    studentMap[uid].participation = p;
  });
  const students = Object.values(studentMap);
  const maxPoints = questions.reduce((s, q) => s + (q.points || 1), 0);
  // Awarded points per question (partial credit "1.5/2" counts), else full/zero from the verdict —
  // same rule as web and as the student/parent copy (utils/devoirs questionEarned).
  const getScore = (student: Student) => {
    const total = student.answers.reduce((s, a) => {
      const q = questions.find((qq) => qq.id === a.questionId);
      return q ? s + (questionEarned(q, a as Reponse) ?? 0) : s;
    }, 0);
    return Math.round(total * 100) / 100;
  };

  const setInput = (key: string, field: keyof GradeInput, value: any) =>
    setGradeInputs((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  const saveGrade = async (studentId: string, questionId: string) => {
    const key = `${studentId}-${questionId}`;
    const input = gradeInputs[key];
    if (!input) return;
    const max = questions.find((q) => q.id === questionId)?.points || 1;
    // Store the per-question mark as "earned/max"; a bare verdict gives full or zero points (same as web).
    let note = (input.note || '').toString().trim().replace(',', '.');
    if (note && !note.includes('/')) note = `${note}/${max}`;
    if (!note && input.estCorrecte !== undefined) note = `${input.estCorrecte ? max : 0}/${max}`;
    const earned = note ? parseFloat(note.split('/')[0]) : NaN;
    const estCorrecte = input.estCorrecte !== undefined ? input.estCorrecte : Number.isNaN(earned) ? undefined : earned > 0;
    setSaving(key);
    try {
      await reponseService.update({ utilisateurId: studentId, questionId, ...input, note: note || undefined, estCorrecte });
      setSaved((prev) => new Set([...prev, key]));
      await loadData(true);
    } catch {
      notify('error', 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(null);
    }
  };

  const saveOverall = async (student: Student) => {
    const key = `overall-${student.id}`;
    const input = gradeInputs[key] || {};
    setSaving(key);
    try {
      await participationService.update({
        utilisateurId: student.id,
        exerciseProgrammerId: prog.id,
        note: input.note || `${getScore(student)}/${maxPoints}`,
        appreciation: input.appreciation || '',
        etatSoumission: 'CORRIGE',
      });
      setSaved((prev) => new Set([...prev, key]));
      notify('success', 'Note globale sauvegardée');
      await loadData(true);
    } catch {
      notify('error', 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.panelLoading}>
        <ActivityIndicator size="small" color="#7C3AED" />
      </View>
    );
  }

  if (students.length === 0) {
    return (
      <View style={styles.panelEmpty}>
        <FontAwesome5 name="users" size={36} color={isDark ? '#475569' : '#D1D5DB'} />
        <Text style={styles.panelEmptyText}>Aucune soumission pour cette programmation</Text>
      </View>
    );
  }

  const pending = students.filter((s) => ['SOUMIS', 'EN_ATTENTE_CORRECTION'].includes(s.participation?.etatSoumission ?? '')).length;
  const corrected = students.filter((s) => s.participation?.etatSoumission === 'CORRIGE').length;
  const totalStudentPages = Math.ceil(students.length / STUDENT_PAGE_SIZE);
  const paginatedStudents = students.slice((studentPage - 1) * STUDENT_PAGE_SIZE, studentPage * STUDENT_PAGE_SIZE);
  const getQuestionPage = (sid: string) => questionPages[sid] || 1;
  const setQuestionPage = (sid: string, page: number) => setQuestionPages((prev) => ({ ...prev, [sid]: page }));
  const totalQuestionPages = Math.ceil(questions.length / QUESTION_PAGE_SIZE);
  const paginatedQuestions = (sid: string) => {
    const page = getQuestionPage(sid);
    return questions.slice((page - 1) * QUESTION_PAGE_SIZE, page * QUESTION_PAGE_SIZE);
  };

  const miniStats: { label: string; value: number; tone: keyof typeof TONES }[] = [
    { label: 'Participants', value: students.length, tone: 'blue' },
    { label: 'À corriger', value: pending, tone: 'orange' },
    { label: 'Corrigés', value: corrected, tone: 'purple' },
  ];

  const green = tone('green');
  const red = tone('scoreRed');
  const purple = tone('purple');
  const indigo = tone('indigo');

  return (
    <View>
      {/* Mini stats */}
      <View style={styles.miniStats}>
        {miniStats.map((s) => {
          const t = tone(s.tone);
          return (
            <View key={s.label} style={[styles.miniStat, { backgroundColor: t.bg, borderColor: `${t.fg}33` }]}>
              <Text style={[styles.miniStatValue, { color: t.fg }]}>{s.value}</Text>
              <Text style={styles.miniStatLabel} numberOfLines={1}>
                {s.label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Students */}
      <View style={{ gap: 8 }}>
        {paginatedStudents.map((student) => {
          const score = getScore(student);
          const pct = maxPoints > 0 ? Math.round((score / maxPoints) * 100) : 0;
          const isExpanded = expandedStudent === student.id;
          const etat = student.participation?.etatSoumission;
          const scoreTone = tone(pct >= 70 ? 'scoreGreen' : pct >= 40 ? 'scoreYellow' : 'scoreRed');
          const overallKey = `overall-${student.id}`;
          const qPage = getQuestionPage(student.id);
          return (
            <View key={student.id} style={styles.studentCard}>
              <TouchableOpacity
                style={styles.studentHeader}
                onPress={() => setExpandedStudent(isExpanded ? null : student.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.studentAvatar, { backgroundColor: tone('blue').bg }]}>
                  <FontAwesome5 name="user" size={14} color={tone('blue').fg} solid />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <Text style={styles.studentName} numberOfLines={1}>
                    {`${student.prenom} ${student.nom}`.trim() || 'Élève'}
                  </Text>
                  {etat ? <EtatBadge etat={etat} /> : null}
                </View>
                <View style={styles.studentRight}>
                  <View style={[styles.scorePill, { backgroundColor: scoreTone.bg }]}>
                    <Text style={[styles.scorePillText, { color: scoreTone.fg }]}>
                      {score}/{maxPoints}
                    </Text>
                  </View>
                  <Text style={styles.answeredText}>
                    {student.answers.length}/{questions.length}
                  </Text>
                  <FontAwesome5 name={isExpanded ? 'chevron-up' : 'chevron-down'} size={12} color={muted} />
                </View>
              </TouchableOpacity>

              {isExpanded ? (
                <View style={styles.studentBody}>
                  {/* Overall grade */}
                  <View style={styles.overallBox}>
                    <View style={styles.rowCenter}>
                      <FontAwesome5 name="award" size={14} color="#F59E0B" />
                      <Text style={styles.overallTitle}>Note globale</Text>
                    </View>
                    <View style={styles.inputRow}>
                      <TextInput
                        style={[styles.smallInput, { width: 90 }]}
                        placeholder={`${score}/${maxPoints}`}
                        placeholderTextColor={muted}
                        value={gradeInputs[overallKey]?.note || ''}
                        onChangeText={(v) => setInput(overallKey, 'note', v)}
                      />
                      <TextInput
                        style={[styles.smallInput, { flex: 1 }]}
                        placeholder="Appréciation générale..."
                        placeholderTextColor={muted}
                        value={gradeInputs[overallKey]?.appreciation || ''}
                        onChangeText={(v) => setInput(overallKey, 'appreciation', v)}
                      />
                    </View>
                    <SaveButton
                      label="Sauvegarder"
                      saving={saving === overallKey}
                      done={saved.has(overallKey)}
                      onPress={() => saveOverall(student)}
                    />
                    {student.participation?.note ? (
                      <Text style={styles.currentText}>
                        Actuel : {student.participation.note}
                        {student.participation.appreciation ? ` — "${student.participation.appreciation}"` : ''}
                      </Text>
                    ) : null}
                  </View>

                  {/* Per-question with pagination */}
                  {paginatedQuestions(student.id).map((q, idx) => {
                    const globalIdx = (qPage - 1) * QUESTION_PAGE_SIZE + idx;
                    const answer = student.answers.find((a) => a.questionId === q.id);
                    const gradeKey = `${student.id}-${q.id}`;
                    const isAutoType = ['QCM', 'VRAI_FAUX'].includes(q.typeQuestion || '');
                    const correctChoices = (q.choixReponses || []).filter((c) => c.estCorrect);
                    const expectedAnswer =
                      correctChoices.length > 0 ? correctChoices.map((c) => c.texte).join(' / ') : q.reponse || null;
                    const estCorrecte = answer?.estCorrecte ?? null;
                    const needsGrading = !!answer && estCorrecte === null;
                    const alreadyGraded = !!answer && estCorrecte !== null;
                    let borderColor = isDark ? '#334155' : '#E5E7EB';
                    if (estCorrecte === true) borderColor = isDark ? '#15803D' : '#86EFAC';
                    if (estCorrecte === false) borderColor = isDark ? '#B91C1C' : '#FCA5A5';
                    if (needsGrading) borderColor = isDark ? '#B45309' : '#FCD34D';
                    const headerBg = needsGrading
                      ? tone('amber').bg
                      : alreadyGraded && estCorrecte
                        ? green.bg
                        : alreadyGraded
                          ? tone('scoreRed').bg
                          : isDark
                            ? '#172033'
                            : '#F9FAFB';
                    const input = gradeInputs[gradeKey];
                    const pts = q.points || 1;
                    return (
                      <View key={q.id} style={[styles.questionCard, { borderColor }]}>
                        {/* Question header */}
                        <View style={[styles.questionHeader, { borderBottomColor: borderColor, backgroundColor: headerBg }]}>
                          <View style={styles.qTop}>
                            <View style={styles.qNumber}>
                              <Text style={styles.qNumberText}>{globalIdx + 1}</Text>
                            </View>
                            <Text style={styles.qTitle}>{q.intitule}</Text>
                            {estCorrecte === true ? <FontAwesome5 name="check-circle" size={15} color="#22C55E" solid /> : null}
                            {estCorrecte === false ? <FontAwesome5 name="exclamation-circle" size={15} color="#EF4444" /> : null}
                            {needsGrading ? <FontAwesome5 name="clock" size={15} color="#F59E0B" /> : null}
                          </View>
                          <View style={styles.qChips}>
                            <View style={styles.ptsChip}>
                              <Text style={styles.ptsChipText}>
                                {pts} pt{pts > 1 ? 's' : ''}
                              </Text>
                            </View>
                            <View style={[styles.ptsChip, { backgroundColor: indigo.bg }]}>
                              <Text style={[styles.ptsChipText, { color: indigo.fg }]}>{q.typeQuestion}</Text>
                            </View>
                          </View>
                        </View>

                        <View style={styles.questionBody}>
                          {/* Expected answer — always shown */}
                          <View style={styles.answerRow}>
                            <Text style={[styles.answerLabel, { color: expectedAnswer ? green.fg : muted }]}>Réponse attendue</Text>
                            {expectedAnswer ? (
                              <Text
                                style={[
                                  styles.answerValue,
                                  { backgroundColor: green.bg, color: green.fg, borderColor: isDark ? '#166534' : '#BBF7D0', borderWidth: 1 },
                                ]}
                              >
                                {expectedAnswer}
                              </Text>
                            ) : (
                              <Text style={styles.italicMuted}>Non définie</Text>
                            )}
                          </View>

                          {/* Student answer */}
                          {answer ? (
                            <View style={styles.answerRow}>
                              <Text style={styles.answerLabel}>Réponse élève</Text>
                              <Text
                                style={[
                                  styles.answerValue,
                                  estCorrecte === true
                                    ? { backgroundColor: green.bg, color: green.fg }
                                    : estCorrecte === false
                                      ? { backgroundColor: tone('scoreRed').bg, color: red.fg }
                                      : styles.answerNeutral,
                                ]}
                              >
                                {answer.reponseUtilisateur}
                              </Text>
                            </View>
                          ) : (
                            <Text style={styles.italicMuted}>Aucune réponse soumise</Text>
                          )}

                          {/* Existing grade/comment */}
                          {answer?.note ? (
                            <View style={styles.answerRow}>
                              <Text style={styles.answerLabel}>Note actuelle</Text>
                              <View style={styles.currentNoteRow}>
                                <View style={[styles.ptsChip, { backgroundColor: purple.bg }]}>
                                  <Text style={[styles.ptsChipText, { color: purple.fg }]}>{answer.note}</Text>
                                </View>
                                {answer.appreciation ? (
                                  <Text style={[styles.italicMuted, { flexShrink: 1 }]}>"{answer.appreciation}"</Text>
                                ) : null}
                              </View>
                            </View>
                          ) : null}

                          {/* Manual grading panel — QCM / Vrai-Faux are auto-graded on submission but can be overridden */}
                          {answer ? (
                            <View style={styles.gradingPanel}>
                              <View style={styles.rowCenter}>
                                <FontAwesome5
                                  name={needsGrading ? 'exclamation-triangle' : 'pen'}
                                  size={11}
                                  color={tone('orange').fg}
                                />
                                <Text style={[styles.gradingTitle, { color: tone('orange').fg }]}>
                                  {needsGrading
                                    ? 'Correction manuelle requise'
                                    : isAutoType
                                      ? 'Corrigé automatiquement — modifier'
                                      : 'Modifier la correction'}
                                </Text>
                              </View>
                              <View style={styles.inputRow}>
                                <TouchableOpacity
                                  style={[
                                    styles.verdictBtn,
                                    input?.estCorrecte === true
                                      ? { backgroundColor: '#22C55E', borderColor: '#22C55E' }
                                      : { borderColor: isDark ? '#166534' : '#86EFAC' },
                                  ]}
                                  onPress={() => setInput(gradeKey, 'estCorrecte', true)}
                                >
                                  <FontAwesome5 name="check" size={11} color={input?.estCorrecte === true ? '#FFFFFF' : green.fg} />
                                  <Text style={[styles.verdictText, { color: input?.estCorrecte === true ? '#FFFFFF' : green.fg }]}>
                                    Correct
                                  </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[
                                    styles.verdictBtn,
                                    input?.estCorrecte === false
                                      ? { backgroundColor: '#EF4444', borderColor: '#EF4444' }
                                      : { borderColor: isDark ? '#991B1B' : '#FCA5A5' },
                                  ]}
                                  onPress={() => setInput(gradeKey, 'estCorrecte', false)}
                                >
                                  <FontAwesome5 name="times" size={11} color={input?.estCorrecte === false ? '#FFFFFF' : red.fg} />
                                  <Text style={[styles.verdictText, { color: input?.estCorrecte === false ? '#FFFFFF' : red.fg }]}>
                                    Incorrect
                                  </Text>
                                </TouchableOpacity>
                              </View>
                              <View style={styles.inputRow}>
                                <TextInput
                                  style={[styles.smallInput, { width: 90 }]}
                                  placeholder={`Note (/${pts})`}
                                  placeholderTextColor={muted}
                                  value={input?.note || ''}
                                  onChangeText={(v) => setInput(gradeKey, 'note', v)}
                                />
                                <TextInput
                                  style={[styles.smallInput, { flex: 1 }]}
                                  placeholder="Commentaire..."
                                  placeholderTextColor={muted}
                                  value={input?.appreciation || ''}
                                  onChangeText={(v) => setInput(gradeKey, 'appreciation', v)}
                                />
                              </View>
                              <SaveButton
                                label="Sauver"
                                saving={saving === gradeKey}
                                done={saved.has(gradeKey)}
                                disabled={input?.estCorrecte === undefined && !input?.note}
                                onPress={() => saveGrade(student.id, q.id)}
                              />
                            </View>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}

                  {/* Question pagination */}
                  {totalQuestionPages > 1 ? (
                    <View style={styles.pagerRow}>
                      <PagerBtn
                        left
                        label="Préc."
                        disabled={qPage === 1}
                        onPress={() => setQuestionPage(student.id, Math.max(1, qPage - 1))}
                      />
                      <Text style={styles.pagerText}>
                        Q {(qPage - 1) * QUESTION_PAGE_SIZE + 1}–{Math.min(qPage * QUESTION_PAGE_SIZE, questions.length)} /{' '}
                        {questions.length}
                      </Text>
                      <PagerBtn
                        label="Suiv."
                        disabled={qPage === totalQuestionPages}
                        onPress={() => setQuestionPage(student.id, Math.min(totalQuestionPages, qPage + 1))}
                      />
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      {/* Student pagination */}
      {totalStudentPages > 1 ? (
        <View style={[styles.pagerRow, { marginTop: 12 }]}>
          <PagerBtn
            left
            label="Précédent"
            disabled={studentPage === 1}
            onPress={() => {
              setStudentPage((p) => Math.max(1, p - 1));
              setExpandedStudent(null);
            }}
          />
          <Text style={[styles.pagerText, { flexShrink: 1, textAlign: 'center' }]}>
            Page {studentPage} / {totalStudentPages} · {students.length} élève{students.length > 1 ? 's' : ''}
          </Text>
          <PagerBtn
            label="Suivant"
            disabled={studentPage === totalStudentPages}
            onPress={() => {
              setStudentPage((p) => Math.min(totalStudentPages, p + 1));
              setExpandedStudent(null);
            }}
          />
        </View>
      ) : null}
    </View>
  );
};

// ─── Programmation list ──────────────────────────────────────────────────────

const ProgList = ({
  filtered,
  selectedProgId,
  onSelect,
  filterType,
  setFilterType,
  onRefresh,
}: {
  filtered: ProgItem[];
  selectedProgId: string | null;
  onSelect: (id: string) => void;
  filterType: string;
  setFilterType: (v: string) => void;
  onRefresh: () => void;
}) => {
  const { styles, tone, muted } = useCorrStyles();
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(filtered.length / PROG_PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PROG_PAGE_SIZE, page * PROG_PAGE_SIZE);
  const amber = tone('amber');

  useEffect(() => {
    setPage(1);
  }, [filterType]);

  return (
    <View style={styles.card}>
      <View style={styles.cardTitleRow}>
        <Text style={styles.cardTitle}>Programmations</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} accessibilityLabel="Actualiser">
          <FontAwesome5 name="sync-alt" size={13} color={muted} />
        </TouchableOpacity>
      </View>
      <View style={styles.filterRow}>
        <SelectPill icon="filter" value={filterType} options={FILTER_OPTIONS} onChange={setFilterType} title="Type d'assignation" />
      </View>
      <View>
        {paginated.map((prog, i) => {
          const active = selectedProgId === prog.id;
          const isDevoir = prog.typeAssignation === 'DEVOIR';
          return (
            <TouchableOpacity
              key={prog.id}
              style={[styles.progItem, i > 0 && styles.progItemDivider, active && styles.progItemActive]}
              onPress={() => onSelect(prog.id)}
              activeOpacity={0.7}
            >
              <View style={styles.rowCenter}>
                <FontAwesome5 name={isDevoir ? 'file-alt' : 'book-open'} size={12} color={isDevoir ? '#9333EA' : '#2563EB'} />
                <Text style={styles.progName} numberOfLines={1}>
                  {prog.nom || 'Exercice'}
                </Text>
                {!prog.isOwn ? (
                  <View style={[styles.otherBadge, { backgroundColor: amber.bg, borderColor: `${amber.fg}33` }]}>
                    <Text style={[styles.otherBadgeText, { color: amber.fg }]}>Autre prof.</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.progMeta}>{fmtDate(prog.dateExoPrevue)}</Text>
              {prog.classesDiffusees && prog.classesDiffusees.length > 0 ? (
                <Text style={styles.progMeta} numberOfLines={1}>
                  {prog.classesDiffusees.map((c: any) => c.nom).join(', ')}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
        {paginated.length === 0 ? <Text style={styles.listEmpty}>Aucune programmation</Text> : null}
      </View>
      {totalPages > 1 ? (
        <View style={styles.listPager}>
          <PagerBtn left label="Préc." disabled={page === 1} onPress={() => setPage((p) => Math.max(1, p - 1))} />
          <Text style={styles.pagerText}>
            {page} / {totalPages}
          </Text>
          <PagerBtn label="Suiv." disabled={page === totalPages} onPress={() => setPage((p) => Math.min(totalPages, p + 1))} />
        </View>
      ) : null}
    </View>
  );
};

// ─── Main page ───────────────────────────────────────────────────────────────

export const ExerciseCorrectionsView = ({ onBack }: ExerciseCorrectionsViewProps) => {
  const { styles, tone, isDark } = useCorrStyles();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const userId = user?.userId;
  const [programmations, setProgrammations] = useState<ProgItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProgId, setSelectedProgId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState('all');
  const [professorName, setProfessorName] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const panelY = useRef(0);
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selectedProgId;

  const notify = useCallback((type: 'success' | 'error', text: string) => setToast({ type, text }), []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback(
    async (pull = false) => {
      if (!userId) {
        setLoading(false);
        return;
      }
      if (pull) setRefreshing(true);
      else setLoading(true);
      try {
        // Accessible classes: publication rights + acceder (web classService.obtenirClassesUtilisateur)
        const [pubRes, accRes] = await Promise.allSettled([
          publicationRightsService.getClassesForUser(userId),
          accederService.getAccessibleClasses(userId),
        ]);
        const classMap = new Map<string, ClassEntity>();
        if (pubRes.status === 'fulfilled' && Array.isArray(pubRes.value)) pubRes.value.forEach((c) => classMap.set(String(c.id), c));
        if (accRes.status === 'fulfilled' && Array.isArray(accRes.value)) {
          accRes.value.forEach((c) => {
            if (!classMap.has(String(c.id))) classMap.set(String(c.id), c);
          });
        }
        const classIds = Array.from(classMap.values()).map((c) => c.id);

        const [ownResult, ...classResults] = await Promise.allSettled([
          exerciseProgrammerService.getByProfessor(userId),
          ...classIds.map((cId) => exerciseProgrammerService.getByClasse(cId)),
        ]);
        const ownItems = ownResult.status === 'fulfilled' ? ownResult.value || [] : [];
        const classItems = classResults
          .filter((r): r is PromiseFulfilledResult<ExerciseProgramme[]> => r.status === 'fulfilled')
          .flatMap((r) => r.value || []);

        // Merge by programmer record ID — class items first, own items override
        const merged = new Map<string, ProgItem>();
        [...classItems, ...ownItems].forEach((p) => {
          if (p?.id) merged.set(String(p.id), { ...p, isOwn: String(p.programmeParId) === String(userId) });
        });
        const sorted = Array.from(merged.values()).sort(
          (a, b) => serverDateMs(b.dateExoPrevue || 0) - serverDateMs(a.dateExoPrevue || 0)
        );

        // Only keep programmations that have at least one submission
        const withSubmissions = await Promise.all(
          sorted.map(async (prog) => {
            try {
              const parts = await participationService.getByExerciseProgramme(prog.id);
              return parts && parts.length > 0 ? prog : null;
            } catch {
              return null;
            }
          })
        );
        const filteredProgs = withSubmissions.filter(Boolean) as ProgItem[];
        setProgrammations(filteredProgs);
        const current = selectedRef.current;
        if (filteredProgs.length > 0 && (!current || !filteredProgs.some((p) => p.id === current))) {
          setSelectedProgId(filteredProgs[0].id);
        }
      } catch {
        notify('error', 'Erreur lors du chargement');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId, notify]
  );

  useEffect(() => {
    load();
  }, [load]);

  const selectedProg = programmations.find((p) => p.id === selectedProgId);

  // Resolve professor name when a non-own programmation is selected
  useEffect(() => {
    if (!selectedProg || selectedProg.isOwn || !selectedProg.programmeParId) {
      setProfessorName(null);
      return;
    }
    let cancelled = false;
    userService
      .getUserById(String(selectedProg.programmeParId))
      .then((u: any) => {
        if (cancelled) return;
        if (u) setProfessorName(`${u.prenom || ''} ${u.nom || ''}`.trim() || u.email || null);
        else setProfessorName(null);
      })
      .catch(() => !cancelled && setProfessorName(null));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProg?.id, selectedProg?.isOwn]);

  const filtered = programmations.filter((p) => {
    if (filterType === 'DEVOIR') return p.typeAssignation === 'DEVOIR';
    if (filterType === 'EXERCICE') return p.typeAssignation === 'EXERCICE';
    return true;
  });

  const handleSelect = (id: string) => {
    setSelectedProgId(id);
    // Phone layout stacks the list above the panel: bring the panel into view.
    setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, panelY.current - 8), animated: true }), 50);
  };

  const headerStats = [
    { label: 'Total', value: programmations.length, color: '#C4B5FD' },
    { label: 'Devoirs', value: programmations.filter((p) => p.typeAssignation === 'DEVOIR').length, color: '#FCA5A5' },
    { label: 'Libres', value: programmations.filter((p) => p.typeAssignation !== 'DEVOIR').length, color: '#93C5FD' },
  ];
  const amber = tone('amber');

  if (loading) {
    return (
      <View style={[styles.container, styles.fullLoading]}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.fullLoadingText}>Chargement des corrections...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 150 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#7C3AED" />}
      >
        {/* Header */}
        <LinearGradient colors={['#9333EA', '#4338CA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.hero}>
          <View style={styles.heroTop}>
            <TouchableOpacity style={styles.heroIcon} onPress={onBack} accessibilityLabel="Retour">
              <FontAwesome5 name="arrow-left" size={15} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.heroIcon}>
              <FontAwesome5 name="clipboard-check" size={17} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.heroTitle} numberOfLines={1}>
                Corrections des Exercices
              </Text>
              <Text style={styles.heroSubtitle} numberOfLines={2}>
                Corrigez les soumissions de vos élèves
              </Text>
            </View>
          </View>
          <View style={styles.heroStats}>
            {headerStats.map((s) => (
              <View key={s.label} style={styles.heroStat}>
                <Text style={[styles.heroStatValue, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.heroStatLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {programmations.length === 0 ? (
          <View style={[styles.card, styles.emptyCard]}>
            <FontAwesome5 name="clipboard-check" size={40} color={isDark ? '#475569' : '#D1D5DB'} />
            <Text style={styles.emptyTitle}>Aucune programmation</Text>
            <Text style={styles.emptyText}>Programmez d'abord des exercices pour voir les corrections ici.</Text>
          </View>
        ) : (
          <>
            <ProgList
              filtered={filtered}
              selectedProgId={selectedProgId}
              onSelect={handleSelect}
              filterType={filterType}
              setFilterType={setFilterType}
              onRefresh={() => load()}
            />

            {/* Corrections panel */}
            <View
              style={styles.card}
              onLayout={(e) => {
                panelY.current = e.nativeEvent.layout.y;
              }}
            >
              <View style={styles.panelHeader}>
                <FontAwesome5 name="clipboard-check" size={16} color="#9333EA" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {selectedProg?.nom || 'Sélectionnez une programmation'}
                  </Text>
                  {selectedProg ? (
                    <Text style={styles.panelSub}>
                      {selectedProg.typeAssignation === 'DEVOIR' ? 'Devoir' : 'Exercice libre'}
                      {selectedProg.classesDiffusees && selectedProg.classesDiffusees.length > 0
                        ? ` · ${selectedProg.classesDiffusees.map((c: any) => c.nom).join(', ')}`
                        : ''}
                    </Text>
                  ) : null}
                </View>
              </View>

              {selectedProg && !selectedProg.isOwn ? (
                <View style={[styles.sharedBanner, { backgroundColor: amber.bg, borderBottomColor: `${amber.fg}26` }]}>
                  <FontAwesome5 name="users" size={13} color="#F59E0B" />
                  <Text style={[styles.sharedBannerText, { color: amber.fg }]}>
                    Programmé par <Text style={{ fontWeight: '800' }}>{professorName || 'un autre professeur'}</Text> — vous avez
                    accès via la classe partagée
                  </Text>
                </View>
              ) : null}

              <View style={styles.panelBody}>
                {selectedProg ? (
                  <ProgrammationCorrections key={selectedProg.id} prog={selectedProg} notify={notify} />
                ) : (
                  <View style={styles.panelEmpty}>
                    <FontAwesome5 name="clipboard-check" size={32} color={isDark ? '#475569' : '#D1D5DB'} />
                    <Text style={styles.panelEmptyText}>Sélectionnez une programmation ci-dessus</Text>
                  </View>
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {toast ? (
        <View
          pointerEvents="none"
          style={[styles.toast, toast.type === 'success' ? styles.toastSuccess : styles.toastError, { bottom: insets.bottom + 140 }]}
        >
          <FontAwesome5
            name={toast.type === 'success' ? 'check-circle' : 'exclamation-circle'}
            size={14}
            color={toast.type === 'success' ? '#16A34A' : '#DC2626'}
            solid
          />
          <Text style={[styles.toastText, { color: toast.type === 'success' ? '#166534' : '#991B1B' }]}>{toast.text}</Text>
        </View>
      ) : null}
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>, isDark: boolean) => {
  const title = isDark ? '#F8FAFC' : '#111827';
  const label = isDark ? '#E2E8F0' : '#374151';
  const body = isDark ? '#CBD5E1' : '#1F2937';
  const sub = isDark ? '#94A3B8' : '#6B7280';
  const faint = isDark ? '#64748B' : '#9CA3AF';
  const card = isDark ? '#1E293B' : '#FFFFFF';
  const border = isDark ? '#334155' : '#F3F4F6';
  const cardBorder = isDark ? '#334155' : '#E8EDF5';
  const input = isDark ? '#0F172A' : '#FFFFFF';
  const inputBorder = isDark ? '#475569' : '#D9D9D9';
  const soft = isDark ? '#172033' : '#F9FAFB';
  const shadow = {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  };

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingHorizontal: 12, paddingTop: 12, gap: 12 },
    fullLoading: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 120 },
    fullLoadingText: { fontSize: 14, color: sub },
    rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },

    // Hero header
    hero: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, gap: 12, overflow: 'hidden', ...shadow },
    heroTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    heroIcon: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
    heroSubtitle: { fontSize: 12, color: '#F3E8FF' },
    heroStats: { flexDirection: 'row', gap: 20 },
    heroStat: { alignItems: 'center' },
    heroStatValue: { fontSize: 18, fontWeight: '800' },
    heroStatLabel: { fontSize: 12, color: '#E9D5FF' },

    // Cards
    card: { backgroundColor: card, borderRadius: 12, overflow: 'hidden', borderWidth: isDark ? 1 : 0, borderColor: border, ...shadow },
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: border,
    },
    cardTitle: { fontSize: 14, fontWeight: '700', color: title },
    refreshBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
    filterRow: { flexDirection: 'row', padding: 8, borderBottomWidth: 1, borderBottomColor: border },
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
    selectPillText: { flex: 1, fontSize: 13, color: title },
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

    // Prog list
    progItem: { paddingHorizontal: 12, paddingVertical: 10, borderLeftWidth: 2, borderLeftColor: 'transparent' },
    progItemDivider: { borderTopWidth: 1, borderTopColor: border },
    progItemActive: { backgroundColor: isDark ? 'rgba(37,99,235,0.15)' : '#EFF6FF', borderLeftColor: '#2563EB' },
    progName: { flex: 1, fontSize: 14, fontWeight: '600', color: body },
    progMeta: { fontSize: 12, color: faint, marginLeft: 18, marginTop: 2 },
    otherBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
    otherBadgeText: { fontSize: 10, fontWeight: '700' },
    listEmpty: { textAlign: 'center', paddingVertical: 24, fontSize: 12, color: faint },
    listPager: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: border,
      backgroundColor: soft,
    },

    // Pager
    pagerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: border,
    },
    pagerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDark ? '#475569' : '#E5E7EB',
      backgroundColor: card,
    },
    pagerBtnText: { fontSize: 12, color: label },
    pagerText: { fontSize: 12, color: sub },

    // Panel
    panelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: border,
    },
    panelSub: { fontSize: 12, color: faint, marginTop: 1 },
    sharedBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
    },
    sharedBannerText: { flex: 1, fontSize: 12, fontWeight: '500', lineHeight: 17 },
    panelBody: { padding: 12 },
    panelLoading: { paddingVertical: 32, alignItems: 'center' },
    panelEmpty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
    panelEmptyText: { fontSize: 14, color: sub, textAlign: 'center' },

    // Mini stats
    miniStats: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    miniStat: { flex: 1, borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1 },
    miniStatValue: { fontSize: 20, fontWeight: '800' },
    miniStatLabel: { fontSize: 11, color: sub, marginTop: 2 },

    // Student cards
    studentCard: { borderRadius: 12, borderWidth: 1, borderColor: cardBorder, backgroundColor: card, overflow: 'hidden' },
    studentHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
    studentAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    studentName: { fontSize: 14, fontWeight: '700', color: title },
    studentRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    scorePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    scorePillText: { fontSize: 13, fontWeight: '800' },
    answeredText: { fontSize: 11, color: faint },
    etatBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
    etatBadgeText: { fontSize: 11, fontWeight: '700' },
    studentBody: { borderTopWidth: 1, borderTopColor: cardBorder, backgroundColor: soft, padding: 12, gap: 12 },

    // Overall grade
    overallBox: { backgroundColor: card, borderRadius: 12, borderWidth: 1, borderColor: cardBorder, padding: 12, gap: 8 },
    overallTitle: { fontSize: 14, fontWeight: '700', color: label },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    smallInput: {
      height: 36,
      borderWidth: 1,
      borderColor: inputBorder,
      borderRadius: 6,
      paddingHorizontal: 10,
      fontSize: 13,
      color: title,
      backgroundColor: input,
      minWidth: 0,
    },
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 36,
      borderRadius: 6,
      backgroundColor: '#1677FF',
    },
    saveBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
    currentText: { fontSize: 12, color: faint },

    // Question card
    questionCard: { borderRadius: 12, borderWidth: 1, backgroundColor: card, overflow: 'hidden' },
    questionHeader: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, gap: 6 },
    qTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    qNumber: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: isDark ? '#475569' : '#D1D5DB',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    qNumberText: { fontSize: 11, fontWeight: '800', color: label },
    qTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: title, lineHeight: 19 },
    qChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginLeft: 28 },
    ptsChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: isDark ? '#334155' : '#F3F4F6' },
    ptsChipText: { fontSize: 11, color: sub },
    questionBody: { paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
    answerRow: { gap: 4 },
    answerLabel: { fontSize: 12, fontWeight: '700', color: sub },
    answerValue: { fontSize: 14, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 4, overflow: 'hidden' },
    answerNeutral: { backgroundColor: soft, color: body },
    italicMuted: { fontSize: 12, color: faint, fontStyle: 'italic' },
    currentNoteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },

    // Manual grading
    gradingPanel: {
      paddingTop: 8,
      borderTopWidth: 1,
      borderStyle: 'dashed',
      borderTopColor: isDark ? '#475569' : '#E5E7EB',
      gap: 8,
    },
    gradingTitle: { fontSize: 12, fontWeight: '700' },
    verdictBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 34,
      borderRadius: 8,
      borderWidth: 1,
      backgroundColor: card,
    },
    verdictText: { fontSize: 12, fontWeight: '700' },

    // Empty
    emptyCard: { padding: 32, alignItems: 'center', gap: 6 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: label, marginTop: 6 },
    emptyText: { fontSize: 14, color: faint, textAlign: 'center' },

    // Toast
    toast: {
      position: 'absolute',
      left: 16,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      ...shadow,
      elevation: 6,
    },
    toastSuccess: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
    toastError: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
    toastText: { flex: 1, fontSize: 13, fontWeight: '600' },
  });
};

export default ExerciseCorrectionsView;
