import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Badge, BottomSheet, Button, EmptyState, Input, LoadingSpinner } from "../../../components/ui";
import { colors, radius, shadow, spacing, typography, useThemeColors } from "../../../styles/theme";
import { matiereService } from "../../../services/api";
import { useAuthStore } from "../../../store/useAuthStore";
import { Matiere } from "../../../types";

// LinearGradient with safe fallback
let LinearGradient: any;
try {
  LinearGradient = require("expo-linear-gradient").LinearGradient;
} catch {
  LinearGradient = ({ children, style }: any) => <View style={style}>{children}</View>;
}

const MATIERE_GRADIENT = ["#8B5CF6", "#6D28D9"];

const formatDate = (dateString?: string) => {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleDateString("fr-FR", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "N/A";
  }
};

interface ActionChipProps {
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
}

const ActionChip = ({ icon, label, color, onPress }: ActionChipProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.actionChip, { borderColor: color + "30", backgroundColor: color + "0D" }]}
    activeOpacity={0.7}
  >
    <FontAwesome5 name={icon as any} size={11} color={color} />
    <Text style={[styles.actionChipText, { color }]}>{label}</Text>
  </TouchableOpacity>
  );
};

/**
 * Matches web's MatiereContent.jsx exactly: Admin + Gestionnaire can
 * create/edit/delete, Professor (view-only via "canView"), everyone else
 * (Parent/Student/Établissement) has no access at all.
 */
const MatieresBody = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const role = useAuthStore((state) => state.role);
  const canManage = role === "admin" || role === "gestionnaire";
  const canView = canManage || role === "professor" || role === "tutor";

  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIF" | "INACTIF">("ALL");
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

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = matieres.filter((m) => {
    const matchesSearch =
      (m.nom ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.description ?? "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIF" ? m.etat?.toUpperCase() !== "INACTIF" : m.etat?.toUpperCase() === "INACTIF");
    return matchesSearch && matchesStatus;
  });

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
        <View style={styles.restrictedIconBox}>
          <FontAwesome5 name="lock" size={32} color={colors.danger} />
        </View>
        <Text style={styles.restrictedTitle}>Accès Restreint</Text>
        <Text style={styles.restrictedText}>
          Vous n'avez pas les permissions nécessaires pour accéder à cette section.
        </Text>
      </View>
    );
  }

  const activeCount = matieres.filter((m) => m.etat?.toUpperCase() !== "INACTIF").length;

  return (
    <View style={styles.container}>
      {/* Hero Header */}
      <LinearGradient
        colors={[colors.heroStart, colors.heroMid]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.pageHeader}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.pageTitle}>Matières</Text>
            <View style={styles.headerMetaRow}>
              <View style={styles.countBadge}>
                <FontAwesome5 name="book-open" size={10} color={colors.white} />
                <Text style={styles.countBadgeText}>{matieres.length} au total</Text>
              </View>
              <View style={[styles.countBadge, { backgroundColor: "rgba(16, 185, 129, 0.25)" }]}>
                <View style={styles.activeDot} />
                <Text style={styles.countBadgeText}>{activeCount} actives</Text>
              </View>
            </View>
          </View>
          {canManage && (
            <TouchableOpacity onPress={openCreate} style={styles.addButton} activeOpacity={0.85}>
              <LinearGradient
                colors={MATIERE_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.addButtonGradient}
              >
                <FontAwesome5 name="plus" size={13} color={colors.white} />
                <Text style={styles.addButtonText}>Nouvelle</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* Search & Filter Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <FontAwesome5 name="search" size={13} color={colors.textMuted} />
          <Input
            placeholder="Rechercher une matière..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            style={styles.searchInput}
          />
          {searchTerm ? (
            <TouchableOpacity onPress={() => setSearchTerm("")} style={styles.clearBtn}>
              <FontAwesome5 name="times-circle" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.filterPillsRow}>
          {(
            [
              { key: "ALL", label: "Toutes", count: matieres.length },
              { key: "ACTIF", label: "Actives", count: activeCount },
              { key: "INACTIF", label: "Inactives", count: matieres.length - activeCount },
            ] as const
          ).map((filter) => {
            const isSelected = statusFilter === filter.key;
            return (
              <TouchableOpacity
                key={filter.key}
                onPress={() => setStatusFilter(filter.key)}
                style={[styles.filterPill, isSelected && styles.filterPillActive]}
              >
                <Text style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}>
                  {filter.label} ({filter.count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        {error ? (
          <View style={styles.errorBox}>
            <FontAwesome5 name="exclamation-triangle" size={14} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <LoadingSpinner label="Chargement des matières..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="book"
            title={searchTerm ? "Aucun résultat" : "Aucune matière trouvée"}
            actionLabel={canManage ? "Ajouter une matière" : undefined}
            onAction={canManage ? openCreate : undefined}
          />
        ) : (
          filtered.map((m) => {
            const isInactive = m.etat?.toUpperCase() === "INACTIF";
            return (
              <View key={m.id} style={styles.card}>
                {/* Top Accent Strip */}
                <LinearGradient
                  colors={isInactive ? [colors.border, colors.borderLight] : MATIERE_GRADIENT}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.cardTopAccent}
                />

                <View style={styles.cardMain}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.iconWrapper}>
                      <FontAwesome5
                        name="book"
                        size={15}
                        color={isInactive ? colors.textMuted : colors.primary}
                      />
                    </View>
                    <View style={styles.cardBody}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {m.nom}
                      </Text>
                      {m.description ? (
                        <Text style={styles.cardDesc} numberOfLines={2}>
                          {m.description}
                        </Text>
                      ) : (
                        <Text style={styles.cardDescEmpty}>Aucune description fournie</Text>
                      )}
                    </View>
                    <Badge
                      label={isInactive ? "Inactif" : "Actif"}
                      tone={isInactive ? "neutral" : "success"}
                    />
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.dateRow}>
                      <FontAwesome5 name="calendar-alt" size={11} color={colors.textMuted} />
                      <Text style={styles.dateText}>Ajouté le {formatDate(m.dateCreation)}</Text>
                    </View>

                    {canManage && (
                      <View style={styles.cardActions}>
                        <ActionChip
                          icon="pen"
                          label="Modifier"
                          color={colors.primary}
                          onPress={() => openEdit(m)}
                        />
                        <ActionChip
                          icon="trash"
                          label="Supprimer"
                          color={colors.danger}
                          onPress={() => handleDelete(m)}
                        />
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Create Modal */}
      <BottomSheet visible={showCreate} onClose={closeSheets} title="Nouvelle matière">
        <View style={styles.modalContent}>
          <Input
            label="Nom de la matière"
            value={nom}
            onChangeText={setNom}
            placeholder="Ex: Mathématiques, Sciences..."
          />
          <Input
            label="Description (optionnelle)"
            value={description}
            onChangeText={setDescription}
            placeholder="Précisez les objectifs ou le programme..."
            multiline
            numberOfLines={3}
            style={{ height: 90, textAlignVertical: "top" }}
          />
          <Button
            label="Créer la matière"
            onPress={handleCreate}
            loading={submitting}
            fullWidth
            style={{ marginTop: spacing.md, marginBottom: spacing.lg }}
          />
        </View>
      </BottomSheet>

      {/* Edit Modal */}
      <BottomSheet visible={!!editing} onClose={resetForm} title="Modifier la matière">
        <View style={styles.modalContent}>
          <Input
            label="Nom de la matière"
            value={nom}
            onChangeText={setNom}
            placeholder="Ex: Mathématiques"
          />
          <Input
            label="Description (optionnelle)"
            value={description}
            onChangeText={setDescription}
            placeholder="Description de la matière..."
            multiline
            numberOfLines={3}
            style={{ height: 90, textAlignVertical: "top" }}
          />
          <Button
            label="Enregistrer les modifications"
            onPress={handleUpdate}
            loading={submitting}
            fullWidth
            style={{ marginTop: spacing.md, marginBottom: spacing.lg }}
          />
        </View>
      </BottomSheet>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  // Hero Header
  pageHeader: {
    // Fallback if LinearGradient ever fails — keeps the white header text
    // readable instead of white-on-white.
    backgroundColor: colors.heroStart,
    paddingTop: 52,
    paddingBottom: 20,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
    marginBottom: 12,
    ...shadow.hero,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: { flex: 1 },
  pageTitle: { fontSize: 26, fontWeight: "800", color: colors.white, letterSpacing: -0.5 },
  headerMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  countBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countBadgeText: { fontSize: 11, fontWeight: "700", color: colors.white },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#34D399" },
  addButton: { borderRadius: radius.full, overflow: "hidden", ...shadow.md },
  addButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addButtonText: { color: colors.white, fontWeight: "700", fontSize: 12 },

  // Search & Filters
  searchSection: { paddingHorizontal: 16, marginBottom: 12, gap: 10 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: 12,
    ...shadow.sm,
  },
  searchInput: { flex: 1, borderWidth: 0, shadowOpacity: 0, backgroundColor: "transparent" },
  clearBtn: { paddingRight: 12 },
  filterPillsRow: { flexDirection: "row", gap: 8 },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillText: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
  filterPillTextActive: { color: colors.white },

  // List & Cards
  list: { flex: 1, paddingHorizontal: 16 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.dangerLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: { color: colors.danger, fontSize: 13, flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardTopAccent: { height: 4 },
  cardMain: { padding: spacing.md },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1 },
  cardTitle: { ...typography.h3, color: colors.text, fontSize: 15 },
  cardDesc: { ...typography.caption, color: colors.textMuted, marginTop: 4, lineHeight: 17 },
  cardDescEmpty: { ...typography.caption, color: colors.textMuted, marginTop: 4, fontStyle: "italic" },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  dateText: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
  cardActions: { flexDirection: "row", gap: 8 },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  actionChipText: { fontSize: 11, fontWeight: "700" },

  // Modal
  modalContent: { paddingVertical: spacing.xs },

  // Restricted Access
  restrictedContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
  },
  restrictedIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.dangerLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  restrictedTitle: { ...typography.h2, color: colors.text, marginBottom: spacing.xs },
  restrictedText: { ...typography.body, color: colors.textMuted, textAlign: "center", lineHeight: 20 },
});

export default MatieresBody;
