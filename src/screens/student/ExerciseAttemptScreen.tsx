import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FontAwesome5 } from "@expo/vector-icons";
import { EmptyState } from "../../components/ui";
import { radius, spacing, typography, useThemeColors } from "../../styles/theme";
import { exerciseProgrammerService, participationService, questionService, reponseService } from "../../services/api";
import { Question } from "../../types";
import { useUser } from "../../context/UserContext";
import { useT } from "../../i18n";
import { useKeyboardAwareScroll } from "../../hooks/useKeyboardAwareScroll";
import { ExerciseAttemptParams, QUESTION_TYPE_KEY, questionMedias, sortedChoices } from "../../utils/devoirs";
import QuestionMediaList from "../shared/QuestionMediaList";

type Colors = ReturnType<typeof useThemeColors>;

/**
 * Full-screen homework attempt page — mirrors web's StudentExerciseView.jsx:
 * loads the questions (GET /questions/exercise/{exerciseId}), registers the
 * participation as EN_COURS (POST the first time, PUT when one exists), lets
 * the student answer one question at a time (QCM, Vrai/Faux, short/long
 * answer, fill-in-the-blank, with question images/PDFs), and on submit sends
 * every answer (POST /reponses, ungraded) then marks the participation SOUMIS.
 * Grading is the teacher's job. Leaving with unsent answers asks first
 * (header back, Android back and swipe all go through `beforeRemove`).
 */
const ExerciseAttemptScreen = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = (route.params ?? {}) as ExerciseAttemptParams;
  const { exerciseProgrammerId } = params;
  const { user } = useUser();
  // A parent answering for a minor child passes the child's id (backend: parent of a child without an account).
  const userId = params.learnerId ?? user?.userId ?? null;
  const { scrollRef, scrollToFocusedInput } = useKeyboardAwareScroll();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const allowLeaveRef = useRef(false);
  const participationRegisteredRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        let exerciseId = params.exerciseId;
        if (!exerciseId) exerciseId = (await exerciseProgrammerService.getById(exerciseProgrammerId)).exerciseId;
        const qs = exerciseId ? await questionService.getByExercise(exerciseId) : [];
        if (!cancelled) setQuestions(qs ?? []);
      } catch {
        if (!cancelled) setError(t("devoirs.attempt.loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseProgrammerId, params.exerciseId]);

  // Register / refresh the participation as EN_COURS once questions are loaded (web does the same).
  useEffect(() => {
    if (!userId || loading || questions.length === 0 || participationRegisteredRef.current) return;
    participationRegisteredRef.current = true;
    const payload = { utilisateurId: userId, exerciseProgrammerId, etatSoumission: "EN_COURS" };
    if (params.hasParticipation) {
      participationService.update(payload).catch(() => {});
    } else {
      participationService
        .start({ ...payload, dateDebut: new Date().toISOString() })
        // Already exists (e.g. created from another device): keep it EN_COURS.
        .catch(() => participationService.update(payload).catch(() => {}));
    }
  }, [userId, loading, questions.length, exerciseProgrammerId, params.hasParticipation]);

  const isAnswered = useCallback((q: Question) => !!answers[q.id]?.trim(), [answers]);
  const answeredCount = questions.filter(isAnswered).length;
  const total = questions.length;
  const progress = total > 0 ? answeredCount / total : 0;
  const hasDraft = Object.values(answers).some((v) => !!v?.trim());

  // Confirm before leaving an unsubmitted attempt (header back, hardware back, gesture).
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e: any) => {
      if (allowLeaveRef.current || !hasDraft) return;
      e.preventDefault();
      Alert.alert(t("devoirs.attempt.leaveTitle"), t("devoirs.attempt.leaveMessage"), [
        { text: t("devoirs.attempt.stay"), style: "cancel" },
        {
          text: t("devoirs.attempt.leave"),
          style: "destructive",
          onPress: () => {
            allowLeaveRef.current = true;
            navigation.dispatch(e.data.action);
          },
        },
      ]);
    });
    return unsubscribe;
  }, [navigation, hasDraft, t]);

  const setAnswer = (questionId: string, value: string) => setAnswers((prev) => ({ ...prev, [questionId]: value }));

  const doSubmit = async () => {
    if (!userId) return;
    setSubmitting(true);
    setError("");
    try {
      for (const q of questions) {
        const raw = answers[q.id] ?? "";
        // Choice questions store the choice id; the teacher reads the choice text.
        let reponseUtilisateur = raw;
        if (q.typeQuestion === "QCM" || q.typeQuestion === "VRAI_FAUX") {
          const choice = (q.choixReponses ?? []).find((c) => c.id === raw);
          reponseUtilisateur = choice?.texte ?? raw;
        }
        try {
          await reponseService.submit({ utilisateurId: userId, questionId: q.id, reponseUtilisateur });
        } catch (err) {
          // An earlier interrupted submission already stored this answer: update it instead.
          await reponseService.update({ utilisateurId: userId, questionId: q.id, reponseUtilisateur }).catch(() => {
            throw err;
          });
        }
      }
      await participationService.update({
        utilisateurId: userId,
        exerciseProgrammerId,
        etatSoumission: "SOUMIS",
        dateFin: new Date().toISOString(),
      });
      allowLeaveRef.current = true;
      Alert.alert(t("devoirs.attempt.submittedTitle"), t("devoirs.attempt.submittedMessage"));
      navigation.goBack();
    } catch {
      setError(t("devoirs.attempt.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    const unanswered = questions.filter((q) => !isAnswered(q));
    if (unanswered.length > 0) {
      setError(t("devoirs.attempt.unanswered", { count: unanswered.length }));
      const first = questions.indexOf(unanswered[0]);
      if (first >= 0) setIndex(first);
      return;
    }
    Alert.alert(t("devoirs.attempt.confirmTitle"), t("devoirs.attempt.confirmMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("devoirs.attempt.confirmSubmit"), onPress: doSubmit },
    ]);
  };

  const goTo = (i: number) => {
    setIndex(Math.max(0, Math.min(total - 1, i)));
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const question = questions[index];
  const title = params.title || t("devoirs.attempt.fallbackTitle");

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton} accessibilityLabel={t("common.back")}>
          <FontAwesome5 name="arrow-left" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          {params.description ? (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {params.description}
            </Text>
          ) : null}
        </View>
        {total > 0 ? (
          <View style={styles.counterPill}>
            <Text style={styles.counterText}>{t("devoirs.attempt.answeredShort", { answered: answeredCount, total })}</Text>
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.mutedText}>{t("devoirs.attempt.loadingQuestions")}</Text>
        </View>
      ) : total === 0 ? (
        <View style={styles.center}>
          {error ? <ErrorBanner text={error} styles={styles} colors={colors} /> : null}
          {!error ? <EmptyState icon="file-alt" title={t("devoirs.attempt.noQuestions")} /> : null}
        </View>
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.progressHead}>
              <Text style={styles.mutedText}>{t("devoirs.attempt.answered", { answered: answeredCount, total })}</Text>
              <Text style={styles.progressPct}>{Math.round(progress * 100)}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>

            {params.learnerId && params.learnerName ? (
              <View style={styles.onBehalfBox}>
                <FontAwesome5 name="user-friends" size={12} color={colors.warningDark} />
                <Text style={styles.onBehalfText}>{t("devoirs.attempt.onBehalf", { name: params.learnerName })}</Text>
              </View>
            ) : null}

            {error ? <ErrorBanner text={error} styles={styles} colors={colors} /> : null}

            <Text style={styles.questionOf}>{t("devoirs.attempt.questionOf", { index: index + 1, total })}</Text>

            {question ? (
              <View style={[styles.card, isAnswered(question) ? styles.cardAnswered : null]}>
                <View style={styles.qHeader}>
                  <View style={[styles.qNumber, isAnswered(question) ? styles.qNumberAnswered : null]}>
                    <Text style={[styles.qNumberText, isAnswered(question) ? styles.qNumberTextAnswered : null]}>{index + 1}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.qText}>{question.intitule}</Text>
                    <View style={styles.qMeta}>
                      <View style={styles.typePill}>
                        <Text style={styles.typeText}>
                          {question.typeQuestion && QUESTION_TYPE_KEY[question.typeQuestion]
                            ? t(QUESTION_TYPE_KEY[question.typeQuestion])
                            : question.typeQuestion ?? ""}
                        </Text>
                      </View>
                      <Text style={styles.mutedText}>{t("devoirs.attempt.points", { count: question.points || 1 })}</Text>
                    </View>
                  </View>
                </View>

                <QuestionMediaList medias={questionMedias(question)} />

                <AnswerInput
                  question={question}
                  value={answers[question.id] ?? ""}
                  onChange={(v) => setAnswer(question.id, v)}
                  onFocus={scrollToFocusedInput}
                  styles={styles}
                  colors={colors}
                />
              </View>
            ) : null}

            <View style={styles.dots}>
              {questions.map((q, i) => {
                const answered = isAnswered(q);
                const current = i === index;
                return (
                  <TouchableOpacity
                    key={q.id}
                    onPress={() => goTo(i)}
                    style={[styles.dot, answered ? styles.dotAnswered : current ? styles.dotCurrent : null]}
                  >
                    <Text style={[styles.dotText, answered ? styles.dotTextAnswered : current ? styles.dotTextCurrent : null]}>{i + 1}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.sm }]}>
            <TouchableOpacity
              style={[styles.navButton, index === 0 && styles.disabled]}
              onPress={() => goTo(index - 1)}
              disabled={index === 0}
              accessibilityLabel={t("devoirs.attempt.previous")}
            >
              <FontAwesome5 name="chevron-left" size={16} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, (submitting || answeredCount < total) && styles.disabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <FontAwesome5 name="paper-plane" size={14} color="#FFFFFF" />}
              <Text style={styles.submitText}>
                {submitting ? t("devoirs.attempt.submitting") : t("devoirs.attempt.submit", { answered: answeredCount, total })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, index === total - 1 && styles.disabled]}
              onPress={() => goTo(index + 1)}
              disabled={index === total - 1}
              accessibilityLabel={t("devoirs.attempt.next")}
            >
              <FontAwesome5 name="chevron-right" size={16} color={colors.text} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
};

const ErrorBanner = ({ text, styles, colors }: { text: string; styles: ReturnType<typeof createStyles>; colors: Colors }) => (
  <View style={styles.errorBox}>
    <FontAwesome5 name="exclamation-circle" size={14} color={colors.danger} />
    <Text style={styles.errorText}>{text}</Text>
  </View>
);

interface AnswerInputProps {
  question: Question;
  value: string;
  onChange: (value: string) => void;
  onFocus: (e: any) => void;
  styles: ReturnType<typeof createStyles>;
  colors: Colors;
}

const AnswerInput = ({ question, value, onChange, onFocus, styles, colors }: AnswerInputProps) => {
  const { t } = useT();
  const type = question.typeQuestion;

  if (type === "QCM") {
    return (
      <View style={styles.options}>
        {sortedChoices(question).map((c, i) => {
          const id = c.id ?? c.texte;
          const selected = value === id;
          return (
            <TouchableOpacity key={id ?? i} style={[styles.option, selected && styles.optionSelected]} onPress={() => onChange(id)} activeOpacity={0.7}>
              <FontAwesome5 name={selected ? "dot-circle" : "circle"} size={16} color={selected ? colors.primary : colors.textMuted} />
              <Text style={styles.optionText}>{c.texte}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  if (type === "VRAI_FAUX") {
    const choices = sortedChoices(question);
    const options =
      choices.length > 0
        ? choices.map((c) => ({ id: c.id ?? c.texte, label: c.texte }))
        : [
            { id: "Vrai", label: t("devoirs.attempt.true") },
            { id: "Faux", label: t("devoirs.attempt.false") },
          ];
    return (
      <View style={styles.tfRow}>
        {options.map((o) => {
          const selected = value === o.id;
          return (
            <TouchableOpacity key={o.id} style={[styles.tfOption, selected && styles.optionSelected]} onPress={() => onChange(o.id)} activeOpacity={0.7}>
              <FontAwesome5 name={selected ? "dot-circle" : "circle"} size={14} color={selected ? colors.primary : colors.textMuted} />
              <Text style={styles.tfText}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  const multiline = type !== "REPONSE_COURTE" && type !== "TROU";
  const placeholder =
    type === "TROU" ? t("devoirs.attempt.gapPlaceholder") : multiline ? t("devoirs.attempt.longPlaceholder") : t("devoirs.attempt.shortPlaceholder");
  // Style shape stays constant (no focus-dependent styles): toggling it breaks focus on Android.
  return (
    <TextInput
      style={multiline ? styles.textArea : styles.textInput}
      value={value}
      onChangeText={onChange}
      onFocus={onFocus}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      multiline={multiline}
      textAlignVertical={multiline ? "top" : "center"}
    />
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.lg },
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
    counterPill: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm, backgroundColor: colors.primaryLight },
    counterText: { ...typography.captionBold, color: colors.primaryDark },
    scrollContent: { padding: spacing.lg, paddingBottom: spacing.xl },
    progressHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs },
    progressPct: { ...typography.captionBold, color: colors.primary },
    progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.grayLight, overflow: "hidden", marginBottom: spacing.md },
    progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
    mutedText: { ...typography.caption, color: colors.textMuted },
    errorBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.danger,
      backgroundColor: colors.dangerLight,
      marginBottom: spacing.md,
      alignSelf: "stretch",
    },
    errorText: { ...typography.caption, color: colors.dangerDark, flex: 1 },
    onBehalfBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      padding: spacing.sm,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.warning,
      backgroundColor: colors.warningLight,
      marginBottom: spacing.md,
    },
    onBehalfText: { ...typography.caption, color: colors.warningDark, flex: 1 },
    questionOf: { ...typography.captionBold, color: colors.text, textAlign: "center", marginBottom: spacing.sm },
    card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
    cardAnswered: { borderColor: colors.primaryMid },
    qHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, marginBottom: spacing.md },
    qNumber: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.grayLight },
    qNumberAnswered: { backgroundColor: colors.primary },
    qNumberText: { ...typography.captionBold, color: colors.gray },
    qNumberTextAnswered: { color: "#FFFFFF" },
    qText: { ...typography.bodyBold, color: colors.text },
    qMeta: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 4 },
    typePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.xs, backgroundColor: colors.primaryLight },
    typeText: { ...typography.tiny, color: colors.primaryDark },
    options: { gap: spacing.sm },
    option: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    optionSelected: { borderColor: colors.primary, backgroundColor: colors.surfaceElevated },
    optionText: { ...typography.body, color: colors.text, flex: 1 },
    tfRow: { flexDirection: "row", gap: spacing.sm },
    tfOption: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    tfText: { ...typography.bodyBold, color: colors.text },
    textInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      backgroundColor: colors.background,
      color: colors.text,
      fontSize: 14,
    },
    textArea: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      backgroundColor: colors.background,
      color: colors.text,
      fontSize: 14,
      minHeight: 120,
    },
    dots: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.sm, marginTop: spacing.lg },
    dot: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.grayLight, borderWidth: 2, borderColor: "transparent" },
    dotAnswered: { backgroundColor: colors.primary },
    dotCurrent: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
    dotText: { ...typography.captionBold, color: colors.gray },
    dotTextAnswered: { color: "#FFFFFF" },
    dotTextCurrent: { color: colors.primaryDark },
    bottomBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    navButton: { width: 44, height: 44, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceElevated },
    submitButton: {
      flex: 1,
      height: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      borderRadius: radius.sm,
      backgroundColor: colors.primary,
    },
    submitText: { ...typography.bodyBold, color: "#FFFFFF" },
    disabled: { opacity: 0.45 },
  });

export default ExerciseAttemptScreen;
