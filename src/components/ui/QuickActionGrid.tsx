import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { radius, spacing, typography, useThemeColors } from '../../styles/theme';
import type { QuickAction } from '../../screens/shared/QuickActionsSheet';

interface QuickActionGridProps {
  items: QuickAction[];
  onSelect: (item: QuickAction) => void;
}

/**
 * Always-visible, 4-column icon-tile preview of a role's quick actions —
 * sits directly on the home screen (unlike QuickActionsSheet, which is the
 * exhaustive/grouped list reached via the center FAB). Softer, tinted icon
 * backgrounds instead of solid fill, closer to a consumer home-screen grid.
 */
const QuickActionGrid = ({ items, onSelect }: QuickActionGridProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.grid}>
      {items.map((item, index) => (
        <TouchableOpacity key={`${item.label}-${index}`} style={styles.cell} onPress={() => onSelect(item)} activeOpacity={0.7}>
          <View style={[styles.iconTile, { backgroundColor: `${item.color}18` }]}>
            <FontAwesome5 name={item.icon} size={17} color={item.color} />
          </View>
          <Text style={styles.label} numberOfLines={1}>
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '25%', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.xs },
  iconTile: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...typography.caption, color: colors.text, fontWeight: '600', textAlign: 'center', fontSize: 11 },
});

export default QuickActionGrid;
