import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Badge, Button, EmptyState, LoadingSpinner } from "../../components/ui";
import { colors, spacing, typography } from "../../styles/theme";
import { establishmentService } from "../../services/api";
import { CreateEstablishmentSheet } from "../admin/components/CreateEstablishmentSheet";
import { Etablissement } from "../../types";
import { useUser } from "../../context/UserContext";
import EstablishmentDetails from "./EstablishmentDetails";

/**
 * Gestionnaire's own "Mes établissements" — reuses the exact same create/
 * edit form as admin's (CreateEstablishmentSheet), matching web's
 * CreateEstablishmentContent.jsx which both roles share verbatim. This used
 * to keep its own separate, much thinner create form (nom + localisation
 * only, no edit at all) instead of the real one.
 */
const EstablishmentListBody = () => {
  const { user } = useUser();
  const [establishments, setEstablishments] = useState<Etablissement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
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

  const handleDelete = (est: Etablissement) => {
    Alert.alert("Supprimer", `Voulez-vous vraiment supprimer "${est.nom}" ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await establishmentService.remove(est.id);
            setEstablishments((prev) => prev.filter((e) => e.id !== est.id));
          } catch (err) {
            Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la suppression.");
          }
        },
      },
    ]);
  };

  if (managedEstId) {
    return <EstablishmentDetails establishmentId={managedEstId} onBack={() => setManagedEstId(null)} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes établissements</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowCreate(true)}>
          <FontAwesome5 name="plus" size={14} color={colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? (
          <LoadingSpinner label="Chargement..." />
        ) : establishments.length === 0 ? (
          <EmptyState
            icon="school"
            title="Aucun établissement"
            actionLabel="Créer un établissement"
            onAction={() => setShowCreate(true)}
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
                <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(est)}>
                  <FontAwesome5 name="trash" size={16} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <CreateEstablishmentSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={load}
        defaultGestionnaireId={user?.userId}
      />
      <CreateEstablishmentSheet
        visible={!!editingEstablishment}
        onClose={() => setEditingEstablishment(null)}
        onCreated={load}
        editingEstablishment={editingEstablishment}
      />
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
