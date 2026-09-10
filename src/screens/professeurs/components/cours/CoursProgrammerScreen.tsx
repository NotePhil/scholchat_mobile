import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  Badge,
  Button,
  DropdownField,
  EmptyState,
  Input,
  LoadingSpinner,
} from '../../../../components/ui';
import DateTimeField from '../../../../components/common/DateTimeField';
import PromptSheet from '../../../../components/common/PromptSheet';
import { colors, radius, spacing, typography, useThemeColors } from '../../../../styles/theme';
import { classService } from '../../../../services/classService';
import { coursProgrammerService } from '../../../../services/api';
import { useUser } from '../../../../context/UserContext';
import { ClassEntity, ClassUser, CoursProgramme } from '../../../../types';
import { Cours } from './DashboardCoursBody';

export interface CoursProgrammerScreenProps {
  onClose: () => void;
  onScheduled?: () => void;
  coursList: Cours[];
  initialView?: 'list' | 'form';
}

type ViewMode = 'list' | 'form' | 'detail';

const STATUS_LABELS: Record<string, string> = {
  PLANIFIE: 'Planifié',
  EN_COURS: 'En cours',
  TERMINE: 'Terminé',
  ANNULE: 'Annulé',
};

const STATUS_TONE: Record<string, 'info' | 'success' | 'neutral' | 'danger'> = {
  PLANIFIE: 'info',
  EN_COURS: 'success',
  TERMINE: 'neutral',
  ANNULE: 'danger',
};

const fmtDateTime = (d?: string | null) =>
  d
    ? new Date(d).toLocaleString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

const isUrlOrZoom = (val?: string | null): boolean => {
  if (!val) return false;
  const lower = val.toLowerCase();
  return lower.startsWith('http://') || lower.startsWith('https://') || lower.includes('zoom.us');
};

/**
 * Full page "Cours programmés" screen (page seule, non modale).
 * - Full page view with header, back button, and view switcher.
 * - Dropdown selection for course and class.
 * - Zoom & Live meeting URL integration with direct launch.
 * - Lifecycle actions: Démarrer, Terminer, Annuler avec motif, Modifier, Supprimer.
 */
export const CoursProgrammerScreen = ({
  onClose,
  onScheduled,
  coursList,
  initialView = 'list',
}: CoursProgrammerScreenProps) => {
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

  // ── form state ──
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
  const [zoomUrl, setZoomUrl] = useState('');
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
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (view !== 'form' || !user?.userId) return;
    setLoadingClasses(true);
    classService
      .getClassesWithPublicationRights(user.userId)
      .then(setClasses)
      .catch(() => setClasses([]))
      .finally(() => setLoadingClasses(false));
  }, [view, user?.userId]);

  useEffect(() => {
    if (!selectedClasseId) {
      setClassParticipants([]);
      setSelectedParticipantIds([]);
      return;
    }
    setLoadingParticipants(true);
    classService
      .getClassUsers(selectedClasseId)
      .then((users) => {
        const eligible = users.filter((u) => u.typeUtilisateur === 'ELEVE' || u.typeUtilisateur === 'PARENT');
        setClassParticipants(eligible);
        setSelectedParticipantIds(eligible.map((p) => p.id));
      })
      .catch(() => setClassParticipants([]))
      .finally(() => setLoadingParticipants(false));
  }, [selectedClasseId]);

  const resetForm = () => {
    setEditingItem(null);
    setSelectedCoursId(null);
    setSelectedClasseId(null);
    setSelectedParticipantIds([]);
    setDateCoursPrevue('');
    setLieu('');
    setZoomUrl('');
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
    setSelectedClasseId(item.classes?.[0]?.id ?? null);
    setDateCoursPrevue(item.dateCoursPrevue ?? '');
    setLieu(item.lieu ?? '');
    setZoomUrl(isUrlOrZoom(item.lieu) ? item.lieu ?? '' : '');
    setDescription(item.description ?? '');
    setCapaciteMax(item.capaciteMax ? String(item.capaciteMax) : '');
    setSelectedParticipantIds(item.participantsIds ?? []);
    setView('form');
  };

  const toggleParticipant = (id: string) => {
    setSelectedParticipantIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllParticipants = () => {
    setSelectedParticipantIds((prev) =>
      prev.length === classParticipants.length ? [] : classParticipants.map((p) => p.id)
    );
  };

  const handleSubmit = async () => {
    if (!user?.userId) {
      Alert.alert('Erreur', 'Utilisateur non identifié.');
      return;
    }
    if (!selectedCoursId) {
      Alert.alert('Erreur', 'Veuillez sélectionner un cours dans la liste déroulante.');
      return;
    }
    if (!selectedClasseId) {
      Alert.alert('Erreur', 'Veuillez sélectionner une classe dans la liste déroulante.');
      return;
    }
    if (!dateCoursPrevue) {
      Alert.alert('Erreur', 'Veuillez définir une date et heure prévue.');
      return;
    }
    const finalLieu = zoomUrl.trim() || lieu.trim();
    if (!finalLieu) {
      Alert.alert('Erreur', 'Le lieu ou lien de réunion (Zoom/Meet) est obligatoire.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        coursId: selectedCoursId,
        professeurId: user.userId,
        dateCoursPrevue,
        lieu: finalLieu,
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
      if (onScheduled) onScheduled();
      await loadList();
      setView('list');
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Échec de la programmation.');
    } finally {
      setSubmitting(false);
    }
  };

  const applyStateChange = async (
    item: CoursProgramme,
    updates: Record<string, unknown>,
    successMessage: string
  ) => {
    setBusyId(item.id);
    try {
      await coursProgrammerService.update(item.id, updates);
      await loadList();
      if (onScheduled) onScheduled();
      setDetailItem(null);
      Alert.alert('Succès', successMessage);
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : "Échec de l'opération.");
    } finally {
      setBusyId(null);
    }
  };

  const handleStart = (item: CoursProgramme) =>
    applyStateChange(
      item,
      {
        etatCoursProgramme: 'EN_COURS',
        dateDebutEffectif: new Date().toISOString(),
        dateFinEffectif: null,
      },
      'Cours démarré avec succès.'
    );

  const handleFinish = (item: CoursProgramme) =>
    applyStateChange(
      item,
      { etatCoursProgramme: 'TERMINE', dateFinEffectif: new Date().toISOString() },
      'Cours terminé.'
    );

  const handleConfirmCancel = (reason: string) => {
    if (!cancellingItem) return;
    const item = cancellingItem;
    setCancellingItem(null);
    applyStateChange(
      item,
      {
        etatCoursProgramme: 'ANNULE',
        description: reason ? `Annulé: ${reason}` : 'Cours annulé',
        dateDebutEffectif: null,
        dateFinEffectif: null,
      },
      'Cours annulé.'
    );
  };

  const handleDelete = (item: CoursProgramme) => {
    Alert.alert(
      'Supprimer définitivement',
      'Cette programmation sera supprimée définitivement. Cette action est irréversible.',
      [
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
              if (onScheduled) onScheduled();
            } catch (err) {
              Alert.alert('Erreur', err instanceof Error ? err.message : 'Échec de la suppression.');
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  const handleJoinZoom = (url: string) => {
    const formatted = url.startsWith('http') ? url : `https://${url}`;
    Linking.canOpenURL(formatted)
      .then((supported) => {
        if (supported) Linking.openURL(formatted);
        else Alert.alert('Lien Zoom / Visioconférence', formatted);
      })
      .catch(() => Alert.alert('Lien', formatted));
  };

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return items.filter((it) => {
      const coursNom = coursList.find((c) => c.id === it.coursId)?.titre ?? '';
      const matchSearch =
        !term ||
        coursNom.toLowerCase().includes(term) ||
        (it.lieu ?? '').toLowerCase().includes(term);
      const matchStatus = !filterStatus || it.etatCoursProgramme === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [items, searchTerm, filterStatus, coursList]);

  const coursTitle = (coursId?: string) =>
    coursList.find((c) => c.id === coursId)?.titre ?? 'Cours';

  return (
    <View style={styles.container}>
      {/* Top Page Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (view === 'form') setView('list');
            else onClose();
          }}
          style={styles.backButton}
        >
          <FontAwesome5 name="arrow-left" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerEyebrow}>Gestion des cours</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {view === 'form'
              ? editingItem
                ? 'Modifier la programmation'
                : 'Programmer un cours'
              : 'Cours programmés'}
          </Text>
        </View>
        {view === 'list' && (
          <TouchableOpacity style={styles.headerActionBtn} onPress={openCreateForm}>
            <FontAwesome5 name="plus" size={13} color={colors.white} />
            <Text style={styles.headerActionBtnText}>Nouveau</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Main Body */}
      {view === 'list' ? (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 130 }}
          showsVerticalScrollIndicator={false}
        >
          <Input
            placeholder="Rechercher par cours ou lieu/lien..."
            value={searchTerm}
            onChangeText={setSearchTerm}
          />

          {/* Status Dropdown Filter */}
          <View style={{ marginBottom: spacing.md }}>
            <DropdownField
              label="Filtrer par statut"
              placeholder="Tous les statuts"
              value={filterStatus}
              options={[
                { label: 'Tous les statuts', value: '' },
                ...Object.keys(STATUS_LABELS).map((s) => ({
                  label: STATUS_LABELS[s],
                  value: s,
                })),
              ]}
              onChange={setFilterStatus}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {loadingList ? (
            <LoadingSpinner label="Chargement des cours programmés..." />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="calendar-alt"
              title="Aucun cours programmé"
              message="Appuyez sur 'Nouveau' pour programmer un cours pour vos classes."
              actionLabel="Programmer un cours"
              onAction={openCreateForm}
            />
          ) : (
            filtered.map((item) => {
              const etat = item.etatCoursProgramme ?? 'PLANIFIE';
              const hasZoom = isUrlOrZoom(item.lieu);
              return (
                <View key={item.id} style={styles.card}>
                  <TouchableOpacity
                    onPress={() => setDetailItem(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.cardHeader}>
                      <FontAwesome5 name="calendar-alt" size={14} color={colors.primary} />
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {coursTitle(item.coursId)}
                      </Text>
                      <Badge
                        label={STATUS_LABELS[etat] ?? etat}
                        tone={STATUS_TONE[etat] ?? 'neutral'}
                      />
                    </View>

                    <Text style={styles.cardMeta}>
                      <FontAwesome5 name="clock" size={11} color={colors.textMuted} />{' '}
                      {fmtDateTime(item.dateCoursPrevue)}
                    </Text>

                    {item.classes && item.classes.length > 0 ? (
                      <Text style={styles.cardMeta}>
                        <FontAwesome5 name="chalkboard" size={11} color={colors.textMuted} />{' '}
                        {item.classes.map((c) => c.nom).join(', ')}
                      </Text>
                    ) : null}

                    {item.lieu ? (
                      <Text style={styles.cardMeta} numberOfLines={1}>
                        <FontAwesome5
                          name={hasZoom ? 'video' : 'map-marker-alt'}
                          size={11}
                          color={hasZoom ? colors.primary : colors.textMuted}
                        />{' '}
                        {item.lieu}
                      </Text>
                    ) : null}
                  </TouchableOpacity>

                  {/* Direct Zoom / Live meeting button */}
                  {hasZoom && (
                    <TouchableOpacity
                      style={styles.zoomButton}
                      onPress={() => handleJoinZoom(item.lieu!)}
                    >
                      <FontAwesome5 name="video" size={13} color={colors.white} />
                      <Text style={styles.zoomButtonText}>Rejoindre la visioconférence (Zoom)</Text>
                    </TouchableOpacity>
                  )}

                  {/* Actions Bar */}
                  <View style={styles.cardActions}>
                    {etat === 'PLANIFIE' ? (
                      <QuickAction
                        icon="play"
                        label="Démarrer"
                        color={colors.success}
                        onPress={() => handleStart(item)}
                        busy={busyId === item.id}
                      />
                    ) : null}

                    {etat === 'EN_COURS' ? (
                      <>
                        <QuickAction
                          icon="video"
                          label="Session live"
                          color={colors.primary}
                          onPress={() => {
                            navigation.navigate('LiveSession', {
                              coursId: item.coursId,
                              isHost: true,
                            });
                          }}
                        />
                        <QuickAction
                          icon="stop"
                          label="Terminer"
                          color={colors.textMuted}
                          onPress={() => handleFinish(item)}
                          busy={busyId === item.id}
                        />
                      </>
                    ) : null}

                    {etat === 'PLANIFIE' || etat === 'EN_COURS' ? (
                      <>
                        <QuickAction
                          icon="edit"
                          label="Modifier"
                          color={colors.primary}
                          onPress={() => openEditForm(item)}
                        />
                        <QuickAction
                          icon="ban"
                          label="Annuler"
                          color={colors.warning}
                          onPress={() => setCancellingItem(item)}
                        />
                      </>
                    ) : null}

                    <QuickAction
                      icon="trash"
                      label="Supprimer"
                      color={colors.danger}
                      onPress={() => handleDelete(item)}
                      busy={busyId === item.id}
                    />
                  </View>
                </View>
              );
            })
          )}
          <View style={{ height: 60 }} />
        </ScrollView>
      ) : (
        /* Full Page Form View */
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 130 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Course Dropdown */}
          <DropdownField
            label="Cours à programmer *"
            placeholder="Sélectionner un cours..."
            value={selectedCoursId ?? ''}
            options={coursList.map((c) => ({
              label: `${c.titre} (${c.etat})`,
              value: c.id,
            }))}
            onChange={(val) => setSelectedCoursId(val || null)}
          />

          {/* Class Dropdown */}
          {loadingClasses ? (
            <LoadingSpinner label="Chargement des classes..." />
          ) : (
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
          )}

          {/* Participants Checklist */}
          {selectedClasseId ? (
            <View style={styles.sectionBox}>
              <View style={styles.participantsHeader}>
                <Text style={styles.sectionTitle}>Participants (élèves / parents)</Text>
                {classParticipants.length > 0 ? (
                  <TouchableOpacity onPress={toggleSelectAllParticipants}>
                    <Text style={styles.selectAllText}>
                      {selectedParticipantIds.length === classParticipants.length
                        ? 'Tout désélectionner'
                        : 'Tout sélectionner'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {loadingParticipants ? (
                <LoadingSpinner label="Chargement des participants..." />
              ) : classParticipants.length === 0 ? (
                <Text style={styles.emptyHint}>Aucun participant trouvé pour cette classe.</Text>
              ) : (
                <View style={styles.participantsList}>
                  {classParticipants.map((p) => {
                    const selected = selectedParticipantIds.includes(p.id);
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.participantChip, selected && styles.participantChipActive]}
                        onPress={() => toggleParticipant(p.id)}
                      >
                        <FontAwesome5
                          name={selected ? 'check-square' : 'square'}
                          size={14}
                          color={selected ? colors.primary : colors.textMuted}
                        />
                        <Text
                          style={[styles.participantText, selected && styles.participantTextActive]}
                          numberOfLines={1}
                        >
                          {`${p.prenom ?? ''} ${p.nom ?? ''}`.trim() || p.email || p.id}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          ) : null}

          {/* Scheduled Date */}
          <DateTimeField
            label="Date et heure prévue *"
            value={dateCoursPrevue}
            onChange={setDateCoursPrevue}
            required
          />

          {/* Zoom / Meeting link */}
          <Input
            label="Lien Visioconférence (Zoom, Google Meet, Teams)"
            value={zoomUrl}
            onChangeText={(text) => {
              setZoomUrl(text);
              if (!lieu || isUrlOrZoom(lieu)) setLieu(text);
            }}
            placeholder="https://zoom.us/j/... ou https://meet.google.com/..."
            autoCapitalize="none"
          />

          {/* Location / Lieu */}
          <Input
            label="Lieu ou Salle *"
            value={lieu}
            onChangeText={setLieu}
            placeholder="Ex: Salle B12, Zoom, En ligne..."
          />

          {/* Capacity */}
          <Input
            label="Capacité maximale (optionnel)"
            value={capaciteMax}
            onChangeText={setCapaciteMax}
            placeholder="Ex: 30"
            keyboardType="numeric"
          />

          {/* Description */}
          <Input
            label="Description ou consignes (optionnel)"
            value={description}
            onChangeText={setDescription}
            placeholder="Objectifs, matériel à apporter..."
            multiline
            numberOfLines={3}
            style={{ height: 80, textAlignVertical: 'top' }}
          />

          <Button
            label={editingItem ? 'Enregistrer les modifications' : 'Programmer le cours'}
            onPress={handleSubmit}
            loading={submitting}
            fullWidth
            style={styles.submitButton}
          />
          <View style={{ height: 120 }} />
        </ScrollView>
      )}

      {/* Detail Dialog / Sheet */}
      {detailItem && (
        <View style={styles.detailOverlay}>
          <View style={styles.detailModalCard}>
            <View style={styles.detailModalHeader}>
              <Text style={styles.detailModalTitle}>Détails de la séance</Text>
              <TouchableOpacity onPress={() => setDetailItem(null)}>
                <FontAwesome5 name="times" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 420 }}>
              <DetailRow label="Cours" value={coursTitle(detailItem.coursId)} />
              <DetailRow
                label="Statut"
                value={
                  STATUS_LABELS[detailItem.etatCoursProgramme ?? ''] ??
                  detailItem.etatCoursProgramme ??
                  '—'
                }
              />
              <DetailRow label="Date prévue" value={fmtDateTime(detailItem.dateCoursPrevue)} />
              <DetailRow label="Début effectif" value={fmtDateTime(detailItem.dateDebutEffectif)} />
              <DetailRow label="Fin effective" value={fmtDateTime(detailItem.dateFinEffectif)} />
              <DetailRow label="Lieu / Lien" value={detailItem.lieu || '—'} />
              {isUrlOrZoom(detailItem.lieu) && (
                <TouchableOpacity
                  style={styles.zoomButton}
                  onPress={() => handleJoinZoom(detailItem.lieu!)}
                >
                  <FontAwesome5 name="video" size={13} color={colors.white} />
                  <Text style={styles.zoomButtonText}>Rejoindre la réunion Zoom</Text>
                </TouchableOpacity>
              )}
              <DetailRow
                label="Classes"
                value={detailItem.classes?.map((c) => c.nom).join(', ') || '—'}
              />
              <DetailRow
                label="Participants"
                value={String(detailItem.participantsIds?.length ?? 0)}
              />
              {detailItem.description ? (
                <DetailRow label="Description" value={detailItem.description} />
              ) : null}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Cancellation Prompt */}
      <PromptSheet
        visible={!!cancellingItem}
        title="Annuler le cours"
        message="Motif de l'annulation (optionnel)"
        placeholder="Motif"
        submitLabel="Confirmer l'annulation"
        onCancel={() => setCancellingItem(null)}
        onSubmit={handleConfirmCancel}
      />
    </View>
  );
};

const QuickAction = ({
  icon,
  label,
  color,
  onPress,
  busy,
}: {
  icon: React.ComponentProps<typeof FontAwesome5>['name'];
  label: string;
  color: string;
  onPress: () => void;
  busy?: boolean;
}) => {
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
  error: { color: colors.danger, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  cardTitle: { ...typography.bodyBold, color: colors.text, flex: 1 },
  cardMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  zoomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#2563EB',
    paddingVertical: 9,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
  zoomButtonText: { ...typography.caption, color: colors.white, fontWeight: '700' },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  quickAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quickActionText: { ...typography.caption, fontWeight: '600' },
  sectionBox: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  sectionTitle: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.xs },
  participantsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  selectAllText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  participantsList: { gap: spacing.xs },
  participantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  participantChipActive: { backgroundColor: colors.primaryLight },
  participantText: { ...typography.caption, color: colors.text },
  participantTextActive: { color: colors.primary, fontWeight: '600' },
  emptyHint: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  submitButton: { marginTop: spacing.md, marginBottom: spacing.lg },
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

export default CoursProgrammerScreen;
