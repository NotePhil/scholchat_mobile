import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { colors, spacing, typography } from "../../styles/theme";
import { useSelectedChildStore } from "../../store/useSelectedChildStore";

/** Shared child-switcher chip row — every parent screen renders the same one, backed by the same store. */
const ChildSelectorRow = () => {
  const { children, selectedChildId, setSelectedChildId } = useSelectedChildStore();

  if (children.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
      {children.map((child) => (
        <TouchableOpacity
          key={child.id}
          style={[styles.chip, selectedChildId === child.id && styles.chipActive]}
          onPress={() => setSelectedChildId(child.id)}
        >
          <Text style={[styles.chipText, selectedChildId === child.id && styles.chipTextActive]}>
            {child.prenom} {child.nom}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, marginBottom: spacing.md, flexGrow: 0 },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20, backgroundColor: colors.grayLight, marginRight: spacing.sm },
  chipActive: { backgroundColor: colors.primary },
  chipText: { ...typography.caption, color: colors.text, fontWeight: "600" },
  chipTextActive: { color: colors.white },
});

export default ChildSelectorRow;
