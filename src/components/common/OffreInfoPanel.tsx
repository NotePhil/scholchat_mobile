import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { BottomSheet, Badge, Button } from '../ui';
import { colors, radius, spacing, typography, useThemeColors } from '../../styles/theme';
import { contratService, PaymentInfo } from '../../services/api/contratService';
import { offerService } from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import { Contrat, Offre } from '../../types';
import PaymentModal from './PaymentModal';

interface OffreInfoPanelProps {
  type: 'CLASSE' | 'ETABLISSEMENT';
  entityId: string;
}

type ActionMode = 'prolonger' | 'changer' | 'admin' | null;

/**
 * "Offre / Forfait actuel" panel — mirrors scholchat_front's shared
 * OffreInfoPanel.jsx exactly (same fields, same Prolonger/Changer d'offre/
 * admin-assign actions wrapping the same PaymentModal flow). Used on both
 * the class "Aperçu" tab and the establishment "Forfait" tab, matching web
 * using the exact same component in both places.
 */
const OffreInfoPanel = ({ type, entityId }: OffreInfoPanelProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const role = useAuthStore((s) => s.role);
  const isAdmin = role === 'admin';

  const [contrat, setContrat] = useState<Contrat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [offresDisponibles, setOffresDisponibles] = useState<Offre[]>([]);
  const [nouvelleOffreId, setNouvelleOffreId] = useState('');
  const [periodicite, setPeriodicite] = useState<'MENSUEL' | 'ANNUEL'>('MENSUEL');
  const [actionError, setActionError] = useState('');
  const [adminSaving, setAdminSaving] = useState(false);
  const alertedRef = useRef(false);

  const chargerContrat = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    setError('');
    try {
      const data = type === 'ETABLISSEMENT' ? await contratService.getForEstablishment(entityId) : await contratService.getForClass(entityId);
      setContrat(data);
    } catch (err) {
      // 404 (no contract yet) is a normal state, not an error banner.
      const message = err instanceof Error ? err.message : '';
      if (message.toLowerCase().includes('non trouv') || message.toLowerCase().includes('404')) {
        setContrat(null);
      } else {
        setError("Impossible de charger les informations de l'offre.");
      }
    } finally {
      setLoading(false);
    }
  }, [type, entityId]);

  useEffect(() => {
    alertedRef.current = false;
    chargerContrat();
  }, [chargerContrat]);

  useEffect(() => {
    if (contrat?.statut === 'EXPIRE' && !alertedRef.current) {
      alertedRef.current = true;
      Alert.alert(
        'Offre expirée',
        `Le forfait de ${type === 'ETABLISSEMENT' ? 'cet établissement' : 'cette classe'} a expiré${
          contrat.offreNom ? ` (${contrat.offreNom})` : ''
        }. Renouvelez-le pour réactiver l'accès.`
      );
    }
  }, [contrat, type]);

  const ouvrirAction = async (action: Exclude<ActionMode, null>) => {
    setActionMode(action);
    setActionError('');
    setNouvelleOffreId('');
    setPeriodicite((contrat?.periodicite as 'MENSUEL' | 'ANNUEL') || 'MENSUEL');
    if (action === 'changer' || action === 'admin') {
      try {
        const data = await offerService.list(type, false);
        setOffresDisponibles(Array.isArray(data) ? data : []);
      } catch {
        // ignore — dropdown just stays empty
      }
    }
  };

  const closeAction = () => {
    setActionMode(null);
    setActionError('');
  };

  const offreCible = offresDisponibles.find((o) => o.id === nouvelleOffreId) || null;
  const montant =
    (actionMode === 'changer' || actionMode === 'admin') && offreCible
      ? Number((periodicite === 'ANNUEL' ? offreCible.prixAnnuel : offreCible.prixMensuel) ?? 0)
      : contrat
      ? Number((periodicite === 'ANNUEL' ? contrat.prixAnnuel : contrat.prixMensuel) ?? 0)
      : 0;

  const offreLabelPaiement = actionMode === 'changer' || actionMode === 'admin' ? offreCible?.nom || 'Nouvelle offre' : contrat?.offreNom || 'Offre';

  const handleAssignerParAdmin = async () => {
    if (!nouvelleOffreId) {
      setActionError('Veuillez sélectionner une offre.');
      return;
    }
    setActionError('');
    setAdminSaving(true);
    try {
      if (type === 'ETABLISSEMENT') await contratService.assignEstablishmentOfferAsAdmin(entityId, nouvelleOffreId);
      else await contratService.assignClassOfferAsAdmin(entityId, nouvelleOffreId);
      Alert.alert('Succès', 'Offre attribuée avec succès !');
      closeAction();
      await chargerContrat();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setAdminSaving(false);
    }
  };

  const handlePaymentSuccess = async (paymentInfo: PaymentInfo) => {
    setActionError('');
    try {
      if (type === 'ETABLISSEMENT') {
        if (actionMode === 'changer') await contratService.changeEstablishmentOffer(entityId, nouvelleOffreId, { periodicite, paymentInfo });
        else await contratService.extendEstablishmentContract(entityId, { periodicite, paymentInfo });
      } else if (actionMode === 'changer') {
        await contratService.changeClassOffer(entityId, nouvelleOffreId, { periodicite, paymentInfo });
      } else {
        await contratService.extendClassContract(entityId, { periodicite, paymentInfo });
      }
      setShowPayment(false);
      closeAction();
      await chargerContrat();
    } catch (err) {
      setShowPayment(false);
      setActionError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    }
  };

  if (loading) {
    return (
      <View style={styles.card}>
        <Text style={styles.loadingText}>Chargement de l'offre...</Text>
      </View>
    );
  }

  const estExpire = contrat?.statut === 'EXPIRE';
  const statutTone = contrat?.statut === 'ACTIF' ? 'success' : estExpire ? 'danger' : 'neutral';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Offre / Forfait actuel</Text>
        {contrat ? <Badge label={contrat.statut ?? ''} tone={statutTone} /> : null}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {!contrat && !error ? <Text style={styles.mutedText}>Aucune offre associée pour le moment.</Text> : null}

      {contrat && (
        <View style={styles.rows}>
          <Row label="Offre" value={contrat.offreNom} />
          <Row label="Périodicité" value={contrat.periodicite === 'MENSUEL' ? 'Mensuelle' : 'Annuelle'} />
          <Row label="Montant" value={`${Number(contrat.prixPaye ?? 0).toLocaleString('fr-FR')} FCFA`} />
          {contrat.dateFin ? <Row label="Valide jusqu'au" value={new Date(contrat.dateFin).toLocaleDateString('fr-FR')} /> : null}
          {contrat.classesMax != null ? (
            <Row label="Classes" value={`${contrat.classesUtilisees ?? 0} / ${contrat.classesMax}`} danger={(contrat.classesUtilisees ?? 0) >= contrat.classesMax} />
          ) : null}
          {contrat.elevesMax != null ? <Row label="Élèves max" value={String(contrat.elevesMax)} /> : null}
          {contrat.stockageMax != null ? <Row label="Stockage" value={`${contrat.stockageMax} Go`} /> : null}
          {contrat.messagerie != null ? <Row label="Messagerie" value={contrat.messagerie ? 'Incluse' : 'Non incluse'} /> : null}
        </View>
      )}

      {contrat?.suppressionImminente && contrat.dateSuppressionPrevue ? (
        <View style={styles.dangerBanner}>
          <FontAwesome5 name="shield-alt" size={14} color={colors.danger} />
          <Text style={styles.dangerBannerText}>
            Suppression définitive prévue le {new Date(contrat.dateSuppressionPrevue).toLocaleString('fr-FR')} si l'offre n'est pas renouvelée.
          </Text>
        </View>
      ) : null}

      {estExpire ? (
        <View style={styles.warnBanner}>
          <FontAwesome5 name="exclamation-circle" size={13} color={colors.danger} />
          <Text style={styles.warnBannerText}>Offre expirée — renouvelez pour réactiver.</Text>
        </View>
      ) : null}

      {contrat && (
        <View style={styles.actionsRow}>
          <Button label="Prolonger" onPress={() => ouvrirAction('prolonger')} style={{ flex: 1 }} />
          <Button label="Changer d'offre" variant="secondary" onPress={() => ouvrirAction('changer')} style={{ flex: 1 }} />
        </View>
      )}

      {isAdmin ? (
        <TouchableOpacity style={styles.adminButton} onPress={() => ouvrirAction('admin')}>
          <FontAwesome5 name="tools" size={13} color={colors.primary} />
          <Text style={styles.adminButtonText}>Attribuer une offre (admin, sans paiement)</Text>
        </TouchableOpacity>
      ) : null}

      <BottomSheet
        visible={!!actionMode && !showPayment}
        onClose={closeAction}
        title={actionMode === 'changer' ? "Changer d'offre" : actionMode === 'admin' ? 'Attribuer une offre (admin)' : "Prolonger l'offre"}
      >
        {actionMode === 'admin' ? (
          <View style={styles.infoBanner}>
            <FontAwesome5 name="tools" size={12} color={colors.primary} />
            <Text style={styles.infoBannerText}>Attribution directe, sans passer par le paiement — réservé aux admins.</Text>
          </View>
        ) : null}

        {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}

        {(actionMode === 'changer' || actionMode === 'admin') && (
          <View style={{ marginBottom: spacing.md }}>
            <Text style={styles.fieldLabel}>{actionMode === 'admin' ? 'Offre à attribuer' : 'Nouvelle offre'}</Text>
            {offresDisponibles.length === 0 ? (
              <Text style={styles.mutedText}>Aucune offre disponible.</Text>
            ) : (
              offresDisponibles.map((o) => {
                const prix =
                  o.prixMensuel != null
                    ? `${Number(o.prixMensuel).toLocaleString('fr-FR')} FCFA/mois`
                    : o.prixAnnuel != null
                    ? `${Number(o.prixAnnuel).toLocaleString('fr-FR')} FCFA/an`
                    : '';
                const active = nouvelleOffreId === o.id;
                return (
                  <TouchableOpacity
                    key={o.id}
                    style={[styles.offreOption, active && styles.offreOptionActive]}
                    onPress={() => setNouvelleOffreId(o.id)}
                  >
                    <Text style={[styles.offreOptionText, active && styles.offreOptionTextActive]}>
                      {o.nom}
                      {prix ? ` — ${prix}` : ''}
                    </Text>
                    {active ? <FontAwesome5 name="check" size={12} color={colors.white} /> : null}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        <View style={{ marginBottom: spacing.lg }}>
          <Text style={styles.fieldLabel}>Périodicité</Text>
          <View style={styles.periodRow}>
            {(['MENSUEL', 'ANNUEL'] as const).map((val) => (
              <TouchableOpacity
                key={val}
                style={[styles.periodChip, periodicite === val && styles.periodChipActive]}
                onPress={() => setPeriodicite(val)}
              >
                <Text style={[styles.periodChipText, periodicite === val && styles.periodChipTextActive]}>
                  {val === 'MENSUEL' ? 'Mensuel' : 'Annuel'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {montant > 0 ? (
            <Text style={styles.montantText}>
              Montant : <Text style={{ fontWeight: '700' }}>{montant.toLocaleString('fr-FR')} FCFA</Text>
            </Text>
          ) : null}
        </View>

        {actionMode === 'admin' ? (
          <Button
            label={adminSaving ? 'Attribution...' : "Attribuer l'offre (sans paiement)"}
            onPress={handleAssignerParAdmin}
            loading={adminSaving}
            disabled={!nouvelleOffreId}
            fullWidth
            style={{ marginBottom: spacing.lg }}
          />
        ) : (
          <Button
            label="Continuer vers le paiement"
            onPress={() => {
              if (actionMode === 'changer' && !nouvelleOffreId) {
                setActionError('Veuillez sélectionner une offre.');
                return;
              }
              setActionError('');
              setShowPayment(true);
            }}
            disabled={montant <= 0}
            fullWidth
            style={{ marginBottom: spacing.lg }}
          />
        )}
      </BottomSheet>

      <PaymentModal
        visible={!!actionMode && showPayment}
        onClose={() => setShowPayment(false)}
        onSuccess={handlePaymentSuccess}
        montant={montant}
        label={offreLabelPaiement}
        subLabel={periodicite === 'ANNUEL' ? 'Périodicité annuelle' : 'Périodicité mensuelle'}
      />
    </View>
  );
};

const Row = ({ label, value, danger }: { label: string; value?: string; danger?: boolean }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, danger && { color: colors.danger }]}>{value}</Text>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  title: { ...typography.bodyBold, color: colors.text, fontSize: 15 },
  loadingText: { ...typography.caption, color: colors.textMuted },
  mutedText: { ...typography.caption, color: colors.textMuted },
  errorText: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
  rows: { gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  rowLabel: { ...typography.caption, color: colors.textMuted },
  rowValue: { ...typography.caption, color: colors.text, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
  dangerBanner: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.dangerLight,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.md,
    alignItems: 'flex-start',
  },
  dangerBannerText: { ...typography.caption, color: colors.danger, flex: 1 },
  warnBanner: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.dangerLight,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  warnBannerText: { ...typography.caption, color: colors.danger, flex: 1 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  adminButtonText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  infoBanner: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
    alignItems: 'flex-start',
  },
  infoBannerText: { ...typography.caption, color: colors.primary, flex: 1 },
  fieldLabel: { ...typography.bodyBold, fontSize: 13, color: colors.text, marginBottom: spacing.sm },
  offreOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  offreOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  offreOptionText: { ...typography.caption, color: colors.text, flex: 1 },
  offreOptionTextActive: { color: colors.white, fontWeight: '700' },
  periodRow: { flexDirection: 'row', gap: spacing.sm },
  periodChip: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  periodChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  periodChipText: { ...typography.caption, color: colors.text, fontWeight: '600' },
  periodChipTextActive: { color: colors.white },
  montantText: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
});

export default OffreInfoPanel;
