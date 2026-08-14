import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Badge, EmptyState, Input, LoadingSpinner } from "../../../components/ui";
import PromptSheet from "../../../components/common/PromptSheet";
import { colors, spacing, typography } from "../../../styles/theme";
import {
  accederService,
  gestionnaireService,
  parentService,
  professorService,
  studentService,
  userService,
} from "../../../services/api";
import { ClassEntity } from "../../../types";

type RoleTab = "admins" | "professeurs" | "parents" | "eleves" | "gestionnaires" | "pending";

const TABS: { id: RoleTab; label: string }[] = [
  { id: "admins", label: "Admins" },
  { id: "professeurs", label: "Professeurs" },
  { id: "parents", label: "Parents" },
  { id: "eleves", label: "Élèves" },
  { id: "gestionnaires", label: "Gestionnaires" },
  { id: "pending", label: "En attente" },
];

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actif",
  ACTIF: "Actif",
  INACTIVE: "Inactif",
  INACTIF: "Inactif",
  PENDING: "En attente",
  AWAITING_VALIDATION: "En attente",
};

interface Row {
  id: string;
  name: string;
  email: string;
  telephone?: string;
  adresse?: string;
  etat?: string;
  classes?: ClassEntity[];
}

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const toRow = (raw: Record<string, any>): Row => ({
  id: raw.id,
  name: `${raw.prenom ?? ""} ${raw.nom ?? ""}`.trim() || raw.username || "Sans nom",
  email: raw.email ?? "",
  telephone: raw.telephone,
  adresse: raw.adresse,
  etat: raw.etat,
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
      const baseRows = data.map(toRow);
      setRows(baseRows);

      // Classes are fetched separately (and non-blocking) so the list still
      // renders immediately even if this secondary lookup is slow/fails.
      // Shown for every role tab (Admins/Gestionnaires will usually come back
      // empty, which is real data, not a bug — they aren't normally tied to a class).
      if (activeTab !== "pending") {
        Promise.all(
          baseRows.map(async (row) => {
            try {
              return { id: row.id, classes: await accederService.getAccessibleClasses(row.id) };
            } catch {
              return { id: row.id, classes: [] as ClassEntity[] };
            }
          })
        ).then((results) => {
          const byId = new Map(results.map((r) => [r.id, r.classes]));
          setRows((prev) => prev.map((r) => ({ ...r, classes: byId.get(r.id) ?? [] })));
        });
      }
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

  const showClasses = activeTab !== "pending";

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
            <View key={row.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitials(row.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{row.name}</Text>
                  {row.etat ? (
                    <Badge
                      label={STATUS_LABELS[row.etat.toUpperCase()] ?? row.etat}
                      tone={row.etat.toUpperCase().includes("ACTI") ? "success" : "warning"}
                    />
                  ) : null}
                </View>
                <View style={styles.cardActionsInline}>
                  {activeTab === "pending" ? (
                    <>
                      <TouchableOpacity onPress={() => handleValidate(row)} style={styles.iconButton}>
                        <FontAwesome5 name="check" size={16} color={colors.success} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleReject(row)} style={styles.iconButton}>
                        <FontAwesome5 name="times" size={16} color={colors.danger} />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity onPress={() => handleDelete(row)} style={styles.iconButton}>
                      <FontAwesome5 name="trash" size={16} color={colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {row.email ? (
                <View style={styles.infoRow}>
                  <FontAwesome5 name="envelope" size={12} color={colors.textMuted} />
                  <Text style={styles.infoText}>{row.email}</Text>
                </View>
              ) : null}
              {row.telephone ? (
                <View style={styles.infoRow}>
                  <FontAwesome5 name="phone" size={12} color={colors.textMuted} />
                  <Text style={styles.infoText}>{row.telephone}</Text>
                </View>
              ) : null}
              {row.adresse ? (
                <View style={styles.infoRow}>
                  <FontAwesome5 name="map-marker-alt" size={12} color={colors.textMuted} />
                  <Text style={styles.infoText}>{row.adresse}</Text>
                </View>
              ) : null}

              {showClasses && (
                <View style={styles.classesSection}>
                  <Text style={styles.classesLabel}>Classes</Text>
                  {row.classes === undefined ? (
                    <Text style={styles.classesValue}>Chargement...</Text>
                  ) : row.classes.length === 0 ? (
                    <Text style={styles.classesValue}>Aucune</Text>
                  ) : (
                    <View style={styles.classChipsRow}>
                      {row.classes.map((cls) => (
                        <View key={cls.id} style={styles.classChip}>
                          <Text style={styles.classChipText}>{cls.nom}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
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
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginTop: spacing.md },
  cardTop: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm, gap: spacing.sm },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.white, fontWeight: "700", fontSize: 13 },
  name: { ...typography.bodyBold, color: colors.text, marginBottom: 4 },
  cardActionsInline: { flexDirection: "row", gap: spacing.xs },
  iconButton: { padding: spacing.sm },
  infoRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: 4 },
  infoText: { ...typography.caption, color: colors.textMuted },
  classesSection: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  classesLabel: { ...typography.caption, color: colors.textMuted, fontWeight: "700", textTransform: "uppercase", marginBottom: 4 },
  classesValue: { ...typography.caption, color: colors.textMuted, fontStyle: "italic" },
  classChipsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  classChip: { backgroundColor: colors.grayLight, borderRadius: 12, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  classChipText: { ...typography.caption, color: colors.text, fontWeight: "600" },
});

export default AdminUsersBody;
