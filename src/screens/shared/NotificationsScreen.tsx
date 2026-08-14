import React, { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { EmptyState, LoadingSpinner } from '../../components/ui';
import { colors, spacing, typography } from '../../styles/theme';
import { notificationService } from '../../services/api';
import { useNotificationsStore, NotificationItem } from '../../store/useNotificationsStore';
import { useUiStore } from '../../store/useUiStore';

const NotificationsScreen = () => {
  const navigation = useNavigation();
  const { items, setItems, setUnreadCount, markReadLocally } = useNotificationsStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [list, count] = await Promise.all([notificationService.getAll(), notificationService.getUnreadCount()]);
      setItems(list);
      setUnreadCount(count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec du chargement des notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setItems, setUnreadCount]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePress = async (notification: NotificationItem) => {
    markReadLocally(notification.id);
    try {
      await notificationService.markAsRead(notification.id);
    } catch {
      // best-effort
    }
    if (notification.type === 'MESSAGE_SENT' || notification.relatedEntityType === 'MESSAGE') {
      // The role Dashboard underneath is still mounted (this screen is stack-pushed on top of
      // it, not a replacement) — request the tab switch, then reveal it by going back.
      useUiStore.getState().requestTab('messages');
      navigation.goBack();
    }
  };

  const handleMarkAllRead = async () => {
    items.forEach((n) => !n.lu && markReadLocally(n.id));
    try {
      await notificationService.markAllAsRead();
    } catch {
      // best-effort
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Supprimer', 'Supprimer cette notification ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          setItems(items.filter((n) => n.id !== id));
          try {
            await notificationService.remove(id);
          } catch (err) {
            Alert.alert('Erreur', err instanceof Error ? err.message : 'Échec de la suppression.');
          }
        },
      },
    ]);
  };

  const handleClearAll = () => {
    Alert.alert('Tout supprimer', 'Supprimer toutes les notifications ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Tout supprimer',
        style: 'destructive',
        onPress: async () => {
          setItems([]);
          setUnreadCount(0);
          try {
            await notificationService.removeAll();
          } catch (err) {
            Alert.alert('Erreur', err instanceof Error ? err.message : 'Échec de la suppression.');
          }
        },
      },
    ]);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity onPress={handleClearAll} style={styles.backButton}>
          <FontAwesome5 name="trash" size={16} color={colors.danger} />
        </TouchableOpacity>
      </View>

      {items.length > 0 && (
        <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllRow}>
          <Text style={styles.markAllText}>Tout marquer comme lu</Text>
        </TouchableOpacity>
      )}

      <ScrollView
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? (
          <LoadingSpinner label="Chargement..." />
        ) : items.length === 0 ? (
          <EmptyState icon="bell" title="Aucune notification" message="Vous êtes à jour !" />
        ) : (
          items.map((n) => (
            <TouchableOpacity
              key={n.id}
              style={[styles.card, !n.isRead && styles.cardUnread]}
              onPress={() => handlePress(n)}
            >
              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, !n.isRead && styles.cardTitleUnread]}>{n.title ?? 'Notification'}</Text>
                {n.message ? <Text style={styles.cardMessage}>{String(n.message)}</Text> : null}
                <Text style={styles.cardDate}>{formatDate(n.createdAt)}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(n.id)} style={styles.deleteButton}>
                <FontAwesome5 name="times" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: { padding: spacing.sm },
  headerTitle: { ...typography.h3, color: colors.text },
  markAllRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, alignItems: 'flex-end' },
  markAllText: { color: colors.primary, fontWeight: '600' },
  list: { flex: 1, paddingHorizontal: spacing.lg },
  error: { color: colors.danger, marginBottom: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardUnread: { backgroundColor: colors.primaryLight },
  cardBody: { flex: 1 },
  cardTitle: { ...typography.body, color: colors.text },
  cardTitleUnread: { fontWeight: '700' },
  cardMessage: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  cardDate: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  deleteButton: { padding: spacing.xs },
});

export default NotificationsScreen;
