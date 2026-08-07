import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Button, EmptyState, Input, LoadingSpinner, ListItem } from "../../../components/ui";
import PromptSheet from "../../../components/common/PromptSheet";
import { colors, spacing, typography } from "../../../styles/theme";
import {
  gestionnaireService,
  parentService,
  professorService,
  studentService,
  userService,
} from "../../../services/api";

type RoleTab = "admins" | "professeurs" | "parents" | "eleves" | "gestionnaires" | "pending";

const TABS: { id: RoleTab; label: string }[] = [
  { id: "admins", label: "Admins" },
  { id: "professeurs", label: "Professeurs" },
  { id: "parents", label: "Parents" },
  { id: "eleves", label: "Élèves" },
  { id: "gestionnaires", label: "Gestionnaires" },
  { id: "pending", label: "En attente" },
];

interface Row {
  id: string;
  name: string;
  email: string;
  extra?: string;
}

const toRow = (raw: Record<string, any>): Row => ({
  id: raw.id,
  name: `${raw.prenom ?? ""} ${raw.nom ?? ""}`.trim() || raw.username || "Sans nom",
  email: raw.email ?? "",
  extra: raw.etat,
});

const AdminUsersBody = () => {
  const [activeTab, setActiveTab] = useState<RoleTab>("professeurs");
  const [searchTerm, setSearchTerm] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rejectingRow, setRejectingRow] = useState<Row | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let data: Record<string, any>[] = [];
      if (activeTab === "admins") data = await userService.getAdmins();
      else if (activeTab === "professeurs") data = await professorService.getAll();
      else if (activeTab === "parents") data = await parentService.getAllSummary();
      else if (activeTab === "eleves") data = await studentService.getAll();
      else if (activeTab === "gestionnaires") data = await gestionnaireService.getAll();
      else if (activeTab === "pending") {
        const result = await userService.getPendingProfessors();
        data = Array.isArray(result) ? result : (result as any)?.content ?? [];
      }
      setRows(data.map(toRow));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du chargement.");
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRows = rows.filter(
    (r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleValidate = async (row: Row) => {
    try {
      await userService.validateProfessor(row.id);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la validation.");
    }
  };

  const handleReject = (row: Row) => {
    setRejectingRow(row);
  };

  const handleConfirmReject = async (motif: string) => {
    if (!rejectingRow) return;
    try {
      await userService.rejectProfessor(rejectingRow.id, "MANUAL_REJECTION", motif);
      setRows((prev) => prev.filter((r) => r.id !== rejectingRow.id));
      setRejectingRow(null);
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec du rejet.");
    }
  };

  const handleDelete = (row: Row) => {
    Alert.alert("Supprimer", `Voulez-vous vraiment supprimer ${row.name} ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            if (activeTab === "professeurs") await professorService.remove(row.id);
            else if (activeTab === "parents") await parentService.remove(row.id);
            else if (activeTab === "eleves") await studentService.remove(row.id);
            else await userService.deleteUser(row.id);
            setRows((prev) => prev.filter((r) => r.id !== row.id));
          } catch (err) {
            Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la suppression.");
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gestion des utilisateurs</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.searchWrap}>
        <Input placeholder="Rechercher..." value={searchTerm} onChangeText={setSearchTerm} />
      </View>

      <ScrollView style={styles.list}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? (
          <LoadingSpinner label="Chargement..." />
        ) : filteredRows.length === 0 ? (
          <EmptyState icon="users" title="Aucun résultat" message="Aucun utilisateur dans cette catégorie." />
        ) : (
          filteredRows.map((row) => (
            <ListItem
              key={row.id}
              title={row.name}
              subtitle={row.email}
              showChevron={false}
              trailing={
                activeTab === "pending" ? (
                  <View style={styles.pendingActions}>
                    <TouchableOpacity onPress={() => handleValidate(row)} style={styles.iconButton}>
                      <FontAwesome5 name="check" size={16} color={colors.success} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleReject(row)} style={styles.iconButton}>
                      <FontAwesome5 name="times" size={16} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => handleDelete(row)} style={styles.iconButton}>
                    <FontAwesome5 name="trash" size={16} color={colors.danger} />
                  </TouchableOpacity>
                )
              }
            />
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <PromptSheet
        visible={!!rejectingRow}
        title="Motif du rejet"
        message={rejectingRow ? `Pourquoi rejeter ${rejectingRow.name} ?` : undefined}
        placeholder="Motif"
        submitLabel="Rejeter"
        onCancel={() => setRejectingRow(null)}
        onSubmit={handleConfirmReject}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, marginTop: 20, marginBottom: spacing.md },
  title: { ...typography.h1, color: colors.text },
  tabsScroll: { paddingHorizontal: 16, marginBottom: spacing.md, flexGrow: 0 },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.grayLight,
    marginRight: spacing.sm,
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: { ...typography.caption, color: colors.text, fontWeight: "600" },
  tabTextActive: { color: colors.white },
  searchWrap: { paddingHorizontal: 16 },
  list: { flex: 1, paddingHorizontal: 16 },
  error: { color: colors.danger, marginBottom: spacing.md },
  pendingActions: { flexDirection: "row", gap: spacing.sm },
  iconButton: { padding: spacing.sm },
});

export default AdminUsersBody;
