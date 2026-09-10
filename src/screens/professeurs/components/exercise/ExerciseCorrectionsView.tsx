import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Badge, Button, EmptyState, Input, LoadingSpinner } from '../../../../components/ui';
import { colors, radius, spacing, typography, useThemeColors } from '../../../../styles/theme';
import { participationService, reponseService } from '../../../../services/api';
import { useUser } from '../../../../context/UserContext';
import { Participation, Reponse } from '../../../../types';

export interface ExerciseCorrectionsViewProps {
  onBack: () => void;
}

/**
 * Full page Exercise Corrections / Grading screen (Page seule et non modale).
 */
export const ExerciseCorrectionsView = ({ onBack }: ExerciseCorrectionsViewProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useUser();
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [active, setActive] = useState<Participation | null>(null);
  const [reponses, setReponses] = useState<Reponse[]>([]);
  const [loadingReponses, setLoadingReponses] = useState(false);
  const [note, setNote] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [submittingGrade, setSubmittingGrade] = useState(false);

  const load = useCallback(async () => {
    if (!user?.userId) return;
    setLoading(true);
    setError('');
    try {
      const data = await participationService.getToCorrectByProfessor(user.userId);
      setParticipations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec du chargement des copies à corriger.');
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleOpenParticipation = async (p: Participation) => {
    setActive(p);
    setNote(p.noteObtenue != null ? String(p.noteObtenue) : '');
    setCommentaire(p.appreciation ?? '');
    setLoadingReponses(true);
    try {
      if (p.exerciseProgrammerId) {
        const answers = await reponseService.getByExercise(p.exerciseProgrammerId);
        setReponses(answers);
      } else {
        setReponses([]);
      }
    } catch {
      setReponses([]);
    } finally {
      setLoadingReponses(false);
    }
  };

  const handleSaveGrade = async () => {
    if (!active || !active.utilisateurId || !active.exerciseProgrammerId) return;
    const noteNum = Number(note);
    if (isNaN(noteNum) || noteNum < 0) {
      Alert.alert('Erreur', 'Veuillez saisir une note valide (≥ 0).');
      return;
    }
    setSubmittingGrade(true);
    try {
      await participationService.update({
        utilisateurId: active.utilisateurId,
        exerciseProgrammerId: active.exerciseProgrammerId,
        note: String(noteNum),
        appreciation: commentaire.trim() || undefined,
        etatSoumission: 'CORRIGE',
      });
      Alert.alert('Succès', 'Correction enregistrée avec succès.');
      setActive(null);
      await load();
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : "Échec de l'enregistrement de la note.");
    } finally {
      setSubmittingGrade(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (active) setActive(null);
            else onBack();
          }}
          style={styles.backButton}
        >
          <FontAwesome5 name="arrow-left" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerEyebrow}>Corrections & Évaluations</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {active
              ? `Copie de ${active.utilisateurPrenom || ''} ${active.utilisateurNom || ''}`.trim()
              : 'Copies à corriger'}
          </Text>
        </View>
      </View>

      {!active ? (
        /* List of Participations */
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {loading ? (
            <LoadingSpinner label="Chargement des copies..." />
          ) : participations.length === 0 ? (
            <EmptyState
              icon="check-circle"
              title="Aucune copie en attente"
              message="Tous les devoirs et exercices soumis ont été corrigés."
            />
          ) : (
            participations.map((p) => (
              <TouchableOpacity
                key={`${p.utilisateurId}-${p.exerciseProgrammerId}`}
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => handleOpenParticipation(p)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.avatar}>
                    <FontAwesome5 name="user-graduate" size={14} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.studentName}>
                      {p.utilisateurPrenom} {p.utilisateurNom}
                    </Text>
                    <Text style={styles.cardMeta}>
                      {p.exerciseNom ? `Exercice : ${p.exerciseNom}` : 'Devoir'}
                      {p.classeNom ? ` • ${p.classeNom}` : ''}
                    </Text>
                  </View>
                  <Badge label={p.etatSoumission ?? 'SOUMIS'} tone="warning" />
                </View>
                <View style={styles.cardFooter}>
                  <Text style={styles.cardActionText}>Corriger la copie</Text>
                  <FontAwesome5 name="arrow-right" size={12} color={colors.primary} />
                </View>
              </TouchableOpacity>
            ))
          )}
          <View style={{ height: 60 }} />
        </ScrollView>
      ) : (
        /* Detail & Grading View */
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Détails de l'élève</Text>
            <Text style={styles.bodyText}>
              Élève : <Text style={styles.boldText}>{active.utilisateurPrenom} {active.utilisateurNom}</Text>
            </Text>
            {active.dateSoumission ? (
              <Text style={styles.bodyText}>
                Date de soumission : {new Date(active.dateSoumission).toLocaleString('fr-FR')}
              </Text>
            ) : null}
          </View>

          {/* Answers review */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Réponses de l'élève</Text>
            {loadingReponses ? (
              <LoadingSpinner label="Chargement des réponses..." />
            ) : reponses.length === 0 ? (
              <Text style={styles.emptyText}>Aucune réponse détaillée disponible.</Text>
            ) : (
              reponses.map((r, i) => (
                <View key={r.id || i} style={styles.answerBox}>
                  <Text style={styles.questionTitle}>Question {i + 1}</Text>
                  {r.questionIntitule ? <Text style={styles.bodyText}>{r.questionIntitule}</Text> : null}
                  <Text style={styles.answerText}>
                    Réponse donnée : <Text style={styles.boldText}>{r.reponseTexte ?? '—'}</Text>
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* Grading Form */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Attribution de la note</Text>
            <Input
              label="Note sur 20 *"
              value={note}
              onChangeText={setNote}
              placeholder="Ex: 16"
              keyboardType="numeric"
            />
            <Input
              label="Commentaire / Appréciation (optionnel)"
              value={commentaire}
              onChangeText={setCommentaire}
              placeholder="Ex: Très bon travail, attention aux détails..."
              multiline
              numberOfLines={3}
              style={{ height: 80, textAlignVertical: 'top' }}
            />
            <Button
              label="Enregistrer la note"
              onPress={handleSaveGrade}
              loading={submittingGrade}
              fullWidth
              style={{ marginTop: spacing.md }}
            />
          </View>
          <View style={{ height: 60 }} />
        </ScrollView>
      )}
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
  content: { flex: 1, padding: 16 },
  error: { color: colors.danger, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentName: { ...typography.bodyBold, color: colors.text },
  cardMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cardActionText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  bodyText: { ...typography.body, color: colors.text, marginBottom: 4 },
  boldText: { fontWeight: '700' },
  emptyText: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic' },
  answerBox: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  questionTitle: { ...typography.bodyBold, color: colors.primary, marginBottom: 2 },
  answerText: { ...typography.caption, color: colors.text, marginTop: 2 },
});

export default ExerciseCorrectionsView;
