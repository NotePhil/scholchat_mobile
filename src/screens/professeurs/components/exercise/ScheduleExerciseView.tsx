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
import {
  Badge,
  Button,
  DropdownField,
  EmptyState,
  Input,
  LoadingSpinner,
} from '../../../../components/ui';
import DateTimeField from '../../../../components/common/DateTimeField';
import { colors, radius, spacing, typography } from '../../../../styles/theme';
import { classService } from '../../../../services/classService';
import { exerciseProgrammerService } from '../../../../services/api';
import { useUser } from '../../../../context/UserContext';
import { ClassEntity, Exercise, ExerciseProgramme } from '../../../../types';

export interface ScheduleExerciseViewProps {
  onBack: () => void;
  onScheduled: () => void;
  exercises: Exercise[];
  initialView?: 'list' | 'form';
}

interface ProgItem extends ExerciseProgramme {
  isOwn: boolean;
  programmeParNom?: string;
}

const TYPE_OPTIONS = [
  { label: 'Exercice libre', value: 'EXERCICE' },
  { label: 'Devoir noté', value: 'DEVOIR' },
];

const STATUS_OPTIONS = [
  { label: 'Tous les statuts', value: '' },
  { label: 'Actif', value: 'ACTIF' },
  { label: 'Publié', value: 'PUBLIE' },
  { label: 'Brouillon', value: 'BROUILLON' },
  { label: 'Inactif', value: 'INACTIF' },
  { label: 'Expiré', value: 'EXPIRE' },
];

const STATUS_TONE: Record<string, 'success' | 'info' | 'warning' | 'neutral' | 'danger'> = {
  ACTIF: 'success',
  PUBLIE: 'info',
  BROUILLON: 'warning',
  INACTIF: 'neutral',
  EXPIRE: 'danger',
};

const fmtDateTime = (d?: string) =>
  d
    ? new Date(d).toLocaleString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

/**
 * Full page Exercise Scheduling View (Page seule et non modale).
 * Uses DropdownField for all selections (Exercice, Classe, Type d'assignation, Filtres).
 */
export const ScheduleExerciseView = ({
  onBack,
  onScheduled,
  exercises,
  initialView = 'list',
}: ScheduleExerciseViewProps) => {
  const { user } = useUser();
  const [view, setView] = useState<'list' | 'form'>(initialView);

  // ── list state ──
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [programmations, setProgrammations] = useState<ProgItem[]>([]);
  const [loadingProgs, setLoadingProgs] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClassId, setFilterClassId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [detailProg, setDetailProg] = useState<ProgItem | null>(null);

  // ── form state ──
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [selectedClasseId, setSelectedClasseId] = useState<string | null>(null);
  const [typeAssignation, setTypeAssignation] = useState<'EXERCICE' | 'DEVOIR'>('EXERCICE');
  const [dateExoPrevue, setDateExoPrevue] = useState('');
  const [dateDebutExoEffectif, setDateDebutExoEffectif] = useState('');
  const [dateFinExoEffectif, setDateFinExoEffectif] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadProgs = useCallback(async () => {
    if (!user?.userId) return;
    setLoadingProgs(true);
    try {
      const allClasses = await classService.getClasses(user.userId).catch(() => [] as ClassEntity[]);
      setClasses(allClasses);

      const [ownResult, ...classResults] = await Promise.allSettled([
        exerciseProgrammerService.getByProfessor(user.userId),
        ...allClasses.map((c) => exerciseProgrammerService.getByClasse(c.id)),
      ]);
      const ownItems = ownResult.status === 'fulfilled' ? ownResult.value : [];
      const classItems = classResults
        .filter((r) => r.status === 'fulfilled')
        .flatMap((r) => (r as PromiseFulfilledResult<ExerciseProgramme[]>).value);

      const merged = new Map<string, ProgItem>();
      [...classItems, ...ownItems].forEach((p) => {
        if (p?.id) merged.set(String(p.id), { ...p, isOwn: String(p.programmeParId) === String(user.userId) });
      });

      setProgrammations(Array.from(merged.values()));
    } catch {
      setProgrammations([]);
    } finally {
      setLoadingProgs(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    loadProgs();
  }, [loadProgs]);

  const handleDelete = (item: ProgItem) => {
    Alert.alert('Supprimer la programmation', 'Voulez-vous vraiment supprimer cet exercice programmé ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          setBusyId(item.id);
          try {
            await exerciseProgrammerService.remove(item.id);
            setProgrammations((prev) => prev.filter((p) => p.id !== item.id));
            if (detailProg?.id === item.id) setDetailProg(null);
            onScheduled();
          } catch (err) {
            Alert.alert('Erreur', err instanceof Error ? err.message : 'Échec de la suppression.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const handleSubmit = async () => {
    if (!user?.userId) {
      Alert.alert('Erreur', 'Utilisateur non identifié.');
      return;
    }
    if (!selectedExerciseId) {
      Alert.alert('Erreur', 'Veuillez sélectionner un exercice dans la liste déroulante.');
      return;
    }
    if (!selectedClasseId) {
      Alert.alert('Erreur', 'Veuillez sélectionner une classe dans la liste déroulante.');
      return;
    }
    if (!dateExoPrevue) {
      Alert.alert('Erreur', 'Veuillez renseigner la date prévue.');
      return;
    }

    setSubmitting(true);
    try {
      await exerciseProgrammerService.programmer({
        exerciseId: selectedExerciseId,
        classeIds: [selectedClasseId],
        typeAssignation,
        dateExoPrevue,
        dateDebutExoEffectif: dateDebutExoEffectif || undefined,
        dateFinExoEffectif: dateFinExoEffectif || undefined,
        programmeParId: user.userId,
      });
      Alert.alert('Succès', 'Exercice programmé avec succès.');
      setSelectedExerciseId(null);
      setSelectedClasseId(null);
      setDateExoPrevue('');
      setDateDebutExoEffectif('');
      setDateFinExoEffectif('');
      onScheduled();
      await loadProgs();
      setView('list');
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Échec de la programmation.');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return programmations.filter((p) => {
      const matchSearch =
        !term ||
        (p.nom ?? '').toLowerCase().includes(term) ||
        (p.classeNom ?? '').toLowerCase().includes(term);
      const matchClass = !filterClassId || (p.classesIds ?? []).includes(filterClassId);
      const matchStatus = !filterStatus || (p.etat ?? '') === filterStatus;
      const matchType = !filterType || p.typeAssignation === filterType;
      return matchSearch && matchClass && matchStatus && matchType;
    });
  }, [programmations, searchTerm, filterClassId, filterStatus, filterType]);

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (view === 'form') setView('list');
            else onBack();
          }}
          style={styles.backButton}
        >
          <FontAwesome5 name="arrow-left" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerEyebrow}>Exercices & Devoirs</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {view === 'form' ? 'Programmer un exercice' : 'Exercices programmés'}
          </Text>
        </View>
        {view === 'list' && (
          <TouchableOpacity style={styles.headerActionBtn} onPress={() => setView('form')}>
            <FontAwesome5 name="plus" size={13} color={colors.white} />
            <Text style={styles.headerActionBtnText}>Nouveau</Text>
          </TouchableOpacity>
        )}
      </View>

      {view === 'list' ? (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Input
            placeholder="Rechercher par titre ou classe..."
            value={searchTerm}
            onChangeText={setSearchTerm}
          />

          {/* Filter Dropdowns */}
          <View style={styles.filtersBox}>
            <DropdownField
              label="Filtrer par classe"
              placeholder="Toutes les classes"
              value={filterClassId}
              options={[
                { label: 'Toutes les classes', value: '' },
                ...classes.map((c) => ({ label: c.nom ?? 'Classe', value: c.id })),
              ]}
              onChange={setFilterClassId}
            />

            <DropdownField
              label="Filtrer par type"
              placeholder="Tous les types"
              value={filterType}
              options={[
                { label: 'Tous les types', value: '' },
                ...TYPE_OPTIONS,
              ]}
              onChange={setFilterType}
            />

            <DropdownField
              label="Filtrer par statut"
              placeholder="Tous les statuts"
              value={filterStatus}
              options={STATUS_OPTIONS}
              onChange={setFilterStatus}
            />
          </View>

          {loadingProgs ? (
            <LoadingSpinner label="Chargement des programmations..." />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="calendar-alt"
              title="Aucun exercice programmé"
              message="Appuyez sur 'Nouveau' pour programmer un exercice ou un devoir pour vos classes."
              actionLabel="Programmer un exercice"
              onAction={() => setView('form')}
            />
          ) : (
            filtered.map((item) => {
              const etat = item.etat ?? 'ACTIF';
              return (
                <View key={item.id} style={styles.card}>
                  <TouchableOpacity
                    onPress={() => setDetailProg(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.cardHeader}>
                      <FontAwesome5
                        name={item.typeAssignation === 'DEVOIR' ? 'clipboard-check' : 'clipboard-list'}
                        size={14}
                        color={colors.primary}
                      />
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {item.nom ?? 'Exercice'}
                      </Text>
                      <Badge label={etat} tone={STATUS_TONE[etat] ?? 'neutral'} />
                    </View>

                    <Text style={styles.cardMeta}>
                      <FontAwesome5 name="tag" size={11} color={colors.textMuted} />{' '}
                      {item.typeAssignation === 'DEVOIR' ? 'Devoir noté' : 'Exercice libre'}
                    </Text>

                    <Text style={styles.cardMeta}>
                      <FontAwesome5 name="clock" size={11} color={colors.textMuted} /> Prévu le :{' '}
                      {fmtDateTime(item.dateExoPrevue)}
                    </Text>

                    {item.classeNom ? (
                      <Text style={styles.cardMeta}>
                        <FontAwesome5 name="chalkboard" size={11} color={colors.textMuted} /> Classe :{' '}
                        {item.classeNom}
                      </Text>
                    ) : null}
                  </TouchableOpacity>

                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => setDetailProg(item)}
                    >
                      <FontAwesome5 name="eye" size={12} color={colors.primary} />
                      <Text style={[styles.actionBtnText, { color: colors.primary }]}>Détails</Text>
                    </TouchableOpacity>

                    {item.isOwn && (
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleDelete(item)}
                        disabled={busyId === item.id}
                      >
                        <FontAwesome5 name="trash" size={12} color={colors.danger} />
                        <Text style={[styles.actionBtnText, { color: colors.danger }]}>Supprimer</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
          <View style={{ height: 60 }} />
        </ScrollView>
      ) : (
        /* Full Page Form View */
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.formTitle}>Informations de programmation</Text>

            {/* Exercise Dropdown */}
            <DropdownField
              label="Exercice à programmer *"
              placeholder="Sélectionner un exercice..."
              value={selectedExerciseId ?? ''}
              options={exercises.map((e) => ({
                label: `${e.nom} (${e.niveau})`,
                value: e.id,
              }))}
              onChange={(val) => setSelectedExerciseId(val || null)}
            />

            {/* Class Dropdown */}
            <DropdownField
              label="Classe cible *"
              placeholder="Sélectionner une classe..."
              value={selectedClasseId ?? ''}
              options={classes.map((cls) => ({
                label: `${cls.nom} (${cls.niveau || 'N/A'})`,
                value: cls.id,
              }))}
              onChange={(val) => setSelectedClasseId(val || null)}
            />

            {/* Type Assignation Dropdown */}
            <DropdownField
              label="Type d'assignation *"
              placeholder="Choisir le type..."
              value={typeAssignation}
              options={TYPE_OPTIONS}
              onChange={(val) => setTypeAssignation((val as 'EXERCICE' | 'DEVOIR') || 'EXERCICE')}
            />

            {/* Date Prevue */}
            <DateTimeField
              label="Date et heure prévue *"
              value={dateExoPrevue}
              onChange={setDateExoPrevue}
              required
            />

            {/* Date Debut */}
            <DateTimeField
              label="Date de début effectif (optionnel)"
              value={dateDebutExoEffectif}
              onChange={setDateDebutExoEffectif}
            />

            {/* Date Fin */}
            <DateTimeField
              label="Date limite de soumission (optionnel)"
              value={dateFinExoEffectif}
              onChange={setDateFinExoEffectif}
            />
          </View>

          <Button
            label="Programmer l'exercice"
            onPress={handleSubmit}
            loading={submitting}
            fullWidth
            style={{ marginBottom: 60 }}
          />
        </ScrollView>
      )}

      {/* Details Dialog */}
      {detailProg && (
        <View style={styles.detailOverlay}>
          <View style={styles.detailModalCard}>
            <View style={styles.detailModalHeader}>
              <Text style={styles.detailModalTitle}>Détail de la programmation</Text>
              <TouchableOpacity onPress={() => setDetailProg(null)}>
                <FontAwesome5 name="times" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 380 }}>
              <DetailRow label="Exercice" value={detailProg.nom ?? '—'} />
              <DetailRow
                label="Type"
                value={detailProg.typeAssignation === 'DEVOIR' ? 'Devoir noté' : 'Exercice libre'}
              />
              <DetailRow label="Statut" value={detailProg.etat ?? 'ACTIF'} />
              <DetailRow label="Date prévue" value={fmtDateTime(detailProg.dateExoPrevue)} />
              <DetailRow label="Début effectif" value={fmtDateTime(detailProg.dateDebutExoEffectif)} />
              <DetailRow label="Fin effective" value={fmtDateTime(detailProg.dateFinExoEffectif)} />
              <DetailRow label="Classe" value={detailProg.classeNom ?? '—'} />
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

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
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  headerActionBtnText: { ...typography.caption, color: colors.white, fontWeight: '700' },
  content: { flex: 1, padding: 16 },
  filtersBox: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  formTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.md },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  cardTitle: { ...typography.bodyBold, color: colors.text, flex: 1 },
  cardMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionBtnText: { ...typography.caption, fontWeight: '600' },
  detailOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  detailModalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '100%',
    maxHeight: '80%',
  },
  detailModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  detailModalTitle: { ...typography.h3, color: colors.text },
  detailRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    fontSize: 10,
    marginBottom: 2,
  },
  detailValue: { ...typography.body, color: colors.text },
});

export default ScheduleExerciseView;
