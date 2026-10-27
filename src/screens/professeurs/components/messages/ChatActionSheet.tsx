import React, { useMemo } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FontAwesome5 } from "@expo/vector-icons";
import { useThemeColors } from "../../../../styles/theme";
import { useT } from "../../../../i18n";

type ThemeColors = ReturnType<typeof useThemeColors>;

export interface ChatAction {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof FontAwesome5>["name"];
  destructive?: boolean;
  onPress: () => void;
}

/** Bottom sheet menu (Android's Alert only shows three buttons). */
const ChatActionSheet = ({
  title,
  actions,
  onClose,
}: {
  title?: string;
  actions: ChatAction[];
  onClose: () => void;
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { t } = useT();
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}
          onStartShouldSetResponder={() => true}
        >
          {title ? (
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
          ) : null}
          {actions.map((a) => (
            <TouchableOpacity
              key={a.key}
              style={styles.item}
              onPress={() => {
                onClose();
                a.onPress();
              }}
            >
              <FontAwesome5 name={a.icon} size={16} color={a.destructive ? colors.danger : colors.textMuted} style={styles.icon} />
              <Text style={[styles.label, a.destructive && { color: colors.danger }]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.item, styles.cancel]} onPress={onClose}>
            <Text style={[styles.label, styles.cancelText]}>{t("common.cancel")}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 8 },
    title: { fontSize: 13, color: c.textMuted, paddingHorizontal: 20, paddingVertical: 10, textAlign: "center" },
    item: { flexDirection: "row", alignItems: "center", paddingHorizontal: 22, paddingVertical: 15 },
    icon: { width: 26 },
    label: { fontSize: 15, color: c.text, fontWeight: "500" },
    cancel: { justifyContent: "center", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, marginTop: 4 },
    cancelText: { fontWeight: "700", color: c.textMuted },
  });

export default ChatActionSheet;
