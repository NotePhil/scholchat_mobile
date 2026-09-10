import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Badge, BottomSheet, Button, EmptyState, Input, LoadingSpinner } from '../../../../components/ui';
import DateTimeField from '../../../../components/common/DateTimeField';
import PromptSheet from '../../../../components/common/PromptSheet';
import { colors, radius, spacing, typography, useThemeColors } from '../../../../styles/theme';
import { classService } from '../../../../services/classService';
import { accederService, coursProgrammerService } from '../../../../services/api';
import { useUser } from '../../../../context/UserContext';
import { ClassEntity, ClassUser, CoursProgramme } from '../../../../types';
import { Cours } from './DashboardCoursBody';

interface CoursProgrammerModalProps {
  visible: boolean;
  onClose: () => void;
  onScheduled: () => void;
  coursList: Cours[];
  /** Which sub-view to land on — the header calendar icon opens straight to the list, the FAB's "Programmer un cours" opens straight to the create form. */
  initialView?: ViewMode;
}

type ViewMode = 'list' | 'form';

const STATUS_LABELS: Record<string, string> = { PLANIFIE: 'Planifié', EN_COURS: 'En cours', TERMINE: 'Terminé', ANNULE: 'Annulé' };
const STATUS_TONE: Record<string, 'info' | 'success' | 'neutral' | 'danger'> = { PLANIFIE: 'info', EN_COURS: 'success', TERMINE: 'neutral', ANNULE: 'danger' };

const fmtDateTime = (d?: string | null) => (d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

/**
 * "Cours programmés" — merges what used to be two separate, much thinner
 * mobile components (ScheduleCoursModal: create-only, no dates picker, no
 * participants, no lieu validation; ScheduledCoursListModal: a list whose
 * only action mislabeled a hard DELETE as "Annuler") into one manager
 * matching web's CoursProgrammerContent.jsx: a real état lifecycle
 * (Démarrer/Terminer/Annuler-with-reason, distinct from Supprimer), per-class
 * participant selection, and an edit/reprogram path — none of which existed
 * on mobile before.
 */
const CoursProgrammerModal = ({ visible, onClose, onScheduled, coursList, initialView = 'list' }: CoursProgrammerModalProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useUser();
  const navigation = useNavigation<any>();
  const [view, setView] = useState<ViewMode>(initialView);

  // ── list state ──
  const [items, setItems] = useState<CoursProgramme[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState('');
  const [detailItem, setDetailItem] = useState<CoursProgramme | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancellingItem, setCancellingItem] = useState<CoursProgramme | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // ── form state (create or edit/reprogram) ──
  const [editingItem, setEditingItem] = useState<CoursProgramme | null>(null);
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [selectedCoursId, setSelectedCoursId] = useState<string | null>(null);
  const [selectedClasseId, setSelectedClasseId] = useState<string | null>(null);
  const [classParticipants, setClassParticipants] = useState<ClassUser[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [dateCoursPrevue, setDateCoursPrevue] = useState('');
  const [lieu, setLieu] = useState('');
  const [description, setDescription] = useState('');
  const [capaciteMax, setCapaciteMax] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadList = useCallback(async () => {
    if (!user?.userId) return;
    setLoadingList(true);
    setError('');
    try {
      setItems(await coursProgrammerService.getByProfessor(user.userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec du chargement des programmations.');
    } finally {
      setLoadingList(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    if (!visible) return;
    setView(initialView);
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (view !== 'form' || !user?.userId) return;
    setLoadingClasses(true);
    classService
      .getClassesWithPublicationRights(user.userId)
      .then(setClasses)
      .catch(() => setClasses([]))
      .finally(() => setLoadingClasses(false));
  }, [view, user?.userId]);

  // Participants are scoped to whichever single class is selected — matches
  // web's CoursProgrammerForm.jsx exactly, which re-fetches on every class
  // change and clears the previous selection, excluding parents.
  useEffect(() => {
    if (!selectedClasseId) {
      setClassParticipants([]);
      setSelectedParticipantIds([]);
      return;
    }
    setLoadingParticipants(true);
    accederService
      .getUsersWithAccess(selectedClasseId)
      .then((users) => {
        const filtered = users.filter((u) => (u.typeUtilisateur ?? '').toUpperCase() !== 'PARENT');
        setClassParticipants(filtered);
      })
      .catch(() => setClassParticipants([]))
      .finally(() => setLoadingParticipants(false));
    setSelectedParticipantIds([]);
  }, [selectedClasseId]);

  const resetForm = () => {
    setEditingItem(null);
    setSelectedCoursId(null);
    setSelectedClasseId(null);
    setSelectedParticipantIds([]);
    setDateCoursPrevue('');
    setLieu('');
    setDescription('');
    setCapaciteMax('');
  };

  const openCreateForm = () => {
    resetForm();
    setView('form');
  };

  const openEditForm = (item: CoursProgramme) => {
    setEditingItem(item);
    setSelectedCoursId(item.coursId ?? null);
    setSelectedClasseId(item.classesIds?.[0] ?? null);
    setSelectedParticipantIds(item.participantsIds ?? []);
    setDateCoursPrevue(item.dateCoursPrevue ?? '');
    setLieu(item.lieu ?? '');
    setDescription((item.description ?? '').startsWith('Annulé:') ? '' : item.description ?? '');
    setCapaciteMax((item as any).capaciteMax != null ? String((item as any).capaciteMax) : '');
    setDetailItem(null);
    setView('form');
  };

  const toggleParticipant = (id: string) => {
    setSelectedParticipantIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAllParticipants = () => {
    setSelectedParticipantIds((prev) => (prev.length === classParticipants.length ? [] : classParticipants.map((p) => p.id)));
  };

  const handleSubmit = async () => {
    if (!user?.userId) {
      Alert.alert('Erreur', 'Utilisateur non identifié.');
      return;
    }
    if (!selectedCoursId) {
      Alert.alert('Erreur', 'Veuillez sélectionner un cours.');
      return;
    }
    if (!selectedClasseId) {
      Alert.alert('Erreur', 'Veuillez sélectionner une classe.');
      return;
    }
    if (!dateCoursPrevue) {
      Alert.alert('Erreur', 'Veuillez définir une date prévue.');
      return;
    }
    if (!lieu.trim()) {
      Alert.alert('Erreur', 'Le lieu est obligatoire.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        coursId: selectedCoursId,
        professeurId: user.userId,
        dateCoursPrevue,
        lieu: lieu.trim(),
        description: description.trim() || undefined,
        capaciteMax: capaciteMax.trim() ? Number(capaciteMax) : undefined,
        classesIds: [selectedClasseId],
        participantsIds: selectedParticipantIds,
        etatCoursProgramme: editingItem?.etatCoursProgramme ?? 'PLANIFIE',
      };
      if (editingItem) {
        await coursProgrammerService.update(editingItem.id, payload);
        Alert.alert('Succès', 'Programmation modifiée avec succès.');
      } else {
        await coursProgrammerService.programmer(payload);
        Alert.alert('Succès', 'Cours programmé avec succès.');
      }
      resetForm();
      onScheduled();
      await loadList();
      setView('list');
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Échec de la programmation.');
    } finally {
      setSubmitting(false);
    }
  };

  const applyStateChange = async (item: CoursProgramme, updates: Record<string, unknown>, successMessage: string) => {
    setBusyId(item.id);
    try {
      await coursProgrammerService.update(item.id, updates);
      await loadList();
      onScheduled();
      setDetailItem(null);
      Alert.alert('Succès', successMessage);
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : "Échec de l'opération.");
    } finally {
      setBusyId(null);
    }
  };

  /** Matches web's demarrerCours: sets EN_COURS and stamps the real start time. */
  const handleStart = (item: CoursProgramme) =>
    applyStateChange(item, { etatCoursProgramme: 'EN_COURS', dateDebutEffectif: new Date().toISOString(), dateFinEffectif: null }, 'Cours démarré.');

  /** Matches web's terminerCours: sets TERMINE and stamps the real end time. */
  const handleFinish = (item: CoursProgramme) =>
    applyStateChange(item, { etatCoursProgramme: 'TERMINE', dateFinEffectif: new Date().toISOString() }, 'Cours terminé.');

  /**
   * Matches web's annulerCours exactly: this is a state change (ANNULE),
   * NOT a delete — the record and its history are preserved. Mobile used to
   * have its "Annuler" button call a hard DELETE, silently destroying the
   * programmation instead of marking it cancelled.
   */
  const handleConfirmCancel = (reason: string) => {
    if (!cancellingItem) return;
    const item = cancellingItem;
    setCancellingItem(null);
    applyStateChange(
      item,
      { etatCoursProgramme: 'ANNULE', description: reason ? `Annulé: ${reason}` : 'Cours annulé', dateDebutEffectif: null, dateFinEffectif: null },
      'Cours annulé.'
    );
  };

  /** Real, permanent delete — matches web's separate, creator-only Supprimer action. */
  const handleDelete = (item: CoursProgramme) => {
    Alert.alert('Supprimer définitivement', 'Cette programmation sera supprimée définitivement. Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          setBusyId(item.id);
          try {
            await coursProgrammerService.remove(item.id);
            setItems((prev) => prev.filter((i) => i.id !== item.id));
            setDetailItem(null);
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

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return items.filter((it) => {
      const coursNom = coursList.find((c) => c.id === it.coursId)?.titre ?? '';
      const matchSearch = !term || coursNom.toLowerCase().includes(term) || (it.lieu ?? '').toLowerCase().includes(term);
      const matchStatus = !filterStatus || it.etatCoursProgramme === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [items, searchTerm, filterStatus, coursList]);

  const coursTitle = (coursId?: string) => coursList.find((c) => c.id === coursId)?.titre ?? 'Cours';

  return (
    <BottomSheet visible={visible} onClose={onClose} title={view === 'list' ? 'Cours programmés' : editingItem ? 'Modifier — reprogrammer' : 'Programmer un cours'}>
      {view === 'list' ? (
        <View>
          <Input placeholder="Rechercher par cours ou lieu..." value={searchTerm} onChangeText={setSearchTerm} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <FilterChip label="Tous les statuts" active={!filterStatus} onPress={() => setFilterStatus('')} />
            {Object.keys(STATUS_LABELS).map((s) => (
              <FilterChip key={s} label={STATUS_LABELS[s]} active={filterStatus === s} onPress={() => setFilterStatus(s)} />
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.newButton} onPress={openCreateForm}>
            <FontAwesome5 name="plus" size={13} color={colors.white} />
            <Text style={styles.newButtonText}>Programmer un cours</Text>
          </TouchableOpacity>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {loadingList ? (
              <LoadingSpinner label="Chargement..." />
            ) : filtered.length === 0 ? (
              <EmptyState icon="calendar-alt" title="Aucun cours programmé" />
            ) : (
              filtered.map((item) => {
                const etat = item.etatCoursProgramme ?? 'PLANIFIE';
                return (
                  <TouchableOpacity key={item.id} style={styles.card} onPress={() => setDetailItem(item)} activeOpacity={0.7}>
                    <View style={styles.cardHeader}>
                      <FontAwesome5 name="calendar-alt" size={14} color={colors.primary} />
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {coursTitle(item.coursId)}
                      </Text>
                      <Badge label={STATUS_LABELS[etat] ?? etat} tone={STATUS_TONE[etat] ?? 'neutral'} />
                    </View>
                    <Text style={styles.cardMeta}>{fmtDateTime(item.dateCoursPrevue)}</Text>
                    {item.lieu ? <Text style={styles.cardMeta}>{item.lieu}</Text> : null}
                    {item.classes && item.classes.length > 0 ? <Text style={styles.cardMeta}>{item.classes.map((c) => c.nom).join(', ')}</Text> : null}
                    <View style={styles.cardActions}>
                      {etat === 'PLANIFIE' ? (
                        <QuickAction icon="play" label="Démarrer" color={colors.success} onPress={() => handleStart(item)} busy={busyId === item.id} />
                      ) : null}
                      {etat === 'EN_COURS' ? (
                        <>
                          <QuickAction icon="video" label="Session live" color={colors.primary} onPress={() => { onClose(); navigation.navigate('LiveSession', { coursId: item.coursId, isHost: true }); }} />
                          <QuickAction icon="stop" label="Terminer" color={colors.textMuted} onPress={() => handleFinish(item)} busy={busyId === item.id} />
                        </>
                      ) : null}
                      {etat === 'PLANIFIE' || etat === 'EN_COURS' ? (
                        <>
                          <QuickAction icon="edit" label="Modifier" color={colors.success} onPress={() => openEditForm(item)} />
                          <QuickAction icon="ban" label="Annuler" color={colors.warning} onPress={() => setCancellingItem(item)} />
                        </>
                      ) : null}
                      <QuickAction icon="trash" label="Supprimer" color={colors.danger} onPress={() => handleDelete(item)} busy={busyId === item.id} />
                    </View>
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

          <Text style={styles.label}>Cours à programmer *</Text>
          {coursList.length === 0 ? (
            <EmptyState icon="book" title="Aucun cours" message="Créez un cours avant de le programmer." />
          ) : (
            <View style={styles.chipRow}>
              {coursList.map((c) => (
                <TouchableOpacity key={c.id} style={[styles.chip, selectedCoursId === c.id && styles.chipActive]} onPress={() => setSelectedCoursId(c.id)}>
                  <Text style={[styles.chipText, selectedCoursId === c.id && styles.chipTextActive]} numberOfLines={1}>
                    {c.titre}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.label}>Classe *</Text>
          {loadingClasses ? (
            <LoadingSpinner label="Chargement des classes..." />
          ) : classes.length === 0 ? (
            <EmptyState icon="chalkboard" title="Aucune classe" />
          ) : (
            <View style={styles.chipRow}>
              {classes.map((cls) => (
                <TouchableOpacity key={cls.id} style={[styles.chip, selectedClasseId === cls.id && styles.chipActive]} onPress={() => setSelectedClasseId(cls.id)}>
                  <Text style={[styles.chipText, selectedClasseId === cls.id && styles.chipTextActive]}>{cls.nom}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {selectedClasseId ? (
            <>
              <View style={styles.participantsHeader}>
                <Text style={styles.label}>Participants (optionnel)</Text>
                {classParticipants.length > 0 ? (
                  <TouchableOpacity onPress={toggleSelectAllParticipants}>
                    <Text style={styles.selectAllText}>
                      {selectedParticipantIds.length === classParticipants.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {loadingParticipants ? (
                <LoadingSpinner label="Chargement des participants..." />
              ) : classParticipants.length === 0 ? (
                <Text style={styles.emptyHint}>Aucun participant disponible pour cette classe.</Text>
              ) : (
                <View style={styles.chipRow}>
                  {classParticipants.map((p) => {
                    const selected = selectedParticipantIds.includes(p.id);
                    return (
                      <TouchableOpacity key={p.id} style={[styles.chip, selected && styles.chipActive]} onPress={() => toggleParticipant(p.id)}>
                        {selected && <FontAwesome5 name="check" size={10} color={colors.white} style={{ marginRight: 4 }} />}
                        <Text style={[styles.chipText, selected && styles.chipTextActive]}>{`${p.prenom ?? ''} ${p.nom ?? ''}`.trim() || p.email || p.id}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          ) : null}

          <DateTimeField label="Date et heure prévue" value={dateCoursPrevue} onChange={setDateCoursPrevue} required />
          <Input label="Lieu *" value={lieu} onChangeText={setLieu} placeholder="Salle, lien visio, etc." />
          <Input label="Capacité maximale (optionnel)" value={capaciteMax} onChangeText={setCapaciteMax} placeholder="Ex: 30" keyboardType="numeric" />
          <Input
            label="Description (optionnel)"
            value={description}
            onChangeText={setDescription}
            placeholder="Notes sur ce cours programmé"
            multiline
            numberOfLines={3}
            style={{ height: 80, textAlignVertical: 'top' }}
          />

          <Button label={editingItem ? 'Enregistrer les modifications' : 'Programmer'} onPress={handleSubmit} loading={submitting} fullWidth style={styles.submitButton} />
        </ScrollView>
      )}

      <BottomSheet visible={!!detailItem} onClose={() => setDetailItem(null)} title="Détail de la programmation">
        {detailItem ? (
          <ScrollView style={{ maxHeight: 460 }}>
            <DetailRow label="Cours" value={coursTitle(detailItem.coursId)} />
            <DetailRow label="Statut" value={STATUS_LABELS[detailItem.etatCoursProgramme ?? ''] ?? detailItem.etatCoursProgramme ?? '—'} />
            <DetailRow label="Date prévue" value={fmtDateTime(detailItem.dateCoursPrevue)} />
            <DetailRow label="Début effectif" value={fmtDateTime(detailItem.dateDebutEffectif)} />
            <DetailRow label="Fin effective" value={fmtDateTime(detailItem.dateFinEffectif)} />
            <DetailRow label="Lieu" value={detailItem.lieu || '—'} />
            <DetailRow label="Classes" value={detailItem.classes?.map((c) => c.nom).join(', ') || '—'} />
            <DetailRow label="Participants" value={String(detailItem.participantsIds?.length ?? 0)} />
            {detailItem.description ? <DetailRow label="Description" value={detailItem.description} /> : null}

            <View style={styles.detailActions}>
              {detailItem.etatCoursProgramme === 'PLANIFIE' ? (
                <Button label="Démarrer" onPress={() => handleStart(detailItem)} loading={busyId === detailItem.id} style={{ backgroundColor: colors.success, flexGrow: 1, minWidth: 130 }} />
              ) : null}
              {detailItem.etatCoursProgramme === 'EN_COURS' ? (
                <Button label="Terminer" onPress={() => handleFinish(detailItem)} loading={busyId === detailItem.id} variant="secondary" style={{ flexGrow: 1, minWidth: 130 }} />
              ) : null}
              {detailItem.etatCoursProgramme === 'PLANIFIE' || detailItem.etatCoursProgramme === 'EN_COURS' ? (
                <>
                  <Button label="Modifier" onPress={() => openEditForm(detailItem)} variant="secondary" style={{ flexGrow: 1, minWidth: 130 }} />
                  <Button label="Annuler le cours" onPress={() => setCancellingItem(detailItem)} variant="secondary" style={{ flexGrow: 1, minWidth: 130 }} />
                </>
              ) : null}
              <Button label="Supprimer définitivement" onPress={() => handleDelete(detailItem)} loading={busyId === detailItem.id} variant="danger" fullWidth style={{ marginTop: spacing.sm }} />
            </View>
          </ScrollView>
        ) : null}
      </BottomSheet>

      <PromptSheet
        visible={!!cancellingItem}
        title="Annuler le cours"
        message="Motif de l'annulation (optionnel)"
        placeholder="Motif"
        submitLabel="Confirmer l'annulation"
        onCancel={() => setCancellingItem(null)}
        onSubmit={handleConfirmCancel}
      />
    </BottomSheet>
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

const QuickAction = ({ icon, label, color, onPress, busy }: { icon: React.ComponentProps<typeof FontAwesome5>['name']; label: string; color: string; onPress: () => void; busy?: boolean }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} disabled={busy}>
      <FontAwesome5 name={busy ? 'spinner' : icon} size={12} color={color} />
      <Text style={[styles.quickActionText, { color }]}>{label}</Text>
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
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20, backgroundColor: colors.grayLight, maxWidth: 220 },
  chipActive: { backgroundColor: colors.primary },
  chipText: { ...typography.caption, color: colors.text },
  chipTextActive: { color: colors.white, fontWeight: '600' },
  submitButton: { marginTop: spacing.md, marginBottom: spacing.lg },
  participantsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectAllText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  emptyHint: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic', marginBottom: spacing.md },
  filterScroll: { marginTop: spacing.sm, marginBottom: spacing.sm, flexGrow: 0 },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.grayLight, marginRight: spacing.xs },
  filterChipActive: { backgroundColor: colors.primary },
  filterChipText: { ...typography.caption, color: colors.text, fontSize: 11 },
  filterChipTextActive: { color: colors.white, fontWeight: '600' },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  newButtonText: { ...typography.bodyBold, color: colors.white },
  list: { maxHeight: 360 },
  error: { color: colors.danger, marginBottom: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  cardTitle: { ...typography.bodyBold, color: colors.text, flex: 1 },
  cardMeta: { ...typography.caption, color: colors.textMuted },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  quickAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quickActionText: { ...typography.caption, fontWeight: '600' },
  detailRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: { ...typography.caption, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase', fontSize: 10, marginBottom: 2 },
  detailValue: { ...typography.body, color: colors.text },
  detailActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.lg },
});

export default CoursProgrammerModal;
