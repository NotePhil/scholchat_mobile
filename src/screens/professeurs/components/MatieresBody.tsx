import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { BottomSheet, Button, EmptyState, Input, LoadingSpinner } from "../../../components/ui";
import { colors, radius, spacing, typography } from "../../../styles/theme";
import { matiereService } from "../../../services/api";
import { useAuthStore } from "../../../store/useAuthStore";
import { Matiere } from "../../../types";

const formatDate = (dateString?: string) => {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleDateString("fr-FR", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "N/A";
  }
};

/**
 * Matches web's MatiereContent.jsx exactly: Admin + Gestionnaire can
 * create/edit/delete, Professor (view-only via "canView"), everyone else
 * (Parent/Student/Établissement) has no access at all — the web sidebar
 * never even links here for those roles.
 */
const MatieresBody = () => {
  const role = useAuthStore((state) => state.role);
  const canManage = role === "admin" || role === "gestionnaire";
  const canView = canManage || role === "professor" || role === "tutor";

  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Matiere | null>(null);
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await matiereService.getAll();
      setMatieres(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du chargement des matières.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canView) load();
    else setLoading(false);
  }, [canView, load]);

  const filtered = matieres.filter(
    (m) =>
      (m.nom ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.description ?? "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setNom("");
    setDescription("");
    setEditing(null);
  };

  const closeSheets = () => {
    setShowCreate(false);
    resetForm();
  };

  const openCreate = () => {
    resetForm();
    setShowCreate(true);
  };

  const openEdit = (matiere: Matiere) => {
    setEditing(matiere);
    setNom(matiere.nom ?? "");
    setDescription(matiere.description ?? "");
  };

  const handleCreate = async () => {
    if (!nom.trim()) {
      Alert.alert("Erreur", "Le nom de la matière est requis.");
      return;
    }
    setSubmitting(true);
    try {
      await matiereService.create(nom.trim(), description.trim() || undefined);
      closeSheets();
      await load();
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la création.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    if (!nom.trim()) {
      Alert.alert("Erreur", "Le nom de la matière est requis.");
      return;
    }
    setSubmitting(true);
    try {
      await matiereService.update(editing.id, nom.trim(), description.trim() || undefined);
      resetForm();
      await load();
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la modification.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (matiere: Matiere) => {
    Alert.alert("Supprimer", `Supprimer la matière "${matiere.nom}" ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await matiereService.remove(matiere.id);
            setMatieres((prev) => prev.filter((m) => m.id !== matiere.id));
          } catch (err) {
            Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la suppression.");
          }
        },
      },
    ]);
  };

  if (!canView) {
    return (
      <View style={styles.restrictedContainer}>
        <FontAwesome5 name="exclamation-circle" size={48} color={colors.danger} />
        <Text style={styles.restrictedTitle}>Accès Restreint</Text>
        <Text style={styles.restrictedText}>
          Vous n'avez pas les permissions nécessaires pour accéder à cette section.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Matières</Text>
        {canManage && (
          <TouchableOpacity onPress={openCreate} style={styles.addButton}>
            <FontAwesome5 name="plus" size={14} color={colors.white} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.searchWrap}>
        <Input placeholder="Rechercher une matière..." value={searchTerm} onChangeText={setSearchTerm} />
      </View>

      <ScrollView style={styles.list}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? (
          <LoadingSpinner label="Chargement..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="book"
            title={searchTerm ? "Aucun résultat" : "Aucune matière"}
            actionLabel={canManage ? "Ajouter une matière" : undefined}
            onAction={canManage ? openCreate : undefined}
          />
        ) : (
          filtered.map((m) => (
            <View key={m.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {m.nom}
                  </Text>
                  {m.description ? (
                    <Text style={styles.cardDesc} numberOfLines={2}>
                      {m.description}
                    </Text>
                  ) : null}
                </View>
                <View style={[styles.badge, m.etat === "INACTIF" ? styles.badgeDanger : styles.badgeSuccess]}>
                  <Text style={[styles.badgeText, m.etat === "INACTIF" ? styles.badgeTextDanger : styles.badgeTextSuccess]}>
                    {m.etat ?? "ACTIF"}
                  </Text>
                </View>
              </View>
              <View style={styles.cardBottom}>
                <View style={styles.dateRow}>
                  <FontAwesome5 name="calendar-alt" size={11} color={colors.textMuted} />
                  <Text style={styles.dateText}>{formatDate(m.dateCreation)}</Text>
                </View>
                {canManage && (
                  <View style={styles.actionsRow}>
                    <TouchableOpacity onPress={() => openEdit(m)} style={styles.iconButton}>
                      <FontAwesome5 name="edit" size={15} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(m)} style={styles.iconButton}>
                      <FontAwesome5 name="trash" size={15} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomSheet visible={showCreate} onClose={closeSheets} title="Nouvelle matière">
        <Input label="Nom" value={nom} onChangeText={setNom} placeholder="Ex: Mathématiques" />
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Description de la matière..."
          multiline
          numberOfLines={3}
          style={{ height: 80, textAlignVertical: "top" }}
        />
        <Button label="Créer" onPress={handleCreate} loading={submitting} fullWidth style={{ marginTop: spacing.md, marginBottom: spacing.lg }} />
      </BottomSheet>

      <BottomSheet visible={!!editing} onClose={resetForm} title="Modifier la matière">
        <Input label="Nom" value={nom} onChangeText={setNom} placeholder="Ex: Mathématiques" />
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Description de la matière..."
          multiline
          numberOfLines={3}
          style={{ height: 80, textAlignVertical: "top" }}
        />
        <Button label="Enregistrer" onPress={handleUpdate} loading={submitting} fullWidth style={{ marginTop: spacing.md, marginBottom: spacing.lg }} />
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: spacing.md,
  },
  title: { ...typography.h1, color: colors.text },
  addButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  searchWrap: { paddingHorizontal: 16, marginBottom: spacing.sm },
  list: { flex: 1, paddingHorizontal: 16 },
  error: { color: colors.danger, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardBody: { flex: 1, marginRight: spacing.sm },
  cardTitle: { ...typography.bodyBold, color: colors.text, fontSize: 15 },
  cardDesc: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  badgeSuccess: { backgroundColor: colors.successLight },
  badgeDanger: { backgroundColor: colors.dangerLight },
  badgeText: { fontSize: 11, fontWeight: "600" },
  badgeTextSuccess: { color: colors.success },
  badgeTextDanger: { color: colors.danger },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  dateText: { ...typography.caption, color: colors.textMuted },
  actionsRow: { flexDirection: "row", gap: spacing.md },
  iconButton: { padding: 4 },
  restrictedContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  restrictedTitle: { ...typography.h2, color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs },
  restrictedText: { ...typography.body, color: colors.textMuted, textAlign: "center" },
});

export default MatieresBody;
