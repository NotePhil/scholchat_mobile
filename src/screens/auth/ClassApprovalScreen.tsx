import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { LoadingSpinner } from '../../components/ui';
import { colors, spacing, typography } from '../../styles/theme';
import { establishmentService } from '../../services/api';

type Status = 'loading' | 'success' | 'error';

/** Reached via the emailed class-approval link (no login required). */
const ClassApprovalScreen = () => {
  const route = useRoute<any>();
  const classeId: string | undefined = route.params?.classeId;
  const etablissementId: string | undefined = route.params?.etablissementId;

  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const run = async () => {
      if (!classeId || !etablissementId) {
        setStatus('error');
        setMessage('Lien invalide.');
        return;
      }
      try {
        await establishmentService.approveClass(classeId, etablissementId);
        setStatus('success');
        setMessage('Classe validée avec succès par l’établissement !');
      } catch (err) {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Erreur lors de la validation de la classe.');
      }
    };
    run();
  }, [classeId, etablissementId]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        {status === 'loading' && <LoadingSpinner label="Validation en cours..." />}
        {status === 'success' && (
          <View style={styles.center}>
            <FontAwesome5 name="check-circle" size={48} color={colors.success} />
            <Text style={styles.title}>Validation réussie !</Text>
            <Text style={styles.message}>{message}</Text>
          </View>
        )}
        {status === 'error' && (
          <View style={styles.center}>
            <FontAwesome5 name="exclamation-circle" size={48} color={colors.danger} />
            <Text style={styles.title}>Erreur de validation</Text>
            <Text style={styles.message}>{message}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.xl },
  center: { alignItems: 'center' },
  title: { ...typography.h2, color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm, textAlign: 'center' },
  message: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});

export default ClassApprovalScreen;
