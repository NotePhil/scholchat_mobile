import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { EmptyState, LoadingSpinner } from '../../components/ui';
import { spacing, typography, useThemeColors } from '../../styles/theme';
import { notificationService } from '../../services/api';
import { useNotificationsStore, NotificationItem } from '../../store/useNotificationsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useThemeStore } from '../../store/useThemeStore';
import { useT } from '../../i18n';
import { HelpButton, getHelpTarget } from './HelpSheet';
import { formatNotificationDate, getNotificationIcon } from '../../services/notificationRouting';
import { openNotification } from '../../services/notificationNavigation';

type Filter = 'all' | 'unread';

/**
 * Full notification list, stack-pushed on top of the role Dashboard (so it has
 * its own header and no floating footer). List state lives in
 * useNotificationsStore, which AppHeader's useNotificationsRealtime keeps live
 * (WebSocket push / polling) — this screen just refreshes it on open and on
 * pull-to-refresh.
 */
const NotificationsScreen = () => {
  const colors = useThemeColors();
  const isDark = useThemeStore((s) => s.mode) === 'dark';
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const navigation = useNavigation<any>();
  const role = useAuthStore((s) => s.role);
  const items = useNotificationsStore((s) => s.items);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const setItems = useNotificationsStore((s) => s.setItems);
  const markReadLocally = useNotificationsStore((s) => s.markReadLocally);
  const markAllReadLocally = useNotificationsStore((s) => s.markAllReadLocally);
  const removeLocally = useNotificationsStore((s) => s.removeLocally);
  const [loading, setLoading] = useState(items.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      setError('');
      try {
        setItems(await notificationService.getAll());
      } catch (err) {
        setError(err instanceof Error ? err.message : t('notifications.loadFailed'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [setItems],
  );

  useEffect(() => {
    load();
  }, [load]);

  const visible = filter === 'unread' ? items.filter((n) => !n.isRead) : items;

  const handlePress = (notification: NotificationItem) => {
    if (!notification.isRead) {
      markReadLocally(notification.id);
      notificationService.markAsRead(notification.id).catch(() => {});
    }
    // Straight to the item itself; dashboard items are requested on the (still mounted) role
    // Dashboard underneath and revealed by navigating back to it.
    const auth = useAuthStore.getState();
    openNotification(notification, {
      role,
      userId: (auth.user?.userId as string | undefined) ?? null,
      navigation,
      login: auth.login,
    });
  };

  const handleMarkAllRead = async () => {
    markAllReadLocally();
    try {
      await notificationService.markAllAsRead();
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('notifications.updateFailed'));
      load();
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(t('common.delete'), t('notifications.deleteOne'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          removeLocally(id);
          try {
            await notificationService.remove(id);
          } catch (err) {
            Alert.alert(t('common.error'), err instanceof Error ? err.message : t('notifications.deleteFailed'));
            load();
          }
        },
      },
    ]);
  };

  const handleClearAll = () => {
    if (items.length === 0) return;
    Alert.alert(t('notifications.deleteAll'), t('notifications.deleteAllConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('notifications.deleteAll'),
        style: 'destructive',
        onPress: async () => {
          setItems([]);
          try {
            await notificationService.removeAll();
          } catch (err) {
            Alert.alert(t('common.error'), err instanceof Error ? err.message : t('notifications.deleteFailed'));
            load();
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton} accessibilityLabel={t('common.back')}>
          <FontAwesome5 name="arrow-left" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('notifications.title')}</Text>
        <HelpButton target={getHelpTarget(role, 'notifications')} style={{ marginRight: spacing.xs }} />
        <TouchableOpacity
          onPress={handleClearAll}
          style={[styles.iconButton, items.length === 0 && styles.disabled]}
          disabled={items.length === 0}
          accessibilityLabel={t('notifications.deleteAll')}
        >
          <FontAwesome5 name="trash-alt" size={16} color={colors.danger} />
        </TouchableOpacity>
      </View>

      <View style={styles.toolbar}>
        <View style={styles.filters}>
          {(['all', 'unread'] as Filter[]).map((f) => {
            const active = filter === f;
            const label = f === 'all' ? t('notifications.allCount', { count: items.length }) : t('notifications.unreadCount', { count: unreadCount });
            return (
              <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAll}>
            <FontAwesome5 name="check-double" size={12} color={colors.primary} />
            <Text style={styles.markAllText}>{t('notifications.markAllRead')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {error ? (
          <TouchableOpacity style={styles.errorBox} onPress={() => load(true)}>
            <FontAwesome5 name="exclamation-circle" size={14} color={colors.danger} />
            <Text style={styles.errorText}>{error} {t('common.tapToRetry')}</Text>
          </TouchableOpacity>
        ) : null}
        {loading ? (
          <LoadingSpinner label={t('common.loading')} />
        ) : visible.length === 0 ? (
          error ? null : (
            <EmptyState
              icon="bell"
              title={filter === 'unread' ? t('notifications.emptyUnread') : t('notifications.empty')}
              message={t('notifications.upToDate')}
            />
          )
        ) : (
          visible.map((n) => {
            const meta = getNotificationIcon(n.type);
            return (
              <TouchableOpacity
                key={n.id}
                style={[styles.card, !n.isRead && styles.cardUnread]}
                onPress={() => handlePress(n)}
                activeOpacity={0.75}
              >
                <View style={[styles.iconCircle, { backgroundColor: `${meta.color}22` }]}>
                  <FontAwesome5 name={meta.icon} size={14} color={meta.color} />
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.cardTitle, !n.isRead && styles.cardTitleUnread]} numberOfLines={2}>
                      {n.title ?? t('notifications.fallbackTitle')}
                    </Text>
                    {!n.isRead && <View style={styles.unreadDot} />}
                  </View>
                  {n.message ? <Text style={styles.cardMessage}>{String(n.message)}</Text> : null}
                  <Text style={styles.cardDate}>
                    {formatNotificationDate(n.createdAt)}
                    {n.actorName ? ` · ${n.actorName}` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDelete(n.id)}
                  style={styles.deleteButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={t('common.delete')}
                >
                  <FontAwesome5 name="times" size={14} color={colors.textMuted} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    iconButton: { padding: spacing.sm },
    disabled: { opacity: 0.4 },
    headerTitle: { ...typography.h3, color: colors.text, flex: 1, marginLeft: spacing.sm },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    filters: { flexDirection: 'row', gap: spacing.xs },
    chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.surfaceElevated },
    chipActive: { backgroundColor: colors.primary },
    chipText: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
    chipTextActive: { color: colors.white },
    markAll: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: spacing.xs },
    markAllText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
    list: { flex: 1, paddingHorizontal: spacing.lg },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: 10,
      backgroundColor: isDark ? colors.surfaceElevated : colors.dangerLight,
      marginBottom: spacing.md,
    },
    errorText: { color: colors.danger, flex: 1 },
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderLeftWidth: 3,
      borderLeftColor: 'transparent',
    },
    cardUnread: {
      backgroundColor: isDark ? colors.surfaceElevated : colors.primaryLight,
      borderLeftColor: colors.primary,
    },
    iconCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
    cardBody: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
    cardTitle: { ...typography.body, color: colors.text, flex: 1 },
    cardTitleUnread: { fontWeight: '700' },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginLeft: spacing.xs, marginTop: 6 },
    cardMessage: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
    cardDate: { ...typography.caption, color: colors.textLight, marginTop: 4, fontSize: 11 },
    deleteButton: { padding: spacing.xs, marginLeft: spacing.xs },
  });

export default NotificationsScreen;
