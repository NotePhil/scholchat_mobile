import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { BottomSheet, Button, EmptyState, LoadingSpinner } from '../../../../components/ui';
import DateTimeField from '../../../../components/common/DateTimeField';
import { colors, spacing, typography } from '../../../../styles/theme';
import { classService } from '../../../../services/classService';
import { exerciseProgrammerService } from '../../../../services/api';
import { useUser } from '../../../../context/UserContext';
import { ClassEntity, Exercise } from '../../../../types';

interface ScheduleExerciseModalProps {
  visible: boolean;
  onClose: () => void;
  onScheduled: () => void;
  exercises: Exercise[];
}

/**
 * "Programmer un exercice" — diffuses an existing Exercise onto one or more
 * classes, with a due date. `typeAssignation` mirrors the backend's
 * distinction: EXERCICE (auto-corrected, immediate feedback) vs DEVOIR
 * (homework requiring manual professor grading — see the Corrections screen).
 */
const ScheduleExerciseModal = ({ visible, onClose, onScheduled, exercises }: ScheduleExerciseModalProps) => {
  const { user } = useUser();
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [selectedClasseIds, setSelectedClasseIds] = useState<string[]>([]);
  const [typeAssignation, setTypeAssignation] = useState<'EXERCICE' | 'DEVOIR'>('EXERCICE');
  const [dateExoPrevue, setDateExoPrevue] = useState('');
  const [dateDebutExoEffectif, setDateDebutExoEffectif] = useState('');
  const [dateFinExoEffectif, setDateFinExoEffectif] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible || !user?.userId) return;
    setLoadingClasses(true);
    classService
      .getClassesWithPublicationRights(user.userId)
      .then(setClasses)
      .catch(() => setClasses([]))
      .finally(() => setLoadingClasses(false));
  }, [visible, user?.userId]);

  const reset = () => {
    setSelectedExerciseId(null);
    setSelectedClasseIds([]);
    setTypeAssignation('EXERCICE');
    setDateExoPrevue('');
    setDateDebutExoEffectif('');
    setDateFinExoEffectif('');
  };

  const toggleClasse = (id: string) => {
    setSelectedClasseIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = async () => {
    if (!user?.userId) {
      Alert.alert('Erreur', 'Utilisateur non identifié.');
      return;
    }
    if (!selectedExerciseId || selectedClasseIds.length === 0) {
      Alert.alert('Erreur', 'Veuillez sélectionner un exercice et au moins une classe.');
      return;
    }
    if (!dateExoPrevue || !dateDebutExoEffectif || !dateFinExoEffectif) {
      Alert.alert('Erreur', 'Les trois dates (prévue, début, fin) sont obligatoires.');
      return;
    }
    if (new Date(dateFinExoEffectif) <= new Date(dateDebutExoEffectif)) {
      Alert.alert('Erreur', 'La date de fin doit être après la date de début.');
      return;
    }
    setSubmitting(true);
    try {
      await exerciseProgrammerService.programmerEtDiffuser({
        exerciseId: selectedExerciseId,
        programmeParId: user.userId,
        typeAssignation,
        dateExoPrevue,
        dateDebutExoEffectif,
        dateFinExoEffectif,
        classeIds: selectedClasseIds,
        etat: 'ACTIF',
      });
      reset();
      onScheduled();
      onClose();
      Alert.alert('Succès', 'Exercice programmé et diffusé avec succès.');
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Échec de la programmation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Programmer un exercice">
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Exercice *</Text>
        {exercises.length === 0 ? (
          <EmptyState icon="clipboard-list" title="Aucun exercice" message="Créez un exercice avant de le programmer." />
        ) : (
          <View style={styles.chipRow}>
            {exercises.map((ex) => (
              <TouchableOpacity
                key={ex.id}
                style={[styles.chip, selectedExerciseId === ex.id && styles.chipActive]}
                onPress={() => setSelectedExerciseId(ex.id)}
              >
                <Text style={[styles.chipText, selectedExerciseId === ex.id && styles.chipTextActive]} numberOfLines={1}>
                  {ex.nom}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>Type *</Text>
        <View style={styles.chipRow}>
          <TouchableOpacity
            style={[styles.typeCard, typeAssignation === 'EXERCICE' && styles.chipActive]}
            onPress={() => setTypeAssignation('EXERCICE')}
          >
            <FontAwesome5 name="bolt" size={14} color={typeAssignation === 'EXERCICE' ? colors.white : colors.textMuted} />
            <Text style={[styles.chipText, typeAssignation === 'EXERCICE' && styles.chipTextActive]}>
              Exercice (auto-corrigé)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeCard, typeAssignation === 'DEVOIR' && styles.chipActive]}
            onPress={() => setTypeAssignation('DEVOIR')}
          >
            <FontAwesome5 name="edit" size={14} color={typeAssignation === 'DEVOIR' ? colors.white : colors.textMuted} />
            <Text style={[styles.chipText, typeAssignation === 'DEVOIR' && styles.chipTextActive]}>
              Devoir (correction manuelle)
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Classes * (plusieurs possibles)</Text>
        {loadingClasses ? (
          <LoadingSpinner label="Chargement des classes..." />
        ) : classes.length === 0 ? (
          <EmptyState icon="chalkboard" title="Aucune classe" />
        ) : (
          <View style={styles.chipRow}>
            {classes.map((cls) => {
              const selected = selectedClasseIds.includes(cls.id);
              return (
                <TouchableOpacity key={cls.id} style={[styles.chip, selected && styles.chipActive]} onPress={() => toggleClasse(cls.id)}>
                  {selected && <FontAwesome5 name="check" size={10} color={colors.white} style={{ marginRight: 4 }} />}
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>{cls.nom}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <DateTimeField label="Date prévue" value={dateExoPrevue} onChange={setDateExoPrevue} required />
        <DateTimeField label="Début effectif" value={dateDebutExoEffectif} onChange={setDateDebutExoEffectif} required />
        <DateTimeField label="Fin effective" value={dateFinExoEffectif} onChange={setDateFinExoEffectif} required />

        <Button label="Programmer et diffuser" onPress={handleSubmit} loading={submitting} fullWidth style={styles.submitButton} />
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
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
    maxWidth: 220,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.grayLight,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { ...typography.caption, color: colors.text },
  chipTextActive: { color: colors.white, fontWeight: '600' },
  submitButton: { marginTop: spacing.md, marginBottom: spacing.lg },
});

export default ScheduleExerciseModal;
