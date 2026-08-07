import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BottomSheet, Badge, Button, EmptyState, LoadingSpinner } from '../../../../components/ui';
import { colors, spacing, typography } from '../../../../styles/theme';
import { coursProgrammerService } from '../../../../services/api';
import { useUser } from '../../../../context/UserContext';
import { CoursProgramme } from '../../../../types';

interface ScheduledCoursListModalProps {
  visible: boolean;
  onClose: () => void;
}

const ScheduledCoursListModal = ({ visible, onClose }: ScheduledCoursListModalProps) => {
  const { user } = useUser();
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<CoursProgramme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user?.userId) return;
    setLoading(true);
    setError('');
    try {
      const data = await coursProgrammerService.getByProfessor(user.userId);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec du chargement des programmations.');
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const handleCancel = (item: CoursProgramme) => {
    Alert.alert('Annuler la programmation', 'Voulez-vous vraiment annuler ce cours programmé ?', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Annuler le cours',
        style: 'destructive',
        onPress: async () => {
          try {
            await coursProgrammerService.remove(item.id);
            setItems((prev) => prev.filter((i) => i.id !== item.id));
          } catch (err) {
            Alert.alert('Erreur', err instanceof Error ? err.message : "Échec de l'annulation.");
          }
        },
      },
    ]);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Cours programmés">
      <ScrollView style={styles.scroll}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? (
          <LoadingSpinner label="Chargement..." />
        ) : items.length === 0 ? (
          <EmptyState icon="calendar-alt" title="Aucun cours programmé" />
        ) : (
          items.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <FontAwesome5 name="calendar-alt" size={14} color={colors.primary} />
                <Text style={styles.cardTitle}>
                  {item.dateCoursPrevue ? new Date(item.dateCoursPrevue).toLocaleString('fr-FR') : 'Date non définie'}
                </Text>
                {item.etatCoursProgramme ? <Badge label={item.etatCoursProgramme} tone="info" /> : null}
              </View>
              {item.lieu ? <Text style={styles.cardMeta}>{item.lieu}</Text> : null}
              {item.classes && item.classes.length > 0 ? (
                <Text style={styles.cardMeta}>{item.classes.map((c) => c.nom).join(', ')}</Text>
              ) : null}
              <View style={styles.cardActions}>
                <Button
                  label="Session live"
                  variant="secondary"
                  onPress={() => {
                    onClose();
                    navigation.navigate('LiveSession', { coursId: item.coursId, isHost: true });
                  }}
                  style={styles.actionButton}
                />
                <Button label="Annuler" variant="danger" onPress={() => handleCancel(item)} style={styles.actionButton} />
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  scroll: { maxHeight: 500 },
  error: { color: colors.danger, marginBottom: spacing.md },
  card: { backgroundColor: colors.background, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  cardTitle: { ...typography.bodyBold, color: colors.text, flex: 1 },
  cardMeta: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
  cardActions: { flexDirection: 'row', gap: spacing.sm },
  actionButton: { flex: 1 },
});

export default ScheduledCoursListModal;
