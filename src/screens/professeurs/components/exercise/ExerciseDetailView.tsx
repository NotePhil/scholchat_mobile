import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Badge, Button, LoadingSpinner } from '../../../../components/ui';
import { colors, radius, spacing, typography, useThemeColors } from '../../../../styles/theme';
import { questionService } from '../../../../services/api';
import { Question } from '../../../../types';

export interface ExerciseDetailViewProps {
  exercise: any;
  onBack: () => void;
  onEdit: () => void;
  onSchedule: () => void;
  onDelete: () => void;
}

/**
 * Full page Exercise Detail View (Page seule et non modale).
 */
export const ExerciseDetailView = ({
  exercise,
  onBack,
  onEdit,
  onSchedule,
  onDelete,
}: ExerciseDetailViewProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!exercise?.id) return;
    setLoading(true);
    questionService
      .getByExercise(exercise.id)
      .then(setQuestions)
      .catch(() => setQuestions([]))
      .finally(() => setLoading(false));
  }, [exercise?.id]);

  const isActif = exercise.etat === 'ACTIF' || exercise.etat === 'PUBLIE';

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerEyebrow}>Détails de l'exercice</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {exercise.nom || exercise.titre || 'Exercice'}
          </Text>
        </View>
        <TouchableOpacity style={styles.headerEditBtn} onPress={onEdit}>
          <FontAwesome5 name="edit" size={13} color={colors.white} />
          <Text style={styles.headerEditBtnText}>Modifier</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Info Card */}
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.titleText}>{exercise.nom || exercise.titre}</Text>
            <Badge
              label={exercise.etat ?? 'BROUILLON'}
              tone={isActif ? 'success' : 'warning'}
            />
          </View>

          {exercise.description ? (
            <Text style={styles.descriptionText}>{exercise.description}</Text>
          ) : null}

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <FontAwesome5 name="graduation-cap" size={12} color={colors.textMuted} />
              <Text style={styles.metaText}>Niveau : {exercise.niveau || 'Non défini'}</Text>
            </View>
            <View style={styles.metaItem}>
              <FontAwesome5 name="lock" size={12} color={colors.textMuted} />
              <Text style={styles.metaText}>Visibilité : {exercise.restriction || 'Privé'}</Text>
            </View>
            <View style={styles.metaItem}>
              <FontAwesome5 name="calendar-alt" size={12} color={colors.textMuted} />
              <Text style={styles.metaText}>Créé le : {exercise.dateCreation || 'N/A'}</Text>
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.actionButtonsRow}>
            <Button
              label="Programmer cet exercice"
              onPress={onSchedule}
              style={{ flex: 1, backgroundColor: colors.primary }}
            />
            <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
              <FontAwesome5 name="trash" size={14} color={colors.danger} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Questions Section */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Questions ({questions.length})
          </Text>

          {loading ? (
            <LoadingSpinner label="Chargement des questions..." />
          ) : questions.length === 0 ? (
            <Text style={styles.emptyText}>Aucune question enregistrée pour cet exercice.</Text>
          ) : (
            questions.map((q, qIndex) => {
              const options = q.choixReponses ?? [];
              return (
                <View key={q.id || qIndex} style={styles.questionCard}>
                  <Text style={styles.questionTitle}>
                    Question {qIndex + 1} : {q.intitule}
                  </Text>
                  <View style={styles.optionsList}>
                    {options.map((opt, optIndex) => (
                      <View
                        key={opt.id || optIndex}
                        style={[
                          styles.optionItem,
                          opt.estCorrect && styles.optionItemCorrect,
                        ]}
                      >
                        <FontAwesome5
                          name={opt.estCorrect ? 'check-circle' : 'circle'}
                          size={12}
                          color={opt.estCorrect ? colors.success : colors.textMuted}
                        />
                        <Text
                          style={[
                            styles.optionText,
                            opt.estCorrect && styles.optionTextCorrect,
                          ]}
                        >
                          {opt.texte}
                        </Text>
                        {opt.estCorrect && (
                          <Badge label="Bonne réponse" tone="success" />
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
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
  headerEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  headerEditBtnText: { ...typography.caption, color: colors.white, fontWeight: '700' },
  content: { flex: 1, padding: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  titleText: { ...typography.h2, color: colors.text, flex: 1, marginRight: spacing.sm },
  descriptionText: { ...typography.body, color: colors.textMuted, marginBottom: spacing.md },
  metaRow: { gap: 6, marginBottom: spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { ...typography.caption, color: colors.text },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  deleteBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  emptyText: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic' },
  questionCard: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  questionTitle: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.sm },
  optionsList: { gap: 6 },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  optionItemCorrect: {
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: colors.success,
  },
  optionText: { ...typography.caption, color: colors.text, flex: 1 },
  optionTextCorrect: { color: colors.success, fontWeight: '700' },
});

export default ExerciseDetailView;
