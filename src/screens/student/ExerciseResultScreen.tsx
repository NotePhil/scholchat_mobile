import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FontAwesome5 } from "@expo/vector-icons";
import { Badge, EmptyState } from "../../components/ui";
import { radius, spacing, typography, useThemeColors } from "../../styles/theme";
import { exerciseProgrammerService, participationService, questionService, reponseService } from "../../services/api";
import { Participation, Question, Reponse } from "../../types";
import { useUser } from "../../context/UserContext";
import { useT } from "../../i18n";
import { formatDate } from "../../utils/dates";
import {
  DEVOIR_STATUS_KEY,
  ExerciseResultParams,
  QUESTION_TYPE_KEY,
  fmtPoints,
  isGradedEtat,
  questionEarned,
  questionMedias,
} from "../../utils/devoirs";
import QuestionMediaList from "../shared/QuestionMediaList";

/**
 * Read-only copy of a submitted devoir (student's own, or the parent's
 * selected child): the overall grade/appreciation web shows on the devoir
 * card, plus each question with the submitted answer and — once the teacher
 * has corrected it — the per-question verdict, score and comment. Nothing is
 * editable here (grading is teacher-only; parents never answer).
 */
const ExerciseResultScreen = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = (route.params ?? {}) as ExerciseResultParams;
  const { user } = useUser();
  const isOwn = params.userId === user?.userId;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Reponse>>({});
  const [participation, setParticipation] = useState<Participation | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      setError("");
      try {
        let exerciseId = params.exerciseId;
        if (!exerciseId) exerciseId = (await exerciseProgrammerService.getById(params.exerciseProgrammerId)).exerciseId;
        const [qs, mine, parts] = await Promise.all([
          exerciseId ? questionService.getByExercise(exerciseId) : Promise.resolve([] as Question[]),
          reponseService.getByUser(params.userId).catch(() => [] as Reponse[]),
          participationService.getByUser(params.userId).catch(() => [] as Participation[]),
        ]);
        const ids = new Set(qs.map((q) => q.id));
        const byQuestion: Record<string, Reponse> = {};
        mine.forEach((r) => {
          if (r.questionId && ids.has(r.questionId)) byQuestion[r.questionId] = r;
        });
        setQuestions(qs);
        setAnswers(byQuestion);
        setParticipation(parts.find((p) => p.exerciseProgrammerId === params.exerciseProgrammerId) ?? null);
      } catch {
        setError(t("devoirs.result.loadFailed"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.exerciseId, params.exerciseProgrammerId, params.userId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const etat = participation?.etatSoumission ?? params.etat;
  const graded = isGradedEtat(etat);
  const note = participation?.note ?? params.note;
  const appreciation = participation?.appreciation ?? params.appreciation;
  const submittedAt = participation?.dateFin ?? participation?.dateSoumission;

  // Total points like the teacher's grading screen: sum of per-question scores over the exercise's max.
  const maxPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0);
  const earned = questions.map((q) => questionEarned(q, answers[q.id]));
  const hasScores = graded && earned.some((e) => e !== null);
  const earnedTotal = earned.reduce<number>((sum, e) => sum + (e ?? 0), 0);
  const correctCount = questions.filter((q) => answers[q.id]?.estCorrecte === true).length;

  const choiceText = (q: Question, raw?: string) => {
    if (!raw) return raw;
    const c = (q.choixReponses ?? []).find((x) => x.id === raw);
    return c?.texte ?? raw;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton} accessibilityLabel={t("common.back")}>
          <FontAwesome5 name="arrow-left" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {params.title || t("devoirs.fallbackTitle")}
          </Text>
          <Text style={styles.headerSubtitle}>{isOwn ? t("devoirs.result.title") : t("devoirs.result.childTitle")}</Text>
        </View>
        {etat && DEVOIR_STATUS_KEY[etat] ? (
          <Badge label={t(DEVOIR_STATUS_KEY[etat])} tone={graded ? "success" : etat === "EN_ATTENTE_CORRECTION" ? "warning" : "info"} />
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.muted}>{t("devoirs.result.loading")}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xl }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} colors={[colors.primary]} />}
        >
          {error ? (
            <TouchableOpacity style={styles.errorBox} onPress={() => load(true)}>
              <FontAwesome5 name="exclamation-circle" size={14} color={colors.danger} />
              <Text style={styles.errorText}>
                {error} {t("common.tapToRetry")}
              </Text>
            </TouchableOpacity>
          ) : null}

          {graded && (note || appreciation || hasScores) ? (
            <View style={styles.gradeBox}>
              {note ? (
                <View style={styles.gradeRow}>
                  <FontAwesome5 name="trophy" size={14} color={colors.purple} />
                  <Text style={styles.gradeText}>{t("devoirs.result.grade", { note })}</Text>
                </View>
              ) : null}
              {hasScores ? (
                <Text style={styles.scoreSummary}>
                  {t("devoirs.result.totalPoints", { earned: fmtPoints(earnedTotal), max: fmtPoints(maxPoints) })}
                  {" · "}
                  {t("devoirs.result.correctCount", { count: correctCount, total: questions.length })}
                </Text>
              ) : null}
              {appreciation ? <Text style={styles.gradeAppreciation}>"{appreciation}"</Text> : null}
            </View>
          ) : !graded && etat ? (
            <View style={styles.pendingBox}>
              <FontAwesome5 name="clock" size={13} color={colors.warningDark} />
              <Text style={styles.pendingText}>{t("devoirs.pendingCorrection")}</Text>
            </View>
          ) : null}
          {submittedAt ? <Text style={[styles.muted, styles.submittedAt]}>{t("devoirs.result.submittedOn", { date: formatDate(submittedAt, { day: "2-digit", month: "short", year: "numeric" }) })}</Text> : null}

          {questions.length === 0 && !error ? <EmptyState icon="file-alt" title={t("devoirs.attempt.noQuestions")} /> : null}

          {questions.map((q, i) => {
            const r = answers[q.id];
            const answerText = choiceText(q, r?.reponseUtilisateur);
            const hasVerdict = graded && r?.estCorrecte !== undefined && r?.estCorrecte !== null;
            const qMax = q.points || 1;
            const qEarned = graded ? earned[i] : null;
            const verdictColor = hasVerdict ? (r?.estCorrecte ? colors.success : colors.danger) : colors.border;
            return (
              <View key={q.id} style={[styles.card, hasVerdict && { borderColor: verdictColor }]}>
                <View style={styles.qHeader}>
                  <View style={styles.qNumber}>
                    <Text style={styles.qNumberText}>{i + 1}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.qText}>{q.intitule}</Text>
                    <View style={styles.qMeta}>
                      <View style={styles.typePill}>
                        <Text style={styles.typeText}>
                          {q.typeQuestion && QUESTION_TYPE_KEY[q.typeQuestion] ? t(QUESTION_TYPE_KEY[q.typeQuestion]) : q.typeQuestion ?? ""}
                        </Text>
                      </View>
                      <Text style={styles.muted}>{t("devoirs.attempt.points", { count: qMax })}</Text>
                    </View>
                  </View>
                  {qEarned !== null ? (
                    <View
                      style={[
                        styles.scorePill,
                        { backgroundColor: hasVerdict ? (r?.estCorrecte ? colors.successLight : colors.dangerLight) : colors.primaryLight },
                      ]}
                    >
                      <Text
                        style={[
                          styles.scorePillText,
                          { color: hasVerdict ? (r?.estCorrecte ? colors.successDark : colors.dangerDark) : colors.purple },
                        ]}
                      >
                        {t("devoirs.result.questionScore", { earned: fmtPoints(qEarned), max: fmtPoints(qMax) })}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <QuestionMediaList medias={questionMedias(q)} />

                <Text style={styles.label}>{t("devoirs.result.yourAnswer")}</Text>
                <View style={styles.answerBox}>
                  <Text style={answerText ? styles.answerText : styles.muted}>{answerText || t("devoirs.result.noAnswer")}</Text>
                </View>

                {graded ? (
                  <View style={styles.feedback}>
                    {hasVerdict ? (
                      <View style={styles.verdictRow}>
                        <FontAwesome5
                          name={r?.estCorrecte ? "check-circle" : "times-circle"}
                          solid
                          size={14}
                          color={r?.estCorrecte ? colors.success : colors.danger}
                        />
                        <Text style={[styles.verdictText, { color: r?.estCorrecte ? colors.successDark : colors.dangerDark }]}>
                          {r?.estCorrecte ? t("devoirs.result.correct") : t("devoirs.result.incorrect")}
                        </Text>
                      </View>
                    ) : null}
                    {r?.appreciation ? <Text style={styles.qAppreciation}>"{r.appreciation}"</Text> : null}
                  </View>
                ) : (
                  <View style={styles.feedback}>
                    <Badge label={t("devoirs.result.awaiting")} tone="warning" />
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    iconButton: { padding: spacing.sm },
    headerText: { flex: 1, minWidth: 0 },
    headerTitle: { ...typography.h4, color: colors.text },
    headerSubtitle: { ...typography.caption, color: colors.textMuted },
    scrollContent: { padding: spacing.lg },
    muted: { ...typography.caption, color: colors.textMuted },
    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.sm,
      backgroundColor: colors.dangerLight,
      marginBottom: spacing.md,
    },
    errorText: { ...typography.caption, color: colors.dangerDark, flex: 1 },
    gradeBox: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.purple, backgroundColor: colors.surface, gap: spacing.xs },
    gradeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    gradeText: { ...typography.h4, color: colors.purple },
    gradeAppreciation: { ...typography.body, color: colors.textMuted, fontStyle: "italic" },
    pendingBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.warning,
      backgroundColor: colors.surface,
    },
    pendingText: { ...typography.caption, color: colors.warningDark, flex: 1 },
    submittedAt: { marginTop: spacing.sm, marginBottom: spacing.md },
    card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
    qHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, marginBottom: spacing.md },
    qNumber: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
    qNumberText: { ...typography.captionBold, color: "#FFFFFF" },
    qText: { ...typography.bodyBold, color: colors.text },
    qMeta: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 4 },
    typePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.xs, backgroundColor: colors.primaryLight },
    typeText: { ...typography.tiny, color: colors.primaryDark },
    label: { ...typography.captionBold, color: colors.textMuted, marginBottom: spacing.xs },
    answerBox: { padding: spacing.md, borderRadius: radius.sm, backgroundColor: colors.surfaceElevated },
    answerText: { ...typography.body, color: colors.text },
    feedback: { marginTop: spacing.sm, gap: spacing.xs, alignItems: "flex-start" },
    verdictRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    verdictText: { ...typography.captionBold },
    scoreSummary: { ...typography.captionBold, color: colors.purple },
    scorePill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
    scorePillText: { ...typography.captionBold },
    qAppreciation: { ...typography.caption, color: colors.textMuted, fontStyle: "italic" },
  });

export default ExerciseResultScreen;
