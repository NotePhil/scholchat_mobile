import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useThemeStore } from "../../../../store/useThemeStore";
import { ClassEntity } from "../../../../types";

export type AccessRequestRole = "eleve" | "parent";

interface AccessRequestModalProps {
  visible: boolean;
  /** Class resolved from GET /classes/by-code/{token}. */
  foundClass: ClassEntity | null;
  requestRole: AccessRequestRole;
  setRequestRole: (role: AccessRequestRole) => void;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}

const ROLE_OPTIONS: { value: AccessRequestRole; label: string; icon: string }[] = [
  { value: "eleve", label: "Élève", icon: "user-graduate" },
  { value: "parent", label: "Parent", icon: "user-friends" },
];

/**
 * "Demande d'Accès" dialog — port of the Access Request Modal in
 * scholchat_front's ClassesContent.jsx: shows the class found for the typed
 * token (name, professeur, établissement), a "Demande en tant que" choice and
 * Annuler / Envoyer la Demande.
 */
const AccessRequestModal = ({
  visible,
  foundClass,
  requestRole,
  setRequestRole,
  submitting,
  onCancel,
  onSubmit,
}: AccessRequestModalProps) => {
  const isDark = useThemeStore((s) => s.mode === "dark");
  const styles = useMemo(() => createStyles(isDark), [isDark]);
  const profName = foundClass?.professeur
    ? `${foundClass.professeur.prenom || ""} ${foundClass.professeur.nom || ""}`.trim()
    : foundClass?.moderator
      ? `${foundClass.moderator.prenom || ""} ${foundClass.moderator.nom || ""}`.trim()
      : "";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.header}>
            <Text style={styles.title}>Demande d'Accès</Text>
            <TouchableOpacity onPress={onCancel} style={styles.closeBtn} accessibilityLabel="Fermer">
              <FontAwesome5 name="times-circle" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <Text style={styles.lead}>
              Vous demandez l'accès à : <Text style={styles.leadStrong}>{foundClass?.nom || "—"}</Text>
            </Text>
            <View style={styles.metaRow}>
              <FontAwesome5 name="users" size={13} color="#6B7280" />
              <Text style={styles.metaText}>{profName || "Professeur non spécifié"}</Text>
            </View>
            {foundClass?.etablissement?.nom ? (
              <View style={styles.metaRow}>
                <FontAwesome5 name="building" size={13} color="#6B7280" />
                <Text style={styles.metaText}>{foundClass.etablissement.nom}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>Demande en tant que</Text>
            <View style={styles.segment}>
              {ROLE_OPTIONS.map((opt) => {
                const active = requestRole === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                    onPress={() => setRequestRole(opt.value)}
                    activeOpacity={0.85}
                  >
                    <FontAwesome5 name={opt.icon as any} size={13} color={active ? "#FFFFFF" : isDark ? "#CBD5E1" : "#374151"} />
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={submitting}>
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={onSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
              <Text style={styles.submitText}>Envoyer la Demande</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (isDark: boolean) => {
  const card = isDark ? "#1E293B" : "#FFFFFF";
  const text = isDark ? "#F8FAFC" : "#111827";
  const body = isDark ? "#CBD5E1" : "#374151";
  const sub = isDark ? "#94A3B8" : "#6B7280";
  const border = isDark ? "#334155" : "#E5E7EB";

  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      padding: 16,
    },
    dialog: { backgroundColor: card, borderRadius: 12, padding: 24, maxHeight: "90%" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
    title: { fontSize: 20, fontWeight: "800", color: text, flex: 1 },
    closeBtn: { padding: 4 },
    body: { marginBottom: 8 },
    lead: { fontSize: 15, color: body },
    leadStrong: { fontWeight: "800", color: text },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
    metaText: { fontSize: 13, color: sub, flex: 1 },
    label: { fontSize: 14, fontWeight: "600", color: body, marginTop: 20, marginBottom: 6 },
    segment: { flexDirection: "row", gap: 8 },
    segmentBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: border,
    },
    segmentBtnActive: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
    segmentText: { fontSize: 14, fontWeight: "600", color: body },
    segmentTextActive: { color: "#FFFFFF" },
    footer: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 24, flexWrap: "wrap" },
    cancelBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: border,
    },
    cancelText: { fontSize: 14, color: body, fontWeight: "500" },
    submitBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: "#2563EB",
    },
    submitText: { fontSize: 14, color: "#FFFFFF", fontWeight: "600" },
  });
};

export default AccessRequestModal;
