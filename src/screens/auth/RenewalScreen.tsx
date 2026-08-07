import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Button, Card, Input, LoadingSpinner } from '../../components/ui';
import { colors, spacing, typography } from '../../styles/theme';
import { contratService } from '../../services/api';
import { PaymentInfo } from '../../services/api/contratService';
import PaymentModal from '../../components/common/PaymentModal';

type EntityType = 'CLASSE' | 'ETABLISSEMENT';

/** Public (no-login) subscription-renewal flow, reached via an emailed link (?token=). */
const RenewalScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const token: string | undefined = route.params?.token;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Button label="Retour à la connexion" variant="ghost" onPress={() => navigation.goBack()} />
        {token ? <RenewalWithToken token={token} /> : <RenewalRequestForm />}
      </ScrollView>
    </SafeAreaView>
  );
};

const RenewalRequestForm = () => {
  const [email, setEmail] = useState('');
  const [entityType, setEntityType] = useState<EntityType>('CLASSE');
  const [entityId, setEntityId] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email.trim() || !entityId.trim()) {
      setError("Merci de renseigner votre email et l'identifiant de votre classe ou établissement.");
      return;
    }
    setLoading(true);
    setError('');
    try {
      await contratService.requestRenewalLink({
        email: email.trim(),
        classeId: entityType === 'CLASSE' ? entityId.trim() : undefined,
        etablissementId: entityType === 'ETABLISSEMENT' ? entityId.trim() : undefined,
      });
    } catch {
      // anti-enumeration, same as web
    } finally {
      setSent(true);
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <Card>
        <View style={styles.center}>
          <FontAwesome5 name="check-circle" size={36} color={colors.success} />
          <Text style={styles.title}>Demande envoyée</Text>
          <Text style={styles.message}>
            Si les informations correspondent à un compte existant, un email contenant un lien de renouvellement
            vient de vous être envoyé.
          </Text>
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <Text style={styles.title}>Renouveler mon compte</Text>
      <Text style={styles.message}>
        Renseignez votre email et l'identifiant de votre classe ou établissement. Vous recevrez un lien sécurisé.
      </Text>

      <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" error={error} />

      <View style={styles.toggleRow}>
        {(['CLASSE', 'ETABLISSEMENT'] as EntityType[]).map((type) => (
          <Button
            key={type}
            label={type === 'CLASSE' ? 'ID de classe' : "ID d'établissement"}
            variant={entityType === type ? 'primary' : 'secondary'}
            onPress={() => setEntityType(type)}
            style={styles.toggleButton}
          />
        ))}
      </View>

      <Input
        label={entityType === 'CLASSE' ? 'Identifiant de la classe' : "Identifiant de l'établissement"}
        value={entityId}
        onChangeText={setEntityId}
      />

      <Button label="Envoyer le lien de renouvellement" onPress={handleSubmit} loading={loading} fullWidth />
    </Card>
  );
};

const RenewalWithToken = ({ token }: { token: string }) => {
  const [statut, setStatut] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [action, setAction] = useState<'prolonger' | 'changer'>('prolonger');
  const [nouvelleOffreId, setNouvelleOffreId] = useState('');
  const [periodicite, setPeriodicite] = useState<'MENSUEL' | 'ANNUEL'>('MENSUEL');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await contratService.getRenewalStatus(token);
        setStatut(data);
        if (data?.contratCourant?.periodicite) setPeriodicite(data.contratCourant.periodicite);
      } catch {
        setError('Ce lien de renouvellement est invalide ou a expiré. Merci de refaire une demande.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const offres: Record<string, any>[] = statut?.offresDisponibles || [];
  const contrat = statut?.contratCourant;
  const offreCible = offres.find((o) => o.id === nouvelleOffreId) || null;
  const montant =
    action === 'changer' && offreCible
      ? Number(periodicite === 'ANNUEL' ? offreCible.prixAnnuel : offreCible.prixMensuel) || 0
      : contrat
      ? Number(periodicite === 'ANNUEL' ? contrat.prixAnnuel : contrat.prixMensuel) || 0
      : 0;

  const handlePaymentSuccess = async (paymentInfo: PaymentInfo) => {
    setSubmitting(true);
    try {
      if (action === 'changer') {
        await contratService.changeOfferByToken(token, nouvelleOffreId, { periodicite, paymentInfo });
      } else {
        await contratService.extendByToken(token, { periodicite, paymentInfo });
      }
      setShowPayment(false);
      setSuccess(true);
    } catch (err) {
      setShowPayment(false);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors du renouvellement.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner label="Chargement..." />;

  if (error && !statut) {
    return (
      <Card>
        <View style={styles.center}>
          <FontAwesome5 name="exclamation-circle" size={36} color={colors.danger} />
          <Text style={styles.message}>{error}</Text>
        </View>
      </Card>
    );
  }

  if (success) {
    return (
      <Card>
        <View style={styles.center}>
          <FontAwesome5 name="check-circle" size={36} color={colors.success} />
          <Text style={styles.title}>Offre activée !</Text>
          <Text style={styles.message}>Votre offre a été renouvelée avec succès. Vous pouvez maintenant vous connecter.</Text>
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <Text style={styles.title}>Renouvellement — {statut?.nom}</Text>

      {contrat && (
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Offre actuelle</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Forfait</Text>
            <Text style={styles.infoValue}>{contrat.offreNom}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Statut</Text>
            <Text style={[styles.infoValue, { color: contrat.statut === 'ACTIF' ? colors.success : colors.danger }]}>
              {contrat.statut}
            </Text>
          </View>
          {contrat.dateFin && (
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Expire le</Text>
              <Text style={styles.infoValue}>{new Date(contrat.dateFin).toLocaleDateString('fr-FR')}</Text>
            </View>
          )}
          {contrat.classesMax != null && (
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Classes</Text>
              <Text style={styles.infoValue}>
                {contrat.classesUtilisees ?? 0} / {contrat.classesMax}
              </Text>
            </View>
          )}
        </View>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.toggleRow}>
        <Button
          label="Prolonger la même offre"
          variant={action === 'prolonger' ? 'primary' : 'secondary'}
          onPress={() => {
            setAction('prolonger');
            setNouvelleOffreId('');
          }}
          style={styles.toggleButton}
        />
        <Button
          label="Changer d'offre"
          variant={action === 'changer' ? 'primary' : 'secondary'}
          onPress={() => {
            setAction('changer');
            setNouvelleOffreId('');
          }}
          style={styles.toggleButton}
        />
      </View>

      {action === 'changer' &&
        offres.map((offre) => (
          <Button
            key={offre.id}
            label={`${offre.nom}${offre.prixMensuel ? ` — ${Number(offre.prixMensuel).toLocaleString('fr-FR')} FCFA/mois` : ''}`}
            variant={nouvelleOffreId === offre.id ? 'primary' : 'secondary'}
            onPress={() => setNouvelleOffreId(offre.id)}
            fullWidth
            style={styles.offreButton}
          />
        ))}

      <View style={styles.toggleRow}>
        <Button
          label="Mensuel"
          variant={periodicite === 'MENSUEL' ? 'primary' : 'secondary'}
          onPress={() => setPeriodicite('MENSUEL')}
          style={styles.toggleButton}
        />
        <Button
          label="Annuel"
          variant={periodicite === 'ANNUEL' ? 'primary' : 'secondary'}
          onPress={() => setPeriodicite('ANNUEL')}
          style={styles.toggleButton}
        />
      </View>

      {montant > 0 ? (
        <Text style={styles.montantText}>
          Montant : <Text style={styles.montantValue}>{montant.toLocaleString('fr-FR')} FCFA</Text>
        </Text>
      ) : null}

      <Button
        label="Procéder au paiement"
        onPress={() => {
          if (action === 'changer' && !nouvelleOffreId) {
            setError('Veuillez sélectionner une offre.');
            return;
          }
          setError('');
          setShowPayment(true);
        }}
        disabled={montant <= 0}
        fullWidth
        style={styles.confirmButton}
      />

      <PaymentModal
        visible={showPayment}
        onClose={() => setShowPayment(false)}
        onSuccess={handlePaymentSuccess}
        montant={montant}
        label={action === 'changer' ? offreCible?.nom || 'Nouvelle offre' : contrat?.offreNom || 'Renouvellement'}
        subLabel={periodicite === 'ANNUEL' ? 'Périodicité annuelle' : 'Périodicité mensuelle'}
      />
    </Card>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  center: { alignItems: 'center', gap: spacing.sm },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
  message: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  toggleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  toggleButton: { flex: 1 },
  infoBox: { backgroundColor: colors.background, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md, gap: 4 },
  infoLabel: { ...typography.bodyBold, color: colors.text, marginBottom: 4 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoKey: { ...typography.body, color: colors.textMuted },
  infoValue: { ...typography.bodyBold, color: colors.text },
  errorText: { ...typography.caption, color: colors.danger, marginBottom: spacing.md },
  offreButton: { marginBottom: spacing.sm },
  montantText: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.md },
  montantValue: { ...typography.bodyBold, color: colors.text },
  confirmButton: { marginTop: spacing.md },
});

export default RenewalScreen;
