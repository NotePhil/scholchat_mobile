import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useThemeColors } from "../../../../styles/theme";

type ThemeColors = ReturnType<typeof useThemeColors>;

export type AttachmentType = "link" | "media" | "document";

interface AttachmentModalProps {
  onClose: () => void;
  onAttach: (type: AttachmentType) => void;
  /** Offer "Lien" (appended to the text). Defaults to false. */
  allowLink?: boolean;
}

const OPTIONS: { type: AttachmentType; icon: React.ComponentProps<typeof FontAwesome5>["name"]; label: string }[] = [
  { type: "media", icon: "image", label: "Photo ou vidéo" },
  { type: "document", icon: "file-pdf", label: "Document / PDF" },
  { type: "link", icon: "link", label: "Lien" },
];

const AttachmentModal = ({ onClose, onAttach, allowLink = false }: AttachmentModalProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>Joindre</Text>
          {OPTIONS.filter((o) => allowLink || o.type !== "link").map((opt) => (
            <TouchableOpacity key={opt.type} style={styles.attachmentOption} onPress={() => onAttach(opt.type)}>
              <View style={styles.iconWrap}>
                <FontAwesome5 name={opt.icon} size={16} color={colors.primary} />
              </View>
              <Text style={styles.attachmentText}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)", justifyContent: "center", alignItems: "center" },
    modalContent: { backgroundColor: c.surface, borderRadius: 16, padding: 20, width: "80%" },
    title: { fontSize: 16, fontWeight: "700", color: c.text, marginBottom: 8 },
    attachmentOption: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    iconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: c.primaryLight, alignItems: "center", justifyContent: "center" },
    attachmentText: { marginLeft: 12, fontSize: 15, color: c.text },
    cancelButton: { marginTop: 12, alignItems: "center", paddingVertical: 8 },
    cancelButtonText: { fontSize: 15, color: c.textMuted, fontWeight: "600" },
  });

export default AttachmentModal;
