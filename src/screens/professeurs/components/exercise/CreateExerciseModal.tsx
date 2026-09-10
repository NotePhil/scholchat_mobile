import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { BottomSheet, Button, Input, LoadingSpinner } from '../../../../components/ui';
import { colors, spacing, typography, useThemeColors } from '../../../../styles/theme';
import { exerciseService, matiereService, questionService } from '../../../../services/api';
import { useUser } from '../../../../context/UserContext';
import { Exercise, Matiere } from '../../../../types';

interface QuestionDraft {
  id: string;
  existingId?: string;
  intitule: string;
  options: string[];
  correctIndex: number;
}

/** Matches the backend's ListeNiveau enum exactly — French labels shown, enum value sent. */
const NIVEAUX: { label: string; value: string }[] = [
  { label: 'Maternelle', value: 'MATERNELLE' },
  { label: 'Primaire', value: 'PRIMAIRE' },
  { label: 'Collège', value: 'COLLEGE' },
  { label: 'Lycée', value: 'LYCEE' },
  { label: 'Université', value: 'UNIVERSITE' },
  { label: 'Autre', value: 'AUTRE' },
];

/** Matches the backend's EtatExercise enum. */
const ETATS = ['BROUILLON', 'PUBLIE', 'ACTIF'];

const RESTRICTIONS: { label: string; value: string }[] = [
  { label: 'Public', value: 'PUBLIC' },
  { label: 'Privé', value: 'PRIVE' },
];

interface CreateExerciseModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  editingExercise?: Exercise | null;
}

const emptyQuestion = (): QuestionDraft => ({
  id: Date.now().toString() + Math.random(),
  intitule: '',
  options: ['', ''],
  correctIndex: 0,
});

const CreateExerciseModal = ({ visible, onClose, onCreated, editingExercise }: CreateExerciseModalProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useUser();
  const isEditing = !!editingExercise;
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [niveau, setNiveau] = useState(NIVEAUX[0].value);
  const [etat, setEtat] = useState(ETATS[0]);
  const [restriction, setRestriction] = useState(RESTRICTIONS[1].value);
  const [matiereOptions, setMatiereOptions] = useState<Matiere[]>([]);
  const [selectedMatiereIds, setSelectedMatiereIds] = useState<string[]>([]);
  const [originalMatiereIds, setOriginalMatiereIds] = useState<string[]>([]);
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion()]);
  const [removedQuestionIds, setRemovedQuestionIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);

  useEffect(() => {
    matiereService
      .getAll()
      .then(setMatiereOptions)
      .catch(() => setMatiereOptions([]));
  }, []);

  useEffect(() => {
    if (!visible) return;
    setRemovedQuestionIds([]);
    if (editingExercise) {
      setNom(editingExercise.nom ?? '');
      setDescription(editingExercise.description ?? '');
      setNiveau(editingExercise.niveau ?? NIVEAUX[0].value);
      setEtat((editingExercise.etat as string) ?? ETATS[0]);
      setRestriction((editingExercise.restriction as string) || RESTRICTIONS[1].value);
      const existingMatiereIds = (editingExercise.matieres ?? []).map((m) => m.id);
      setSelectedMatiereIds(existingMatiereIds);
      setOriginalMatiereIds(existingMatiereIds);
      setLoadingExisting(true);
      questionService
        .getByExercise(editingExercise.id)
        .then((existing) => {
          if (existing.length === 0) {
            setQuestions([emptyQuestion()]);
            return;
          }
          setQuestions(
            existing.map((q) => {
              const choix = q.choixReponses ?? [];
              const options = choix.length >= 2 ? choix.map((c) => c.texte) : ['', ''];
              const correctIndex = Math.max(
                0,
                choix.findIndex((c) => c.estCorrect)
              );
              return {
                id: q.id,
                existingId: q.id,
                intitule: q.intitule ?? '',
                options,
                correctIndex: correctIndex === -1 ? 0 : correctIndex,
              };
            })
          );
        })
        .catch(() => setQuestions([emptyQuestion()]))
        .finally(() => setLoadingExisting(false));
    } else {
      reset();
    }
  }, [visible, editingExercise]);

  const reset = () => {
    setNom('');
    setDescription('');
    setNiveau(NIVEAUX[0].value);
    setEtat(ETATS[0]);
    setRestriction(RESTRICTIONS[1].value);
    setSelectedMatiereIds([]);
    setOriginalMatiereIds([]);
    setQuestions([emptyQuestion()]);
  };

  const toggleMatiere = (id: string) => {
    setSelectedMatiereIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const updateQuestion = (id: string, patch: Partial<QuestionDraft>) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  };

  const updateOption = (questionId: string, index: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId) return q;
        const options = [...q.options];
        options[index] = value;
        return { ...q, options };
      })
    );
  };

  const handleRemoveQuestion = (q: QuestionDraft) => {
    setQuestions((prev) => prev.filter((x) => x.id !== q.id));
    if (q.existingId) setRemovedQuestionIds((prev) => [...prev, q.existingId as string]);
  };

  const handleSubmit = async () => {
    if (!user?.userId) {
      Alert.alert('Erreur', 'Utilisateur non identifié.');
      return;
    }
    if (!nom.trim()) {
      Alert.alert('Erreur', 'Le titre est obligatoire.');
      return;
    }
    const validQuestions = questions.filter((q) => q.intitule.trim() && q.options.every((o) => o.trim()));

    setSubmitting(true);
    try {
      const exercise = isEditing
        ? await exerciseService.update(editingExercise!.id, {
            nom: nom.trim(),
            description: description.trim(),
            niveau,
            etat,
            restriction,
          })
        : await exerciseService.create({
            nom: nom.trim(),
            description: description.trim(),
            redacteurId: user.userId,
            niveau,
            etat,
            restriction,
          });
      const exerciseId = exercise.id ?? editingExercise?.id;

      if (exerciseId) {
        const toLink = selectedMatiereIds.filter((id) => !originalMatiereIds.includes(id));
        const toUnlink = originalMatiereIds.filter((id) => !selectedMatiereIds.includes(id));
        await Promise.all([
          ...toLink.map((mId) => exerciseService.linkToMatiere(exerciseId, mId).catch(() => {})),
          ...toUnlink.map((mId) => exerciseService.unlinkFromMatiere(exerciseId, mId).catch(() => {})),
        ]);
      }

      await Promise.all(removedQuestionIds.map((id) => questionService.remove(id).catch(() => {})));

      await Promise.all(
        validQuestions.map((q) => {
          const payload = {
            intitule: q.intitule.trim(),
            typeQuestion: 'QCM',
            reponse: q.options[q.correctIndex],
            points: 1,
            choixReponses: q.options.map((texte, index) => ({
              texte,
              estCorrect: index === q.correctIndex,
              ordreAffichage: index,
            })),
          };
          return q.existingId ? questionService.update(q.existingId, payload) : questionService.create(exerciseId as string, payload);
        })
      );

      reset();
      onCreated();
      onClose();
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : "Échec de l'enregistrement de l'exercice.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={isEditing ? "Modifier l'exercice" : 'Créer un exercice'}>
      {loadingExisting ? (
        <LoadingSpinner label="Chargement de l'exercice..." />
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <Input label="Titre *" value={nom} onChangeText={setNom} placeholder="Titre de l'exercice" />
          <Input
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Décrivez l'exercice"
            multiline
            numberOfLines={3}
          />

          <Text style={styles.label}>Niveau</Text>
          <View style={styles.chipRow}>
            {NIVEAUX.map((n) => (
              <TouchableOpacity
                key={n.value}
                style={[styles.chip, niveau === n.value && styles.chipActive]}
                onPress={() => setNiveau(n.value)}
              >
                <Text style={[styles.chipText, niveau === n.value && styles.chipTextActive]}>{n.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>État</Text>
          <View style={styles.chipRow}>
            {ETATS.map((e) => (
              <TouchableOpacity key={e} style={[styles.chip, etat === e && styles.chipActive]} onPress={() => setEtat(e)}>
                <Text style={[styles.chipText, etat === e && styles.chipTextActive]}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Visibilité</Text>
          <View style={styles.chipRow}>
            {RESTRICTIONS.map((r) => (
              <TouchableOpacity
                key={r.value}
                style={[styles.chip, restriction === r.value && styles.chipActive]}
                onPress={() => setRestriction(r.value)}
              >
                <Text style={[styles.chipText, restriction === r.value && styles.chipTextActive]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Matières associées</Text>
          <View style={styles.chipRow}>
            {matiereOptions.length === 0 ? (
              <Text style={styles.chipText}>Aucune matière disponible</Text>
            ) : (
              matiereOptions.map((m) => {
                const selected = selectedMatiereIds.includes(m.id);
                return (
                  <TouchableOpacity key={m.id} style={[styles.chip, selected && styles.chipActive]} onPress={() => toggleMatiere(m.id)}>
                    {selected && <FontAwesome5 name="check" size={10} color={colors.white} style={{ marginRight: 4 }} />}
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>{m.nom}</Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          <View style={styles.questionsHeader}>
            <Text style={styles.label}>Questions (QCM)</Text>
            <TouchableOpacity onPress={() => setQuestions((prev) => [...prev, emptyQuestion()])}>
              <FontAwesome5 name="plus-circle" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {questions.map((q, qIndex) => (
            <View key={q.id} style={styles.questionCard}>
              <View style={styles.questionCardHeader}>
                <Text style={styles.questionCardTitle}>Question {qIndex + 1}</Text>
                {questions.length > 1 && (
                  <TouchableOpacity onPress={() => handleRemoveQuestion(q)}>
                    <FontAwesome5 name="trash" size={14} color={colors.danger} />
                  </TouchableOpacity>
                )}
              </View>
              <Input
                value={q.intitule}
                onChangeText={(text) => updateQuestion(q.id, { intitule: text })}
                placeholder="Énoncé de la question"
              />
              {q.options.map((opt, optIndex) => (
                <View key={optIndex} style={styles.optionRow}>
                  <TouchableOpacity onPress={() => updateQuestion(q.id, { correctIndex: optIndex })}>
                    <FontAwesome5
                      name={q.correctIndex === optIndex ? 'check-circle' : 'circle'}
                      solid={q.correctIndex === optIndex}
                      size={18}
                      color={q.correctIndex === optIndex ? colors.success : colors.grayLight}
                    />
                  </TouchableOpacity>
                  <Input
                    value={opt}
                    onChangeText={(text) => updateOption(q.id, optIndex, text)}
                    placeholder={`Option ${optIndex + 1}`}
                    style={styles.optionInput}
                  />
                </View>
              ))}
              {q.options.length < 5 && (
                <TouchableOpacity
                  onPress={() => updateQuestion(q.id, { options: [...q.options, ''] })}
                  style={styles.addOption}
                >
                  <Text style={styles.addOptionText}>+ Ajouter une option</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}

          <Button
            label={isEditing ? 'Enregistrer les modifications' : "Créer l'exercice"}
            onPress={handleSubmit}
            loading={submitting}
            fullWidth
            style={styles.submitButton}
          />
        </ScrollView>
      )}
    </BottomSheet>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  scroll: { maxHeight: 500 },
  label: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.grayLight,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { ...typography.caption, color: colors.text },
  chipTextActive: { color: colors.white, fontWeight: '600' },
  questionsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  questionCard: { backgroundColor: colors.background, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md },
  questionCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  questionCardTitle: { ...typography.bodyBold, color: colors.text },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  optionInput: { flex: 1 },
  addOption: { marginTop: spacing.xs },
  addOptionText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  submitButton: { marginTop: spacing.md, marginBottom: spacing.lg },
});

export default CreateExerciseModal;
