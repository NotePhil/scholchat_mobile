import React, { useEffect, useMemo, useState } from 'react';
import { formatDate } from '../../utils/dates';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Button, Card, Input, LoadingSpinner } from '../../components/ui';
import { colors, spacing, typography, useThemeColors } from '../../styles/theme';
import { contratService } from '../../services/api';
import { PaymentInfo } from '../../services/api/contratService';
import PaymentModal from '../../components/common/PaymentModal';
import { useT } from '../../i18n';

type EntityType = 'CLASSE' | 'ETABLISSEMENT';

/** Public (no-login) subscription-renewal flow, reached via an emailed link (?token=). */
const RenewalScreen = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, locale } = useT();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const token: string | undefined = route.params?.token;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Button label={t('auth.common.backToLogin')} variant="ghost" onPress={() => navigation.goBack()} />
        {token ? <RenewalWithToken token={token} /> : <RenewalRequestForm />}
      </ScrollView>
    </SafeAreaView>
  );
};

const RenewalRequestForm = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, locale } = useT();
  const [email, setEmail] = useState('');
  const [entityType, setEntityType] = useState<EntityType>('CLASSE');
  const [entityId, setEntityId] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email.trim() || !entityId.trim()) {
      setError(t('auth.renewal.missingFields'));
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
          <Text style={styles.title}>{t('auth.signup.rolePending.title')}</Text>
          <Text style={styles.message}>{t('auth.renewal.sentMessage')}</Text>
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <Text style={styles.title}>{t('auth.renewal.title')}</Text>
      <Text style={styles.message}>{t('auth.renewal.subtitle')}</Text>

      <Input label={t('auth.common.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" error={error} />

      <View style={styles.toggleRow}>
        {(['CLASSE', 'ETABLISSEMENT'] as EntityType[]).map((type) => (
          <Button
            key={type}
            label={type === 'CLASSE' ? t('auth.renewal.classId') : t('auth.renewal.establishmentId')}
            variant={entityType === type ? 'primary' : 'secondary'}
            onPress={() => setEntityType(type)}
            style={styles.toggleButton}
          />
        ))}
      </View>

      <Input
        label={entityType === 'CLASSE' ? t('auth.renewal.classIdLabel') : t('auth.renewal.establishmentIdLabel')}
        value={entityId}
        onChangeText={setEntityId}
      />

      <Button label={t('auth.renewal.sendLink')} onPress={handleSubmit} loading={loading} fullWidth />
    </Card>
  );
};

const RenewalWithToken = ({ token }: { token: string }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, locale } = useT();
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
        if (data?.contratCourant?.periodicite) setPeriodicite(data.contratCourant.periodicite as 'MENSUEL' | 'ANNUEL');
      } catch {
        setError(t('auth.renewal.invalidLink'));
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
      setError(err instanceof Error ? err.message : t('auth.renewal.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner label={t('common.loading')} />;

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
          <Text style={styles.title}>{t('auth.renewal.successTitle')}</Text>
          <Text style={styles.message}>{t('auth.renewal.successMessage')}</Text>
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <Text style={styles.title}>{t('auth.renewal.renewalOf', { name: statut?.nom ?? '' })}</Text>

      {contrat && (
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>{t('auth.renewal.currentOffer')}</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>{t('auth.renewal.plan')}</Text>
            <Text style={styles.infoValue}>{contrat.offreNom}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>{t('auth.renewal.status')}</Text>
            <Text style={[styles.infoValue, { color: contrat.statut === 'ACTIF' ? colors.success : colors.danger }]}>
              {contrat.statut}
            </Text>
          </View>
          {contrat.dateFin && (
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>{t('auth.renewal.expiresOn')}</Text>
              <Text style={styles.infoValue}>{formatDate(contrat.dateFin)}</Text>
            </View>
          )}
          {contrat.classesMax != null && (
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>{t('auth.renewal.classes')}</Text>
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
          label={t('auth.renewal.extend')}
          variant={action === 'prolonger' ? 'primary' : 'secondary'}
          onPress={() => {
            setAction('prolonger');
            setNouvelleOffreId('');
          }}
          style={styles.toggleButton}
        />
        <Button
          label={t('auth.renewal.change')}
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
            label={`${offre.nom}${offre.prixMensuel ? ` — ${Number(offre.prixMensuel).toLocaleString(locale)} ${t('auth.renewal.perMonth')}` : ''}`}
            variant={nouvelleOffreId === offre.id ? 'primary' : 'secondary'}
            onPress={() => setNouvelleOffreId(offre.id)}
            fullWidth
            style={styles.offreButton}
          />
        ))}

      <View style={styles.toggleRow}>
        <Button
          label={t('auth.renewal.monthly')}
          variant={periodicite === 'MENSUEL' ? 'primary' : 'secondary'}
          onPress={() => setPeriodicite('MENSUEL')}
          style={styles.toggleButton}
        />
        <Button
          label={t('auth.renewal.yearly')}
          variant={periodicite === 'ANNUEL' ? 'primary' : 'secondary'}
          onPress={() => setPeriodicite('ANNUEL')}
          style={styles.toggleButton}
        />
      </View>

      {montant > 0 ? (
        <Text style={styles.montantText}>
          {t('auth.renewal.amount')} <Text style={styles.montantValue}>{montant.toLocaleString(locale)} FCFA</Text>
        </Text>
      ) : null}

      <Button
        label={t('auth.renewal.pay')}
        onPress={() => {
          if (action === 'changer' && !nouvelleOffreId) {
            setError(t('auth.renewal.selectOffer'));
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
        label={action === 'changer' ? offreCible?.nom || t('auth.renewal.newOffer') : contrat?.offreNom || t('auth.renewal.renewal')}
        subLabel={periodicite === 'ANNUEL' ? t('auth.renewal.yearlyPeriod') : t('auth.renewal.monthlyPeriod')}
      />
    </Card>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
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
