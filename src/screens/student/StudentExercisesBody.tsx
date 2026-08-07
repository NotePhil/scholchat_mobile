import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Badge, BottomSheet, Button, EmptyState, LoadingSpinner } from "../../components/ui";
import { colors, spacing, typography } from "../../styles/theme";
import { exerciseProgrammerService, exerciseService, participationService, questionService, reponseService } from "../../services/api";
import { Exercise, Question } from "../../types";
import { useUser } from "../../context/UserContext";

const NIVEAU_LABELS: Record<string, string> = {
  MATERNELLE: "Maternelle",
  PRIMAIRE: "Primaire",
  COLLEGE: "Collège",
  LYCEE: "Lycée",
  UNIVERSITE: "Université",
  AUTRE: "Autre",
};

const StudentExercisesBody = () => {
  const { user } = useUser();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);

  const load = useCallback(async () => {
    if (!user?.userId) return;
    setLoading(true);
    setError("");
    try {
      const data = await exerciseService.getAccessible(user.userId);
      setExercises(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du chargement des devoirs.");
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes devoirs</Text>
      </View>

      <ScrollView style={styles.list}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? (
          <LoadingSpinner label="Chargement des devoirs..." />
        ) : exercises.length === 0 ? (
          <EmptyState icon="clipboard-list" title="Aucun devoir" message="Vous n'avez aucun devoir assigné pour le moment." />
        ) : (
          exercises.map((ex) => (
            <TouchableOpacity key={ex.id} style={styles.card} onPress={() => setActiveExercise(ex)}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{ex.nom}</Text>
                {ex.etat ? <Badge label={ex.etat} tone="info" /> : null}
              </View>
              {ex.description ? (
                <Text style={styles.cardDescription} numberOfLines={2}>
                  {ex.description}
                </Text>
              ) : null}
              <View style={styles.cardFooter}>
                <FontAwesome5 name="graduation-cap" size={12} color={colors.textMuted} />
                <Text style={styles.cardMeta}>{NIVEAU_LABELS[ex.niveau ?? ""] ?? ex.niveau ?? "-"}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {activeExercise && (
        <ExerciseAttemptSheet
          exercise={activeExercise}
          onClose={() => setActiveExercise(null)}
          userId={user?.userId}
        />
      )}
    </View>
  );
};

interface ExerciseAttemptSheetProps {
  exercise: Exercise;
  onClose: () => void;
  userId?: string;
}

const ExerciseAttemptSheet = ({ exercise, onClose, userId }: ExerciseAttemptSheetProps) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [exerciseProgrammerId, setExerciseProgrammerId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [fullQuestions, programmes] = await Promise.all([
          questionService.getByExercise(exercise.id),
          exerciseProgrammerService.getByExercise(exercise.id).catch(() => []),
        ]);
        setQuestions(fullQuestions);
        setExerciseProgrammerId(programmes.length > 0 ? programmes[0].id : null);
      } catch {
        setQuestions([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [exercise.id]);

  const handleSubmit = async () => {
    if (!userId) {
      Alert.alert("Erreur", "Utilisateur non identifié.");
      return;
    }
    if (!exerciseProgrammerId) {
      Alert.alert("Erreur", "Ce devoir n'est pas rattaché à une programmation active.");
      return;
    }
    setSubmitting(true);
    try {
      await participationService.start({
        utilisateurId: userId,
        exerciseProgrammerId,
        etatSoumission: "EN_COURS",
        dateDebut: new Date().toISOString(),
      });

      await Promise.all(
        questions.map((q) => {
          const chosenText = answers[q.id] ?? "";
          const correctChoice = (q.choixReponses ?? []).find((c) => c.estCorrect);
          const estCorrecte = correctChoice ? correctChoice.texte === chosenText : undefined;
          return reponseService.submit({
            utilisateurId: userId,
            questionId: q.id,
            reponseUtilisateur: chosenText,
            estCorrecte,
          });
        })
      );

      await participationService.update({
        utilisateurId: userId,
        exerciseProgrammerId,
        etatSoumission: "SOUMIS",
        dateFin: new Date().toISOString(),
      });

      setAlreadySubmitted(true);
      Alert.alert("Succès", "Votre devoir a été soumis.");
      onClose();
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la soumission.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet visible onClose={onClose} title={exercise.nom}>
      <ScrollView style={{ maxHeight: 480 }}>
        {loading ? (
          <LoadingSpinner label="Chargement des questions..." />
        ) : questions.length === 0 ? (
          <Text style={styles.cardDescription}>Aucune question pour cet exercice.</Text>
        ) : (
          questions.map((q, index) => (
            <View key={q.id} style={styles.questionBlock}>
              <Text style={styles.questionText}>
                {index + 1}. {q.intitule}
              </Text>
              {(q.choixReponses ?? []).map((choix) => (
                <TouchableOpacity
                  key={choix.id ?? choix.texte}
                  style={styles.optionRow}
                  onPress={() => setAnswers((prev) => ({ ...prev, [q.id]: choix.texte }))}
                >
                  <FontAwesome5
                    name={answers[q.id] === choix.texte ? "check-circle" : "circle"}
                    solid={answers[q.id] === choix.texte}
                    size={16}
                    color={answers[q.id] === choix.texte ? colors.success : colors.grayLight}
                  />
                  <Text style={styles.optionText}>{choix.texte}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
        <Button
          label="Soumettre mes réponses"
          onPress={handleSubmit}
          loading={submitting}
          disabled={alreadySubmitted || questions.length === 0}
          fullWidth
          style={{ marginTop: spacing.md, marginBottom: spacing.lg }}
        />
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, marginTop: 20, marginBottom: spacing.md },
  title: { ...typography.h1, color: colors.text },
  list: { flex: 1, paddingHorizontal: 16 },
  error: { color: colors.danger, marginBottom: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  cardTitle: { ...typography.bodyBold, color: colors.text, flex: 1, marginRight: spacing.sm },
  cardDescription: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  cardMeta: { ...typography.caption, color: colors.textMuted },
  questionBlock: { marginBottom: spacing.lg },
  questionText: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.sm },
  optionRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs },
  optionText: { ...typography.body, color: colors.text },
});

export default StudentExercisesBody;
