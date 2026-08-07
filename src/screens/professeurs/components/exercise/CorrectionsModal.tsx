import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Badge, BottomSheet, Button, EmptyState, Input, LoadingSpinner } from '../../../../components/ui';
import { colors, spacing, typography } from '../../../../styles/theme';
import { exerciseProgrammerService, participationService, reponseService } from '../../../../services/api';
import { useUser } from '../../../../context/UserContext';
import { Participation, Question, Reponse } from '../../../../types';

interface CorrectionsModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Professor grading screen — lists submissions awaiting correction
 * (participationService.getToCorrectByProfessor) and lets the professor open
 * one to review each question's answer and record a grade/appreciation.
 */
const CorrectionsModal = ({ visible, onClose }: CorrectionsModalProps) => {
  const { user } = useUser();
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [active, setActive] = useState<Participation | null>(null);

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
    if (visible) load();
  }, [visible, load]);

  const handleGraded = () => {
    setActive(null);
    load();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Copies à corriger">
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? (
          <LoadingSpinner label="Chargement des copies..." />
        ) : participations.length === 0 ? (
          <EmptyState icon="check-circle" title="Aucune copie en attente" message="Tous les devoirs ont été corrigés." />
        ) : (
          participations.map((p) => (
            <TouchableOpacity
              key={`${p.utilisateurId}-${p.exerciseProgrammerId}`}
              style={styles.card}
              onPress={() => setActive(p)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                  {p.utilisateurPrenom} {p.utilisateurNom}
                </Text>
                <Badge label={p.etatSoumission ?? 'SOUMIS'} tone="warning" />
              </View>
              <Text style={styles.cardSubtitle}>{p.exerciseProgrammerNom ?? 'Exercice'}</Text>
              {p.dateSoumission ? (
                <Text style={styles.cardMeta}>Soumis le {new Date(p.dateSoumission).toLocaleString('fr-FR')}</Text>
              ) : null}
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {active && <GradingDetail participation={active} onClose={() => setActive(null)} onGraded={handleGraded} />}
    </BottomSheet>
  );
};

interface GradingDetailProps {
  participation: Participation;
  onClose: () => void;
  onGraded: () => void;
}

const GradingDetail = ({ participation, onClose, onGraded }: GradingDetailProps) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [reponses, setReponses] = useState<Record<string, Reponse>>({});
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState(participation.note ?? '');
  const [appreciation, setAppreciation] = useState(participation.appreciation ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const programme = await exerciseProgrammerService.getById(participation.exerciseProgrammerId as string);
        const qs = programme.questions ?? [];
        setQuestions(qs);
        const entries = await Promise.all(
          qs.map(async (q) => {
            try {
              const r = await reponseService.getOne(participation.utilisateurId as string, q.id);
              return [q.id, r] as const;
            } catch {
              return null;
            }
          })
        );
        const map: Record<string, Reponse> = {};
        entries.forEach((entry) => {
          if (entry) map[entry[0]] = entry[1];
        });
        setReponses(map);
      } catch {
        setQuestions([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [participation]);

  const toggleCorrect = async (question: Question) => {
    const current = reponses[question.id];
    if (!current) return;
    const nextValue = !current.estCorrecte;
    setReponses((prev) => ({ ...prev, [question.id]: { ...current, estCorrecte: nextValue } }));
    try {
      await reponseService.update({
        utilisateurId: participation.utilisateurId as string,
        questionId: question.id,
        estCorrecte: nextValue,
      });
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Échec de la mise à jour de la réponse.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await participationService.update({
        utilisateurId: participation.utilisateurId as string,
        exerciseProgrammerId: participation.exerciseProgrammerId as string,
        etatSoumission: 'CORRIGE',
        note: note.trim() || undefined,
        appreciation: appreciation.trim() || undefined,
      });
      Alert.alert('Succès', 'La copie a été corrigée.');
      onGraded();
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Échec de l\'enregistrement de la note.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      visible
      onClose={onClose}
      title={`${participation.utilisateurPrenom ?? ''} ${participation.utilisateurNom ?? ''}`.trim()}
    >
      <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
        {loading ? (
          <LoadingSpinner label="Chargement des réponses..." />
        ) : questions.length === 0 ? (
          <Text style={styles.cardSubtitle}>Aucune question trouvée pour cet exercice.</Text>
        ) : (
          questions.map((q, index) => {
            const r = reponses[q.id];
            return (
              <View key={q.id} style={styles.questionBlock}>
                <Text style={styles.questionText}>
                  {index + 1}. {q.intitule}
                </Text>
                <Text style={styles.answerText}>Réponse : {r?.reponseUtilisateur ?? '—'}</Text>
                <TouchableOpacity style={styles.correctToggle} onPress={() => toggleCorrect(q)} disabled={!r}>
                  <FontAwesome5
                    name={r?.estCorrecte ? 'check-circle' : 'times-circle'}
                    solid
                    size={16}
                    color={r?.estCorrecte ? colors.success : colors.danger}
                  />
                  <Text style={[styles.correctToggleText, { color: r?.estCorrecte ? colors.success : colors.danger }]}>
                    {r?.estCorrecte ? 'Correcte' : 'Incorrecte'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}

        <Input label="Note" value={note} onChangeText={setNote} placeholder="Ex: 14/20" />
        <Input
          label="Appréciation"
          value={appreciation}
          onChangeText={setAppreciation}
          placeholder="Commentaire pour l'élève"
          multiline
          numberOfLines={3}
        />

        <Button label="Valider la correction" onPress={handleSave} loading={saving} fullWidth style={{ marginTop: spacing.md, marginBottom: spacing.lg }} />
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  scroll: { maxHeight: 500 },
  error: { color: colors.danger, marginBottom: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  cardTitle: { ...typography.bodyBold, color: colors.text },
  cardSubtitle: { ...typography.body, color: colors.textMuted },
  cardMeta: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  questionBlock: { marginBottom: spacing.md, backgroundColor: colors.background, borderRadius: 10, padding: spacing.md },
  questionText: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.xs },
  answerText: { ...typography.body, color: colors.text, marginBottom: spacing.sm },
  correctToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  correctToggleText: { ...typography.caption, fontWeight: '600' },
});

export default CorrectionsModal;
