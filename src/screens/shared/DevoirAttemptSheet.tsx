import React, { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Badge, BottomSheet, Button, LoadingSpinner } from "../../components/ui";
import { colors, spacing, typography, useThemeColors } from "../../styles/theme";
import { exerciseProgrammerService, participationService, questionService, reponseService } from "../../services/api";
import { ChoixReponse, Question, Reponse } from "../../types";

interface DevoirAttemptSheetProps {
  visible: boolean;
  exerciseProgrammerId: string;
  title: string;
  userId: string;
  onClose: () => void;
  onComplete: () => void;
}

const isAutoCorrectable = (type?: string) => type === "QCM" || type === "VRAI_FAUX";

const autoCorrect = (question: Question, value: string): { isCorrect: boolean; correctAnswer: string } => {
  if (question.typeQuestion === "QCM") {
    const correctChoice = (question.choixReponses ?? []).find((c) => c.estCorrect);
    return { isCorrect: !!correctChoice && value === correctChoice.id, correctAnswer: correctChoice?.texte ?? question.reponse ?? "" };
  }
  if (question.typeQuestion === "VRAI_FAUX") {
    const expected = (question.reponse ?? "").toLowerCase().trim();
    return { isCorrect: expected === value.toLowerCase().trim(), correctAnswer: question.reponse ?? "" };
  }
  return { isCorrect: false, correctAnswer: question.reponse ?? "" };
};

/**
 * Shared homework-taking flow — used identically by the Student's own
 * devoirs screen and by Parent's (attempting on behalf of the selected
 * child, matching web's `effectiveUserId` resolution in
 * StudentExerciseView.jsx). Hydrates prior answers first so a completed
 * devoir always reopens as a read-only results view instead of allowing a
 * silent resubmission/duplicate participation.
 */
const DevoirAttemptSheet = ({ visible, exerciseProgrammerId, title, userId, onClose, onComplete }: DevoirAttemptSheetProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [priorAnswers, setPriorAnswers] = useState<Record<string, Reponse>>({});

  useEffect(() => {
    if (!visible) return;
    const load = async () => {
      setLoading(true);
      setAlreadyCompleted(false);
      setAnswers({});
      try {
        const programme = await exerciseProgrammerService.getById(exerciseProgrammerId);
        const exerciseId = programme.exerciseId;
        const [qs, allAnswers] = await Promise.all([
          exerciseId ? questionService.getByExercise(exerciseId) : Promise.resolve([]),
          reponseService.getByUser(userId).catch(() => []),
        ]);
        setQuestions(qs);
        const qIds = new Set(qs.map((q) => q.id));
        const mine: Record<string, Reponse> = {};
        allAnswers.forEach((a) => {
          if (a.questionId && qIds.has(a.questionId)) mine[a.questionId] = a;
        });
        if (Object.keys(mine).length > 0) {
          setPriorAnswers(mine);
          setAlreadyCompleted(true);
        } else {
          participationService
            .start({ utilisateurId: userId, exerciseProgrammerId, etatSoumission: "EN_COURS", dateDebut: new Date().toISOString() })
            .catch(() => {});
        }
      } catch {
        setQuestions([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [visible, exerciseProgrammerId, userId]);

  const handleSubmit = async () => {
    const unanswered = questions.filter((q) => !answers[q.id]?.trim());
    if (unanswered.length > 0) {
      Alert.alert("Réponses incomplètes", `Vous n'avez pas répondu à ${unanswered.length} question(s).`);
      return;
    }
    setSubmitting(true);
    try {
      let score = 0;
      let max = 0;
      let allAutoCorrect = true;

      for (const q of questions) {
        const points = q.points ?? 1;
        max += points;
        const value = answers[q.id] ?? "";
        let reponseText = value;
        let estCorrecte: boolean | undefined;
        let note: string | undefined;

        if (isAutoCorrectable(q.typeQuestion)) {
          const correction = autoCorrect(q, value);
          estCorrecte = correction.isCorrect;
          note = correction.isCorrect ? String(points) : "0";
          if (correction.isCorrect) score += points;
          if (q.typeQuestion === "QCM") {
            const chosen = (q.choixReponses ?? []).find((c) => c.id === value);
            reponseText = chosen?.texte ?? value;
          }
        } else {
          allAutoCorrect = false;
        }

        await reponseService.submit({
          utilisateurId: userId,
          questionId: q.id,
          reponseUtilisateur: reponseText,
          estCorrecte,
          note,
        }).catch(() => {});
      }

      await participationService.update({
        utilisateurId: userId,
        exerciseProgrammerId,
        dateFin: new Date().toISOString(),
        note: `${score}/${max}`,
        etatSoumission: allAutoCorrect ? "CORRIGE" : "EN_ATTENTE_CORRECTION",
      });

      Alert.alert("Succès", "Votre devoir a été soumis.");
      onComplete();
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la soumission.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <LoadingSpinner label="Chargement du devoir..." />
        ) : questions.length === 0 ? (
          <Text style={styles.emptyText}>Aucune question pour ce devoir.</Text>
        ) : alreadyCompleted ? (
          questions.map((q, index) => {
            const prior = priorAnswers[q.id];
            return (
              <View key={q.id} style={styles.questionCard}>
                <Text style={styles.questionText}>
                  {index + 1}. {q.intitule}
                </Text>
                <Text style={styles.answerText}>Votre réponse : {prior?.reponseUtilisateur || "—"}</Text>
                {prior?.estCorrecte !== undefined && prior?.estCorrecte !== null ? (
                  <View style={styles.resultRow}>
                    <FontAwesome5
                      name={prior.estCorrecte ? "check-circle" : "times-circle"}
                      solid
                      size={14}
                      color={prior.estCorrecte ? colors.success : colors.danger}
                    />
                    <Text style={[styles.resultText, { color: prior.estCorrecte ? colors.success : colors.danger }]}>
                      {prior.estCorrecte ? "Correcte" : "Incorrecte"}
                    </Text>
                  </View>
                ) : (
                  <Badge label="En attente de correction" tone="warning" />
                )}
                {prior?.appreciation ? <Text style={styles.appreciation}>"{prior.appreciation}"</Text> : null}
              </View>
            );
          })
        ) : (
          <>
            {questions.map((q, index) => (
              <View key={q.id} style={styles.questionCard}>
                <View style={styles.questionHeader}>
                  <Text style={styles.questionText}>
                    {index + 1}. {q.intitule}
                  </Text>
                  <Text style={styles.pointsText}>{q.points ?? 1} pt(s)</Text>
                </View>
                <QuestionInput question={q} value={answers[q.id] ?? ""} onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))} />
              </View>
            ))}
            <Button label="Soumettre mes réponses" onPress={handleSubmit} loading={submitting} fullWidth style={styles.submitButton} />
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
};

interface QuestionInputProps {
  question: Question;
  value: string;
  onChange: (value: string) => void;
}

const QuestionInput = ({ question, value, onChange }: QuestionInputProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const type = question.typeQuestion;

  if (type === "QCM") {
    return (
      <View style={styles.optionsWrap}>
        {(question.choixReponses ?? []).map((choix: ChoixReponse) => (
          <TouchableOpacity key={choix.id ?? choix.texte} style={styles.optionRow} onPress={() => onChange(choix.id ?? choix.texte)}>
            <FontAwesome5
              name={value === (choix.id ?? choix.texte) ? "check-circle" : "circle"}
              solid={value === (choix.id ?? choix.texte)}
              size={16}
              color={value === (choix.id ?? choix.texte) ? colors.success : colors.grayLight}
            />
            <Text style={styles.optionText}>{choix.texte}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  if (type === "VRAI_FAUX") {
    return (
      <View style={styles.trueFalseRow}>
        {["Vrai", "Faux"].map((option) => (
          <TouchableOpacity
            key={option}
            style={[styles.trueFalseOption, value === option && styles.trueFalseOptionActive]}
            onPress={() => onChange(option)}
          >
            <Text style={[styles.trueFalseText, value === option && styles.trueFalseTextActive]}>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  if (type === "REPONSE_LONGUE" || type === "DEVELOPPEMENT" || type === "ASSOCIATION" || type === "CLASSEMENT") {
    return (
      <TextInput
        style={styles.textArea}
        value={value}
        onChangeText={onChange}
        placeholder="Rédigez votre réponse..."
        placeholderTextColor={colors.textMuted}
        multiline
        numberOfLines={4}
      />
    );
  }

  // REPONSE_COURTE, TROU, and any unrecognized type
  return (
    <TextInput
      style={styles.textInput}
      value={value}
      onChangeText={onChange}
      placeholder="Votre réponse..."
      placeholderTextColor={colors.textMuted}
    />
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  scroll: { maxHeight: 520 },
  emptyText: { ...typography.body, color: colors.textMuted },
  questionCard: { backgroundColor: colors.background, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md },
  questionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.sm },
  questionText: { ...typography.bodyBold, color: colors.text, flex: 1, marginRight: spacing.sm },
  pointsText: { ...typography.caption, color: colors.textMuted },
  answerText: { ...typography.body, color: colors.text, marginBottom: spacing.sm },
  resultRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  resultText: { ...typography.caption, fontWeight: "600" },
  appreciation: { ...typography.caption, color: colors.textMuted, fontStyle: "italic", marginTop: spacing.xs },
  optionsWrap: { gap: spacing.xs },
  optionRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs },
  optionText: { ...typography.body, color: colors.text, flex: 1 },
  trueFalseRow: { flexDirection: "row", gap: spacing.sm },
  trueFalseOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  trueFalseOptionActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  trueFalseText: { ...typography.bodyBold, color: colors.text },
  trueFalseTextActive: { color: colors.primary },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  textArea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    backgroundColor: colors.surface,
    color: colors.text,
    minHeight: 90,
    textAlignVertical: "top",
  },
  submitButton: { marginTop: spacing.md, marginBottom: spacing.lg },
});

export default DevoirAttemptSheet;
