import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Button, DropdownField, Input, LoadingSpinner } from '../../../../components/ui';
import { colors, radius, spacing, typography } from '../../../../styles/theme';
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

const NIVEAUX: { label: string; value: string }[] = [
  { label: 'Maternelle', value: 'MATERNELLE' },
  { label: 'Primaire', value: 'PRIMAIRE' },
  { label: 'Collège', value: 'COLLEGE' },
  { label: 'Lycée', value: 'LYCEE' },
  { label: 'Université', value: 'UNIVERSITE' },
  { label: 'Autre', value: 'AUTRE' },
];

const ETATS = [
  { label: 'Brouillon', value: 'BROUILLON' },
  { label: 'Publié', value: 'PUBLIE' },
  { label: 'Actif', value: 'ACTIF' },
];

const RESTRICTIONS = [
  { label: 'Privé (réservé à mes classes)', value: 'PRIVE' },
  { label: 'Public (accessible à tous)', value: 'PUBLIC' },
];

export interface CreateExerciseViewProps {
  onBack: () => void;
  onCreated: () => void;
  editingExercise?: Exercise | null;
}

const emptyQuestion = (): QuestionDraft => ({
  id: Date.now().toString() + Math.random(),
  intitule: '',
  options: ['', ''],
  correctIndex: 0,
});

/**
 * Full page exercise creation & editing view (Page seule et non modale).
 * Uses DropdownField for all selections (Niveau, État, Restriction, Matière).
 */
export const CreateExerciseView = ({
  onBack,
  onCreated,
  editingExercise,
}: CreateExerciseViewProps) => {
  const { user } = useUser();
  const isEditing = !!editingExercise;
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [niveau, setNiveau] = useState(NIVEAUX[0].value);
  const [etat, setEtat] = useState(ETATS[0].value);
  const [restriction, setRestriction] = useState(RESTRICTIONS[0].value);
  const [matiereOptions, setMatiereOptions] = useState<Matiere[]>([]);
  const [selectedMatiereId, setSelectedMatiereId] = useState<string>('');
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
    setRemovedQuestionIds([]);
    if (editingExercise) {
      setNom(editingExercise.nom ?? '');
      setDescription(editingExercise.description ?? '');
      setNiveau(editingExercise.niveau ?? NIVEAUX[0].value);
      setEtat((editingExercise.etat as string) ?? ETATS[0].value);
      setRestriction((editingExercise.restriction as string) || RESTRICTIONS[0].value);
      const existingMatiereIds = (editingExercise.matieres ?? []).map((m) => m.id);
      if (existingMatiereIds.length > 0) setSelectedMatiereId(existingMatiereIds[0]);
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
  }, [editingExercise]);

  const reset = () => {
    setNom('');
    setDescription('');
    setNiveau(NIVEAUX[0].value);
    setEtat(ETATS[0].value);
    setRestriction(RESTRICTIONS[0].value);
    setSelectedMatiereId('');
    setOriginalMatiereIds([]);
    setQuestions([emptyQuestion()]);
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

  const addOption = (questionId: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId) return q;
        return { ...q, options: [...q.options, ''] };
      })
    );
  };

  const removeOption = (questionId: string, index: number) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId || q.options.length <= 2) return q;
        const nextOptions = q.options.filter((_, i) => i !== index);
        const nextCorrect =
          q.correctIndex === index
            ? 0
            : q.correctIndex > index
            ? q.correctIndex - 1
            : q.correctIndex;
        return { ...q, options: nextOptions, correctIndex: nextCorrect };
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
      Alert.alert('Erreur', "Le titre de l'exercice est obligatoire.");
      return;
    }
    const validQuestions = questions.filter(
      (q) => q.intitule.trim() && q.options.every((o) => o.trim())
    );

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

      if (exerciseId && selectedMatiereId) {
        if (!originalMatiereIds.includes(selectedMatiereId)) {
          await exerciseService.linkToMatiere(exerciseId, selectedMatiereId).catch(() => {});
        }
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
          return q.existingId
            ? questionService.update(q.existingId, payload)
            : questionService.create(exerciseId as string, payload);
        })
      );

      Alert.alert('Succès', "Exercice enregistré avec succès !");
      reset();
      onCreated();
      onBack();
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : "Échec de l'enregistrement de l'exercice.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerEyebrow}>Gestion des exercices</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {isEditing ? "Modifier l'exercice" : 'Créer un exercice'}
          </Text>
        </View>
        <Button
          label="Enregistrer"
          onPress={handleSubmit}
          loading={submitting}
          style={styles.headerSaveBtn}
        />
      </View>

      {loadingExisting ? (
        <LoadingSpinner label="Chargement de l'exercice..." fullScreen />
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 130 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Main Info Card */}
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>Informations générales</Text>

            <Input
              label="Titre de l'exercice *"
              value={nom}
              onChangeText={setNom}
              placeholder="Ex: Évaluation de mathématiques #1"
            />

            <Input
              label="Description ou consignes"
              value={description}
              onChangeText={setDescription}
              placeholder="Instructions pour les élèves..."
              multiline
              numberOfLines={3}
              style={{ height: 75, textAlignVertical: 'top' }}
            />

            {/* Matière Dropdown */}
            <DropdownField
              label="Matière"
              placeholder="Sélectionner une matière..."
              value={selectedMatiereId}
              options={[
                { label: 'Aucune matière spécifique', value: '' },
                ...matiereOptions.map((m) => ({
                  label: m.nom ?? 'Matière',
                  value: m.id,
                })),
              ]}
              onChange={setSelectedMatiereId}
            />

            {/* Niveau Dropdown */}
            <DropdownField
              label="Niveau d'études *"
              placeholder="Sélectionner un niveau..."
              value={niveau}
              options={NIVEAUX}
              onChange={setNiveau}
            />

            {/* État Dropdown */}
            <DropdownField
              label="Statut *"
              placeholder="Sélectionner un statut..."
              value={etat}
              options={ETATS}
              onChange={setEtat}
            />

            {/* Restriction Dropdown */}
            <DropdownField
              label="Visibilité *"
              placeholder="Sélectionner la visibilité..."
              value={restriction}
              options={RESTRICTIONS}
              onChange={setRestriction}
            />
          </View>

          {/* Questions Section */}
          <View style={styles.card}>
            <View style={styles.questionsHeader}>
              <View>
                <Text style={styles.cardSectionTitle}>Questions & QCM ({questions.length})</Text>
                <Text style={styles.cardSectionSubtitle}>
                  Cochez le bouton radio à côté de la bonne réponse.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.addQuestionButton}
                onPress={() => setQuestions((prev) => [...prev, emptyQuestion()])}
              >
                <FontAwesome5 name="plus" size={12} color={colors.primary} />
                <Text style={styles.addQuestionButtonText}>Ajouter</Text>
              </TouchableOpacity>
            </View>

            {questions.map((q, qIndex) => (
              <View key={q.id} style={styles.questionBox}>
                <View style={styles.questionBoxHeader}>
                  <Text style={styles.questionIndexText}>Question {qIndex + 1}</Text>
                  {questions.length > 1 && (
                    <TouchableOpacity
                      onPress={() => handleRemoveQuestion(q)}
                      style={styles.deleteQuestionBtn}
                    >
                      <FontAwesome5 name="trash" size={12} color={colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>

                <Input
                  label="Énoncé de la question *"
                  value={q.intitule}
                  onChangeText={(text) => updateQuestion(q.id, { intitule: text })}
                  placeholder="Ex: Quelle est la capitale du Cameroun ?"
                />

                <Text style={styles.optionsLabel}>Options de réponse :</Text>
                {q.options.map((opt, optIndex) => {
                  const isCorrect = q.correctIndex === optIndex;
                  return (
                    <View key={optIndex} style={styles.optionRow}>
                      <TouchableOpacity
                        onPress={() => updateQuestion(q.id, { correctIndex: optIndex })}
                        style={[
                          styles.radioBtn,
                          isCorrect && styles.radioBtnActive,
                        ]}
                      >
                        {isCorrect && <View style={styles.radioInner} />}
                      </TouchableOpacity>

                      <View style={{ flex: 1 }}>
                        <Input
                          value={opt}
                          onChangeText={(text) => updateOption(q.id, optIndex, text)}
                          placeholder={`Option ${optIndex + 1}`}
                          style={[
                            styles.optionInput,
                            isCorrect && styles.optionInputCorrect,
                          ]}
                        />
                      </View>

                      {q.options.length > 2 && (
                        <TouchableOpacity
                          onPress={() => removeOption(q.id, optIndex)}
                          style={styles.removeOptionBtn}
                        >
                          <FontAwesome5 name="times" size={13} color={colors.textMuted} />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}

                <TouchableOpacity
                  style={styles.addOptionBtn}
                  onPress={() => addOption(q.id)}
                >
                  <FontAwesome5 name="plus-circle" size={13} color={colors.primary} />
                  <Text style={styles.addOptionBtnText}>Ajouter une option</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <Button
            label={isEditing ? 'Enregistrer les modifications' : "Créer l'exercice"}
            onPress={handleSubmit}
            loading={submitting}
            fullWidth
            style={{ marginBottom: 60 }}
          />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerEyebrow: { ...typography.caption, color: colors.textMuted },
  headerTitle: { ...typography.h3, color: colors.text },
  headerSaveBtn: { paddingHorizontal: 14, paddingVertical: 8 },
  content: { flex: 1, padding: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  cardSectionTitle: { ...typography.h3, color: colors.text, marginBottom: 2 },
  cardSectionSubtitle: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
  questionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  addQuestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  addQuestionButtonText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  questionBox: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  questionBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  questionIndexText: { ...typography.bodyBold, color: colors.primary },
  deleteQuestionBtn: { padding: 4 },
  optionsLabel: { ...typography.caption, color: colors.textMuted, fontWeight: '700', marginBottom: spacing.xs },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  radioBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioBtnActive: { borderColor: colors.success, backgroundColor: colors.successLight },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success },
  optionInput: { marginBottom: 0 },
  optionInputCorrect: { borderColor: colors.success },
  removeOptionBtn: { padding: 8 },
  addOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  addOptionBtnText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
});

export default CreateExerciseView;
