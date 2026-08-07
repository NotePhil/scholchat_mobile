import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { BottomSheet, Button, EmptyState, Input, LoadingSpinner } from '../../../../components/ui';
import { colors, spacing, typography } from '../../../../styles/theme';
import { classService } from '../../../../services/classService';
import { coursProgrammerService } from '../../../../services/api';
import { useUser } from '../../../../context/UserContext';
import { ClassEntity } from '../../../../types';
import { Cours } from './DashboardCoursBody';

interface ScheduleCoursModalProps {
  visible: boolean;
  onClose: () => void;
  onScheduled: () => void;
  coursList: Cours[];
}

/**
 * "Programmer un cours" — schedules an existing Cours onto one or more
 * classes. Field names match the backend's CoursProgrammer model exactly:
 * classesIds (plural), dateCoursPrevue, lieu.
 */
const ScheduleCoursModal = ({ visible, onClose, onScheduled, coursList }: ScheduleCoursModalProps) => {
  const { user } = useUser();
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [selectedCoursId, setSelectedCoursId] = useState<string | null>(null);
  const [selectedClasseIds, setSelectedClasseIds] = useState<string[]>([]);
  const [dateCoursPrevue, setDateCoursPrevue] = useState('');
  const [lieu, setLieu] = useState('');
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
    setSelectedCoursId(null);
    setSelectedClasseIds([]);
    setDateCoursPrevue('');
    setLieu('');
  };

  const toggleClasse = (id: string) => {
    setSelectedClasseIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = async () => {
    if (!user?.userId) {
      Alert.alert('Erreur', 'Utilisateur non identifié.');
      return;
    }
    if (!selectedCoursId || selectedClasseIds.length === 0 || !dateCoursPrevue.trim()) {
      Alert.alert('Erreur', 'Veuillez sélectionner un cours, au moins une classe et une date.');
      return;
    }
    setSubmitting(true);
    try {
      await coursProgrammerService.programmer({
        coursId: selectedCoursId,
        professeurId: user.userId,
        dateCoursPrevue: dateCoursPrevue.trim(),
        lieu: lieu.trim() || undefined,
        classesIds: selectedClasseIds,
        etatCoursProgramme: 'PLANIFIE',
      });
      reset();
      onScheduled();
      onClose();
      Alert.alert('Succès', 'Cours programmé avec succès.');
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Échec de la programmation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Programmer un cours">
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Cours à programmer *</Text>
        {coursList.length === 0 ? (
          <EmptyState icon="book" title="Aucun cours" message="Créez un cours avant de le programmer." />
        ) : (
          <View style={styles.chipRow}>
            {coursList.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, selectedCoursId === c.id && styles.chipActive]}
                onPress={() => setSelectedCoursId(c.id)}
              >
                <Text style={[styles.chipText, selectedCoursId === c.id && styles.chipTextActive]} numberOfLines={1}>
                  {c.titre}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

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
                <TouchableOpacity
                  key={cls.id}
                  style={[styles.chip, selected && styles.chipActive]}
                  onPress={() => toggleClasse(cls.id)}
                >
                  {selected && <FontAwesome5 name="check" size={10} color={colors.white} style={{ marginRight: 4 }} />}
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>{cls.nom}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <Input
          label="Date et heure prévue *"
          value={dateCoursPrevue}
          onChangeText={setDateCoursPrevue}
          placeholder="JJ/MM/AAAA HH:MM"
        />
        <Input label="Lieu" value={lieu} onChangeText={setLieu} placeholder="Salle, lien visio, etc." />

        <Button label="Programmer" onPress={handleSubmit} loading={submitting} fullWidth style={styles.submitButton} />
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
  chipActive: { backgroundColor: colors.primary },
  chipText: { ...typography.caption, color: colors.text },
  chipTextActive: { color: colors.white, fontWeight: '600' },
  submitButton: { marginTop: spacing.md, marginBottom: spacing.lg },
});

export default ScheduleCoursModal;
