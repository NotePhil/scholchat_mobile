import React, { useEffect, useMemo, useState } from 'react';
import { Keyboard, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, useThemeColors } from '../../styles/theme';
import { useMessagesStore } from '../../store/useMessagesStore';
import { useT } from '../../i18n';

interface MobileFooterNavProps {
  activeTab: string;
  onTabPress: (tab: string) => void;
  onOpenQuickActions: () => void;
  quickActionsOpen: boolean;
  accentColor?: string;
  /** Parent in limited mode (no approved child yet): only "Mes enfants" and the profile. */
  parentLimited?: boolean;
}

/**
 * Fixed 5-slot bottom bar — mirrors scholchat_front's MobileBottomNav.jsx
 * exactly: Home / Messages / center "+" FAB (opens the role's quick-actions
 * grid) / Alerts (activities) / Profile (settings). Every role gets this
 * same shape; what differs per role is only the QuickActionsSheet content.
 * Reads the live unread-message count from useMessagesStore so every
 * dashboard gets the badge for free.
 */
const MobileFooterNav = ({
  activeTab,
  onTabPress,
  onOpenQuickActions,
  quickActionsOpen,
  accentColor = colors.primary,
  parentLimited = false,
}: MobileFooterNavProps) => {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const unreadCount = useMessagesStore((s) => s.unreadCount);
  const { t } = useT();
  // Android: hide the bar while the keyboard is open, otherwise the app-wide
  // KeyboardInsetView would lift it up on top of the keyboard.
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  // Kept live app-wide by useMessagesRealtime (AppHeader) over the shared STOMP socket — no polling here.

  const items: { icon: React.ComponentProps<typeof FontAwesome5>['name']; label: string; tab: string; badgeCount?: number }[] = [
    { icon: 'home', label: t('nav.home'), tab: 'dashboard' },
    { icon: 'envelope', label: t('nav.messages'), tab: 'messages', badgeCount: unreadCount },
  ];
  const trailingItems: { icon: React.ComponentProps<typeof FontAwesome5>['name']; label: string; tab: string }[] = [
    { icon: 'heartbeat', label: t('nav.activities'), tab: 'activities' },
    { icon: 'user', label: t('nav.profile'), tab: 'settings' },
  ];

  const renderItem = (item: { icon: React.ComponentProps<typeof FontAwesome5>['name']; label: string; tab: string; badgeCount?: number }) => {
    const active = activeTab === item.tab;
    return (
      <TouchableOpacity
        key={item.tab}
        style={[styles.navItem, active && styles.navItemActive]}
        onPress={() => onTabPress(item.tab)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconWrap, active && { backgroundColor: `${accentColor}18` }]}>
          <FontAwesome5 name={item.icon} size={18} color={active ? accentColor : colors.gray} solid={active} />
          {item.badgeCount ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.badgeCount > 9 ? '9+' : item.badgeCount}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.label, { color: active ? accentColor : colors.gray }]}>{item.label}</Text>
      </TouchableOpacity>
    );
  };

  if (keyboardOpen) return null;

  if (parentLimited) {
    return (
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12), paddingTop: 8 }]}>
        {renderItem({ icon: 'child', label: t('header.myChildren'), tab: 'children' })}
        {renderItem({ icon: 'user', label: t('nav.profile'), tab: 'settings' })}
      </View>
    );
  }

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {items.map(renderItem)}

      <View style={styles.centerSlot}>
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: accentColor }]}
          onPress={onOpenQuickActions}
          accessibilityRole="button"
          accessibilityLabel={t('nav.quickActions')}
        >
          <FontAwesome5 name={quickActionsOpen ? 'times' : 'th-large'} size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      {trailingItems.map(renderItem)}
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
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
    paddingTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  navItem: { alignItems: 'center', justifyContent: 'center', minWidth: 54, gap: 2 },
  navItemActive: {},
  iconWrap: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  badge: {
    position: 'absolute',
    top: -2,
    right: 2,
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
  label: { fontSize: 10, fontWeight: '600' },
  centerSlot: { alignItems: 'center', justifyContent: 'center', marginTop: -26 },
  fab: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
});

export default MobileFooterNav;
