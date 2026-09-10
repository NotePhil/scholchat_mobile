import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Badge, BottomSheet, Button, EmptyState, Input, LoadingSpinner } from '../../../../components/ui';
import DateTimeField from '../../../../components/common/DateTimeField';
import { colors, radius, spacing, typography, useThemeColors } from '../../../../styles/theme';
import { classService } from '../../../../services/classService';
import { exerciseProgrammerService, userService } from '../../../../services/api';
import { useUser } from '../../../../context/UserContext';
import { ClassEntity, Exercise, ExerciseProgramme } from '../../../../types';

interface ScheduleExerciseModalProps {
  visible: boolean;
  onClose: () => void;
  onScheduled: () => void;
  exercises: Exercise[];
}

interface ProgItem extends ExerciseProgramme {
  isOwn: boolean;
  programmeParNom?: string;
}

const TYPE_LABELS: Record<string, string> = { EXERCICE: 'Exercice libre', DEVOIR: 'Devoir' };

const STATUS_TONE: Record<string, 'success' | 'info' | 'warning' | 'neutral' | 'danger'> = {
  ACTIF: 'success',
  PUBLIE: 'info',
  BROUILLON: 'warning',
  INACTIF: 'neutral',
  EXPIRE: 'danger',
};

/** Web auto-derives "Expiré" once the end date has passed on an otherwise-active programmation, rather than requiring a manual state change. */
const getEffectiveEtat = (p: ExerciseProgramme): string => {
  const etat = p.etat ?? '';
  if ((etat === 'ACTIF' || etat === 'PUBLIE') && p.dateFinExoEffectif && new Date(p.dateFinExoEffectif) < new Date()) {
    return 'EXPIRE';
  }
  return etat;
};

const fmtDateTime = (d?: string) => (d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

type ViewMode = 'list' | 'form';

/**
 * "Programmer les Exercices" — mirrors web's ExerciseProgrammerContent.jsx
 * exactly: a list of every existing programmation (own AND other
 * professors' on shared classes, each tagged accordingly), with class/
 * status/type filters, search, a detail view, and delete (own only) — not
 * just a bare create form. Mobile used to have ONLY the create form here,
 * with no way to see, filter, or remove a programmation once made.
 */
const ScheduleExerciseModal = ({ visible, onClose, onScheduled, exercises }: ScheduleExerciseModalProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useUser();
  const [view, setView] = useState<ViewMode>('list');

  // ── list state ──
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [programmations, setProgrammations] = useState<ProgItem[]>([]);
  const [loadingProgs, setLoadingProgs] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [detailProg, setDetailProg] = useState<ProgItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClassId, setFilterClassId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');

  // ── form state ──
  const [formClasses, setFormClasses] = useState<ClassEntity[]>([]);
  const [loadingFormClasses, setLoadingFormClasses] = useState(false);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [selectedClasseIds, setSelectedClasseIds] = useState<string[]>([]);
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
      const classItems = classResults.filter((r) => r.status === 'fulfilled').flatMap((r) => (r as PromiseFulfilledResult<ExerciseProgramme[]>).value);

      const merged = new Map<string, ProgItem>();
      [...classItems, ...ownItems].forEach((p) => {
        if (p?.id) merged.set(String(p.id), { ...p, isOwn: String(p.programmeParId) === String(user.userId) });
      });

      const nonOwnIds = [...new Set(Array.from(merged.values()).filter((p) => !p.isOwn && p.programmeParId).map((p) => String(p.programmeParId)))];
      const names: Record<string, string> = {};
      await Promise.allSettled(
        nonOwnIds.map(async (id) => {
          try {
            const u = (await userService.getUserById(id)) as Record<string, any>;
            names[id] = `${u.prenom ?? ''} ${u.nom ?? ''}`.trim() || String(u.email ?? id);
          } catch {
            // leave unresolved — falls back to a generic label below
          }
        })
      );
      merged.forEach((p, key) => {
        if (!p.isOwn && p.programmeParId) merged.set(key, { ...p, programmeParNom: names[String(p.programmeParId)] });
      });

      const STATUS_ORDER: Record<string, number> = { EN_COURS: 0, PLANIFIE: 1, ANNULE: 2 };
      const sorted = Array.from(merged.values()).sort((a, b) => {
        const oa = STATUS_ORDER[(a as any).etatExoProgramme] ?? 3;
        const ob = STATUS_ORDER[(b as any).etatExoProgramme] ?? 3;
        if (oa !== ob) return oa - ob;
        const da = a.dateExoPrevue ? new Date(a.dateExoPrevue).getTime() : 0;
        const db = b.dateExoPrevue ? new Date(b.dateExoPrevue).getTime() : 0;
        return db - da;
      });
      setProgrammations(sorted);
    } finally {
      setLoadingProgs(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    if (!visible) return;
    setView('list');
    setDetailProg(null);
    loadProgs();
  }, [visible, loadProgs]);

  useEffect(() => {
    if (view !== 'form' || !user?.userId) return;
    setLoadingFormClasses(true);
    classService
      .getClassesWithPublicationRights(user.userId)
      .then(setFormClasses)
      .catch(() => setFormClasses([]))
      .finally(() => setLoadingFormClasses(false));
  }, [view, user?.userId]);

  const resetForm = () => {
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
      resetForm();
      onScheduled();
      await loadProgs();
      setView('list');
      Alert.alert('Succès', 'Exercice programmé et diffusé avec succès.');
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Échec de la programmation.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (prog: ProgItem) => {
    Alert.alert('Supprimer cette programmation ?', undefined, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(prog.id);
          try {
            await exerciseProgrammerService.remove(prog.id);
            setProgrammations((prev) => prev.filter((p) => p.id !== prog.id));
            setDetailProg(null);
            onScheduled();
          } catch (err) {
            Alert.alert('Erreur', err instanceof Error ? err.message : 'Échec de la suppression.');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  const classNamesFor = useCallback(
    (prog: ExerciseProgramme): string[] => {
      const embedded = (prog as any).classesDiffusees as { id: string; nom?: string }[] | undefined;
      if (embedded && embedded.length > 0) return embedded.map((c) => c.nom ?? c.id);
      return (prog.classeIds ?? []).map((id) => classes.find((c) => c.id === id)?.nom ?? id);
    },
    [classes]
  );

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return programmations.filter((p) => {
      const matchClass = !filterClassId || (p.classeIds ?? []).includes(filterClassId);
      const matchSearch = !term || (p.nom ?? '').toLowerCase().includes(term);
      const matchStatus = !filterStatus || getEffectiveEtat(p) === filterStatus;
      const matchType = !filterType || p.typeAssignation === filterType;
      return matchClass && matchSearch && matchStatus && matchType;
    });
  }, [programmations, searchTerm, filterClassId, filterStatus, filterType]);

  const stats = useMemo(
    () => ({
      total: programmations.length,
      actif: programmations.filter((p) => ['ACTIF', 'PUBLIE'].includes(getEffectiveEtat(p))).length,
      exercices: programmations.filter((p) => p.typeAssignation === 'EXERCICE').length,
      devoirs: programmations.filter((p) => p.typeAssignation === 'DEVOIR').length,
    }),
    [programmations]
  );

  const hasActiveFilters = !!(searchTerm || filterClassId || filterStatus || filterType);
  const resetFilters = () => {
    setSearchTerm('');
    setFilterClassId('');
    setFilterStatus('');
    setFilterType('');
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={view === 'list' ? 'Programmer les Exercices' : 'Nouvelle programmation'}>
      {view === 'list' ? (
        <View>
          <View style={styles.statsRow}>
            <StatChip label="Total" value={stats.total} color={colors.primary} />
            <StatChip label="Actifs" value={stats.actif} color={colors.success} />
            <StatChip label="Libres" value={stats.exercices} color={colors.info} />
            <StatChip label="Devoirs" value={stats.devoirs} color="#7C3AED" />
          </View>

          <Input placeholder="Rechercher par nom d'exercice..." value={searchTerm} onChangeText={setSearchTerm} />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <FilterChip label="Toutes les classes" active={!filterClassId} onPress={() => setFilterClassId('')} />
            {classes.map((c) => (
              <FilterChip key={c.id} label={c.nom ?? 'Classe'} active={filterClassId === c.id} onPress={() => setFilterClassId(c.id)} />
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <FilterChip label="Tous les statuts" active={!filterStatus} onPress={() => setFilterStatus('')} />
            {['ACTIF', 'PUBLIE', 'EXPIRE', 'BROUILLON', 'INACTIF'].map((s) => (
              <FilterChip key={s} label={STATUS_TONE[s] ? s : s} active={filterStatus === s} onPress={() => setFilterStatus(s)} />
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <FilterChip label="Tous les types" active={!filterType} onPress={() => setFilterType('')} />
            <FilterChip label="Exercice libre" active={filterType === 'EXERCICE'} onPress={() => setFilterType('EXERCICE')} />
            <FilterChip label="Devoir" active={filterType === 'DEVOIR'} onPress={() => setFilterType('DEVOIR')} />
          </ScrollView>
          {hasActiveFilters ? (
            <TouchableOpacity onPress={resetFilters} style={styles.resetFiltersBtn}>
              <FontAwesome5 name="times-circle" size={11} color={colors.danger} />
              <Text style={styles.resetFiltersText}>Réinitialiser les filtres</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.newButton} onPress={() => setView('form')}>
            <FontAwesome5 name="plus" size={13} color={colors.white} />
            <Text style={styles.newButtonText}>Programmer un exercice</Text>
          </TouchableOpacity>

          <ScrollView style={styles.progList} showsVerticalScrollIndicator={false}>
            {loadingProgs ? (
              <LoadingSpinner label="Chargement des programmations..." />
            ) : filtered.length === 0 ? (
              <EmptyState icon="calendar" title="Aucune programmation" message="Programmez un exercice pour le voir apparaître ici." />
            ) : (
              filtered.map((prog) => {
                const effectiveEtat = getEffectiveEtat(prog);
                const classNames = classNamesFor(prog);
                return (
                  <TouchableOpacity key={prog.id} style={styles.progCard} onPress={() => setDetailProg(prog)} activeOpacity={0.7}>
                    <View style={styles.progHeader}>
                      <FontAwesome5 name={prog.typeAssignation === 'DEVOIR' ? 'file-alt' : 'bolt'} size={14} color={prog.typeAssignation === 'DEVOIR' ? '#7C3AED' : colors.info} />
                      <Text style={styles.progName} numberOfLines={1}>
                        {prog.nom ?? 'Exercice'}
                      </Text>
                    </View>
                    <View style={styles.progBadgeRow}>
                      <Badge label={TYPE_LABELS[prog.typeAssignation ?? ''] ?? prog.typeAssignation ?? ''} tone={prog.typeAssignation === 'DEVOIR' ? 'neutral' : 'info'} />
                      <Badge label={effectiveEtat || '—'} tone={STATUS_TONE[effectiveEtat] ?? 'neutral'} />
                      {prog.isOwn ? <Badge label="Votre programmation" tone="info" /> : <Badge label="Autre professeur" tone="warning" />}
                    </View>
                    <Text style={styles.progDates}>
                      {fmtDateTime(prog.dateDebutExoEffectif)} → {fmtDateTime(prog.dateFinExoEffectif)}
                    </Text>
                    {classNames.length > 0 ? (
                      <View style={styles.classChipsRow}>
                        {classNames.map((n, i) => (
                          <View key={i} style={styles.classChip}>
                            <Text style={styles.classChipText}>{n}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                    {prog.isOwn ? (
                      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(prog)} disabled={deletingId === prog.id}>
                        <FontAwesome5 name="trash" size={12} color={colors.danger} />
                        <Text style={styles.deleteBtnText}>{deletingId === prog.id ? 'Suppression...' : 'Supprimer'}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </TouchableOpacity>
                );
              })
            )}
            <View style={{ height: spacing.lg }} />
          </ScrollView>
        </View>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <TouchableOpacity onPress={() => setView('list')} style={styles.backRow}>
            <FontAwesome5 name="arrow-left" size={13} color={colors.primary} />
            <Text style={styles.backText}>Retour à la liste</Text>
          </TouchableOpacity>

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
          {loadingFormClasses ? (
            <LoadingSpinner label="Chargement des classes..." />
          ) : formClasses.length === 0 ? (
            <EmptyState icon="chalkboard" title="Aucune classe" />
          ) : (
            <View style={styles.chipRow}>
              {formClasses.map((cls) => {
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
      )}

      <BottomSheet visible={!!detailProg} onClose={() => setDetailProg(null)} title="Détail de la programmation">
        {detailProg ? (
          <ScrollView style={{ maxHeight: 420 }}>
            <DetailRow label="Exercice" value={detailProg.nom ?? '—'} />
            <DetailRow label="Type" value={TYPE_LABELS[detailProg.typeAssignation ?? ''] ?? detailProg.typeAssignation ?? '—'} />
            <DetailRow label="Statut" value={getEffectiveEtat(detailProg) || '—'} />
            <DetailRow label="Date prévue" value={fmtDateTime(detailProg.dateExoPrevue)} />
            <DetailRow label="Début effectif" value={fmtDateTime(detailProg.dateDebutExoEffectif)} />
            <DetailRow label="Fin effective" value={fmtDateTime(detailProg.dateFinExoEffectif)} />
            <DetailRow label="Classes" value={classNamesFor(detailProg).join(', ') || 'Aucune'} />
            {!detailProg.isOwn ? <DetailRow label="Programmé par" value={detailProg.programmeParNom ?? 'Autre professeur'} /> : null}
            {detailProg.isOwn ? (
              <Button
                label="Supprimer cette programmation"
                variant="danger"
                onPress={() => handleDelete(detailProg)}
                loading={deletingId === detailProg.id}
                fullWidth
                style={{ marginTop: spacing.md, marginBottom: spacing.lg }}
              />
            ) : null}
          </ScrollView>
        ) : null}
      </BottomSheet>
    </BottomSheet>
  );
};

const StatChip = ({ label, value, color }: { label: string; value: number; color: string }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.statChip}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
};

const FilterChip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <TouchableOpacity style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const DetailRow = ({ label, value }: { label: string; value: string }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  scroll: { maxHeight: 560 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  backText: { ...typography.bodyBold, color: colors.primary, fontSize: 13 },
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
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md, gap: spacing.sm },
  statChip: { flex: 1, alignItems: 'center', backgroundColor: colors.background, borderRadius: radius.sm, paddingVertical: spacing.sm },
  statValue: { ...typography.h3, fontWeight: '700' },
  statLabel: { ...typography.caption, color: colors.textMuted, fontSize: 10 },
  filterScroll: { marginTop: spacing.sm, flexGrow: 0 },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.grayLight, marginRight: spacing.xs },
  filterChipActive: { backgroundColor: colors.primary },
  filterChipText: { ...typography.caption, color: colors.text, fontSize: 11 },
  filterChipTextActive: { color: colors.white, fontWeight: '600' },
  resetFiltersBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, alignSelf: 'flex-start' },
  resetFiltersText: { ...typography.caption, color: colors.danger, fontWeight: '600' },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  newButtonText: { ...typography.bodyBold, color: colors.white },
  progList: { maxHeight: 340 },
  progCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  progHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  progName: { ...typography.bodyBold, color: colors.text, flex: 1 },
  progBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
  progDates: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
  classChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
  classChip: { backgroundColor: colors.grayLight, borderRadius: 10, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  classChipText: { ...typography.caption, color: colors.text, fontSize: 11 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xs, alignSelf: 'flex-start' },
  deleteBtnText: { ...typography.caption, color: colors.danger, fontWeight: '600' },
  detailRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: { ...typography.caption, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase', fontSize: 10, marginBottom: 2 },
  detailValue: { ...typography.body, color: colors.text },
});

export default ScheduleExerciseModal;
