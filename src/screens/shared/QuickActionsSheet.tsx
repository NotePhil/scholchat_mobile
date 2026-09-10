import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { BottomSheet, Button } from '../../components/ui';
import { colors, spacing, typography, useThemeColors } from '../../styles/theme';
import { confirmLogout } from '../../utils/confirmLogout';

export interface QuickAction {
  icon: React.ComponentProps<typeof FontAwesome5>['name'];
  label: string;
  color: string;
  /** Navigates to this tab when tapped. Omit if this item opens a submenu instead. */
  tab?: string;
  /** Opens the named submenu (a key into `submenus`) instead of navigating. */
  submenu?: string;
}

interface QuickActionsSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectTab: (tab: string) => void;
  onLogout: () => void;
  /** Top-level grid, in the same order as the web sidebar for this role. */
  items: QuickAction[];
  /** Named second-level grids (e.g. "classes" -> Créer/Gérer), reached via an item's `submenu` key. */
  submenus?: Record<string, QuickAction[]>;
  accentColor?: string;
}

/**
 * "Accès Rapide" grid — mirrors scholchat_front's MobileBottomNav.jsx
 * quick-actions overlay: a grid of every item from that role's sidebar menu,
 * with grouped items (Classes, Établissements, Cours, Utilisateurs) drilling
 * into a second-level grid via a "Retour" back button, exactly like web.
 */
const QuickActionsSheet = ({ visible, onClose, onSelectTab, onLogout, items, submenus = {}, accentColor = colors.primary }: QuickActionsSheetProps) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const [submenuKey, setSubmenuKey] = useState<string | null>(null);

  useEffect(() => {
    if (visible) setSubmenuKey(null);
  }, [visible]);

  const activeItems: QuickAction[] = submenuKey ? submenus[submenuKey] ?? [] : items;

  const handlePress = (item: QuickAction) => {
    if (item.submenu) {
      setSubmenuKey(item.submenu);
      return;
    }
    if (item.tab) {
      onSelectTab(item.tab);
      onClose();
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Accès Rapide">
      <View style={styles.grid}>
        {activeItems.map((item, index) => (
          <TouchableOpacity key={`${item.label}-${index}`} style={styles.cell} onPress={() => handlePress(item)}>
            <View style={[styles.iconChip, { backgroundColor: item.color }]}>
              <FontAwesome5 name={item.icon} size={16} color={themeColors.white} />
            </View>
            <Text style={styles.cellLabel} numberOfLines={1}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
        {submenuKey ? (
          <TouchableOpacity style={styles.cell} onPress={() => setSubmenuKey(null)}>
            <View style={[styles.iconChip, { backgroundColor: themeColors.gray }]}>
              <FontAwesome5 name="arrow-left" size={16} color={themeColors.white} />
            </View>
            <Text style={styles.cellLabel}>Retour</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {!submenuKey && (
        <Button label="Déconnexion" variant="danger" onPress={() => confirmLogout(onLogout)} fullWidth style={{ marginTop: spacing.md, marginBottom: spacing.lg }} />
      )}
    </BottomSheet>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  cell: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 16,
    backgroundColor: colors.background,
  },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  cellLabel: { ...typography.caption, color: colors.text, fontWeight: '700', textAlign: 'center' },
});

export default QuickActionsSheet;
