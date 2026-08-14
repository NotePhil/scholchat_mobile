import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../styles/theme';
import { useUser } from '../../context/UserContext';
import { useMessagesStore } from '../../store/useMessagesStore';

interface MobileFooterNavProps {
  activeTab: string;
  onTabPress: (tab: string) => void;
  onOpenQuickActions: () => void;
  quickActionsOpen: boolean;
  accentColor?: string;
}

/**
 * Fixed 5-slot bottom bar — mirrors scholchat_front's MobileBottomNav.jsx
 * exactly: Home / Messages / center "+" FAB (opens the role's quick-actions
 * grid) / Alerts (activities) / Profile (settings). Every role gets this
 * same shape; what differs per role is only the QuickActionsSheet content.
 * Self-fetches the real unread-message count (same pattern RoleHeader
 * already uses for the notification bell) so every dashboard gets the badge
 * for free instead of each one having to wire it through as a prop.
 */
const MobileFooterNav = ({
  activeTab,
  onTabPress,
  onOpenQuickActions,
  quickActionsOpen,
  accentColor = colors.primary,
}: MobileFooterNavProps) => {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const unreadCount = useMessagesStore((s) => s.unreadCount);
  const refreshUnread = useMessagesStore((s) => s.refresh);

  useEffect(() => {
    refreshUnread(user?.userId);
  }, [user?.userId, refreshUnread]);

  const items: { icon: React.ComponentProps<typeof FontAwesome5>['name']; label: string; tab: string; badgeCount?: number }[] = [
    { icon: 'th-large', label: 'Accueil', tab: 'dashboard' },
    { icon: 'envelope', label: 'Messages', tab: 'messages', badgeCount: unreadCount },
  ];
  const trailingItems: { icon: React.ComponentProps<typeof FontAwesome5>['name']; label: string; tab: string }[] = [
    { icon: 'stream', label: 'Activités', tab: 'activities' },
    { icon: 'user', label: 'Profil', tab: 'settings' },
  ];

  const renderItem = (item: { icon: React.ComponentProps<typeof FontAwesome5>['name']; label: string; tab: string; badgeCount?: number }) => {
    const active = activeTab === item.tab;
    return (
      <TouchableOpacity key={item.tab} style={styles.navItem} onPress={() => onTabPress(item.tab)}>
        <View style={styles.iconWrap}>
          <FontAwesome5 name={item.icon} size={20} color={active ? accentColor : colors.gray} solid={active} />
          {item.badgeCount ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.badgeCount > 9 ? '9+' : item.badgeCount}</Text>
            </View>
          ) : null}
        </View>
        {active ? <Text style={[styles.label, { color: accentColor }]}>{item.label}</Text> : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {items.map(renderItem)}

      <View style={styles.centerSlot}>
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: accentColor }]}
          onPress={onOpenQuickActions}
        >
          <FontAwesome5 name={quickActionsOpen ? 'times' : 'th-large'} size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      {trailingItems.map(renderItem)}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  navItem: { alignItems: 'center', justifyContent: 'center', minWidth: 52, gap: 2 },
  iconWrap: { padding: 4 },
  badge: {
    position: 'absolute',
    top: -2,
    right: -6,
    backgroundColor: colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1,
    borderColor: colors.surface,
  },
  badgeText: { color: colors.white, fontSize: 9, fontWeight: '700' },
  label: { fontSize: 10, fontWeight: '700' },
  centerSlot: { alignItems: 'center', justifyContent: 'center', marginTop: -28 },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default MobileFooterNav;
