import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Badge, Button, EmptyState, LoadingSpinner } from "../../components/ui";
import { colors, spacing, typography, useThemeColors } from "../../styles/theme";
import { establishmentService } from "../../services/api";
import { CreateEstablishmentSheet } from "../admin/components/CreateEstablishmentSheet";
import { Etablissement } from "../../types";
import { useUser } from "../../context/UserContext";
import EstablishmentDetails from "./EstablishmentDetails";

/**
 * Gestionnaire's own "Mes établissements" — view and edit only, with the same
 * edit form as admin's (CreateEstablishmentSheet). Creating and deleting an
 * établissement is admin-only (backend POST/DELETE /etablissements require
 * ADMIN), so there is no create or delete entry here.
 */
const EstablishmentListBody = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useUser();
  const [establishments, setEstablishments] = useState<Etablissement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingEstablishment, setEditingEstablishment] = useState<Etablissement | null>(null);
  const [managedEstId, setManagedEstId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.userId) return;
    setLoading(true);
    setError("");
    try {
      const data = await establishmentService.getByGestionnaire(user.userId);
      setEstablishments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du chargement des établissements.");
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    load();
  }, [load]);

  if (managedEstId) {
    return <EstablishmentDetails establishmentId={managedEstId} onBack={() => setManagedEstId(null)} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes établissements</Text>
      </View>

      <ScrollView style={styles.list}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? (
          <LoadingSpinner label="Chargement..." />
        ) : establishments.length === 0 ? (
          <EmptyState
            icon="school"
            title="Aucun établissement"
            message="Aucun établissement ne vous est encore attribué."
          />
        ) : (
          establishments.map((est) => (
            <View key={est.id} style={styles.card}>
              <TouchableOpacity onPress={() => setManagedEstId(est.id)}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{est.nom}</Text>
                  {(est as any).expireParOffre ? <Badge label="Offre expirée" tone="danger" /> : null}
                </View>
                {est.localisation ? <Text style={styles.cardMeta}>{est.localisation}</Text> : null}
                {(est.optionEnvoiMailNewClasse || est.optionTokenGeneral) && (
                  <View style={styles.badgeRow}>
                    {est.optionEnvoiMailNewClasse ? <Badge label="Email Classes" tone="success" /> : null}
                    {est.optionTokenGeneral ? <Badge label="Code Unique" tone="info" /> : null}
                  </View>
                )}
              </TouchableOpacity>
              <View style={styles.cardActions}>
                <Button label="Gérer" variant="secondary" onPress={() => setManagedEstId(est.id)} style={{ flex: 1 }} />
                <TouchableOpacity style={styles.iconBtn} onPress={() => setEditingEstablishment(est)}>
                  <FontAwesome5 name="edit" size={16} color={colors.success} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <CreateEstablishmentSheet
        visible={!!editingEstablishment}
        onClose={() => setEditingEstablishment(null)}
        onCreated={load}
        editingEstablishment={editingEstablishment}
      />
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
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
  list: { flex: 1, paddingHorizontal: 16 },
  error: { color: colors.danger, marginBottom: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  cardTitle: { ...typography.bodyBold, color: colors.text, flex: 1 },
  cardMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.sm },
  cardActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  iconBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.grayLight, alignItems: "center", justifyContent: "center" },
});

export default EstablishmentListBody;
