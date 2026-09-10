import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { BottomSheet, Button, Input } from '../ui';
import { colors, radius, spacing, typography, useThemeColors } from '../../styles/theme';
import { PaymentInfo } from '../../services/api/contratService';

type MethodKey = 'orange' | 'mtn' | 'card';

const PAYMENT_METHODS: { key: MethodKey; label: string; desc: string; icon: React.ComponentProps<typeof FontAwesome5>['name'] }[] = [
  { key: 'orange', label: 'Orange Money', desc: 'Paiement mobile', icon: 'mobile-alt' },
  { key: 'mtn', label: 'MTN Mobile Money', desc: 'Paiement mobile', icon: 'mobile-alt' },
  { key: 'card', label: 'Carte bancaire', desc: 'Visa, Mastercard', icon: 'credit-card' },
];

interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (paymentInfo: PaymentInfo) => void;
  montant: number;
  label: string;
  subLabel?: string;
}

/**
 * Simulated payment flow — mirrors scholchat_front's PaymentModal.jsx exactly
 * (same steps, same validation rules, same PaymentInfoDto field names sent to
 * the real backend). The simulation is intentional product behavior on web,
 * not mock data: the resulting paymentInfo is submitted to the real
 * /contrats endpoints.
 */
const PaymentModal = ({ visible, onClose, onSuccess, montant, label, subLabel }: PaymentModalProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [method, setMethod] = useState<MethodKey | null>(null);
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      setStep(1);
      setMethod(null);
      setPhone('');
      setPhoneError('');
      setCardNumber('');
      setExpiry('');
      setCvv('');
      setCardName('');
      setCardErrors({});
    }
  }, [visible]);

  const formatCardNumber = (value: string) =>
    value
      .replace(/\s/g, '')
      .replace(/\D/g, '')
      .replace(/(\d{4})/g, '$1 ')
      .trim()
      .slice(0, 19);

  const formatExpiry = (value: string) =>
    value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '$1/$2')
      .slice(0, 5);

  const handlePay = () => {
    if (method === 'orange' || method === 'mtn') {
      const cleaned = phone.replace(/\s/g, '');
      if (!/^[6-9][0-9]{8}$/.test(cleaned)) {
        setPhoneError('Numéro invalide — 9 chiffres, ex : 699999999');
        return;
      }
      setStep(3);
      setTimeout(() => {
        setStep(4);
        setTimeout(
          () =>
            onSuccess({
              paymentMethod: method === 'orange' ? 'OM' : 'MOMO',
              phoneNumber: `+237${cleaned}`,
              amount: montant,
            }),
          900
        );
      }, 1600);
      return;
    }

    const errs: Record<string, string> = {};
    if (cardNumber.replace(/\s/g, '').length !== 16) errs.number = '16 chiffres requis';
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) errs.expiry = 'Format MM/AA';
    if (!/^\d{3,4}$/.test(cvv)) errs.cvv = '3 ou 4 chiffres';
    if (!cardName.trim()) errs.name = 'Nom requis';
    if (Object.keys(errs).length > 0) {
      setCardErrors(errs);
      return;
    }
    setStep(3);
    setTimeout(() => {
      setStep(4);
      setTimeout(
        () =>
          onSuccess({
            paymentMethod: 'CARD',
            cardNumber: cardNumber.replace(/\s/g, ''),
            expiryDate: expiry,
            cvv,
            cardHolderName: cardName,
            amount: montant,
          }),
        900
      );
    }, 1600);
  };

  const selectedMethod = PAYMENT_METHODS.find((m) => m.key === method);

  return (
    <BottomSheet visible={visible} onClose={step === 3 ? () => {} : onClose} title="Paiement sécurisé">
      <View style={styles.summary}>
        <View style={styles.summaryIcon}>
          <FontAwesome5 name="receipt" size={16} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryLabel} numberOfLines={1}>
            {label}
          </Text>
          {subLabel ? <Text style={styles.summarySub}>{subLabel}</Text> : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.summaryAmount}>{montant.toLocaleString('fr-FR')}</Text>
          <Text style={styles.summarySub}>FCFA</Text>
        </View>
      </View>

      {step === 1 && (
        <View>
          <Text style={styles.stepTitle}>Choisissez votre méthode de paiement</Text>
          {PAYMENT_METHODS.map((m) => (
            <TouchableOpacity
              key={m.key}
              style={styles.methodRow}
              onPress={() => {
                setMethod(m.key);
                setStep(2);
              }}
            >
              <View style={styles.methodIcon}>
                <FontAwesome5 name={m.icon} size={16} color={colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.methodLabel}>{m.label}</Text>
                <Text style={styles.summarySub}>{m.desc}</Text>
              </View>
              <FontAwesome5 name="chevron-right" size={12} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
          <View style={styles.noticeRow}>
            <FontAwesome5 name="lock" size={11} color={colors.textMuted} />
            <Text style={styles.noticeText}>
              Paiement simulé à des fins de démonstration — aucune donnée réelle n'est transmise.
            </Text>
          </View>
        </View>
      )}

      {step === 2 && (
        <View>
          <TouchableOpacity onPress={() => setStep(1)} style={styles.backRow}>
            <FontAwesome5 name="chevron-left" size={11} color={colors.textMuted} />
            <Text style={styles.backText}>Changer de méthode</Text>
          </TouchableOpacity>

          {method === 'orange' || method === 'mtn' ? (
            <View>
              <Text style={styles.methodLabel}>{selectedMethod?.label}</Text>
              <Input
                label="Numéro de téléphone *"
                value={phone}
                onChangeText={(text) => {
                  setPhone(text.replace(/\D/g, '').slice(0, 9));
                  setPhoneError('');
                }}
                placeholder="6XX XX XX XX"
                keyboardType="number-pad"
                error={phoneError}
              />
              <View style={styles.noticeRow}>
                <Text style={styles.noticeText}>
                  Une demande de confirmation sera envoyée sur ce numéro pour valider {montant.toLocaleString('fr-FR')} FCFA.
                </Text>
              </View>
            </View>
          ) : (
            <View>
              <Input
                label="Numéro de carte *"
                value={cardNumber}
                onChangeText={(text) => setCardNumber(formatCardNumber(text))}
                placeholder="1234 5678 9012 3456"
                keyboardType="number-pad"
                error={cardErrors.number}
              />
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Expiration *"
                    value={expiry}
                    onChangeText={(text) => setExpiry(formatExpiry(text))}
                    placeholder="MM/AA"
                    keyboardType="number-pad"
                    error={cardErrors.expiry}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="CVV *"
                    value={cvv}
                    onChangeText={(text) => setCvv(text.replace(/\D/g, '').slice(0, 4))}
                    placeholder="123"
                    keyboardType="number-pad"
                    error={cardErrors.cvv}
                  />
                </View>
              </View>
              <Input
                label="Nom sur la carte *"
                value={cardName}
                onChangeText={(text) => setCardName(text.toUpperCase())}
                placeholder="JEAN DUPONT"
                error={cardErrors.name}
              />
            </View>
          )}

          <Button label={`Payer ${montant.toLocaleString('fr-FR')} FCFA`} onPress={handlePay} fullWidth style={styles.payButton} />
        </View>
      )}

      {step === 3 && (
        <View style={styles.centerStep}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.processingTitle}>Traitement du paiement…</Text>
          <Text style={styles.summarySub}>
            {method === 'card' ? 'Vérification de la carte en cours' : 'Validation via mobile money en cours'}
          </Text>
        </View>
      )}

      {step === 4 && (
        <View style={styles.centerStep}>
          <View style={styles.successIcon}>
            <FontAwesome5 name="check" size={28} color={colors.success} />
          </View>
          <Text style={styles.processingTitle}>Paiement accepté !</Text>
          <Text style={styles.summarySub}>Activation en cours…</Text>
        </View>
      )}
    </BottomSheet>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryLabel: { ...typography.bodyBold, color: colors.text },
  summarySub: { ...typography.caption, color: colors.textMuted },
  summaryAmount: { ...typography.h3, color: colors.text },
  stepTitle: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.sm },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodLabel: { ...typography.bodyBold, color: colors.text, marginBottom: 2 },
  noticeRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm, alignItems: 'flex-start' },
  noticeText: { ...typography.caption, color: colors.textMuted, flex: 1 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.md },
  backText: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  row: { flexDirection: 'row', gap: spacing.sm },
  payButton: { marginTop: spacing.sm, marginBottom: spacing.lg },
  centerStep: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.xs },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.successLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  processingTitle: { ...typography.bodyBold, color: colors.text, marginTop: spacing.sm },
});

export default PaymentModal;
