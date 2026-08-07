import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Badge, Card, EmptyState, Input, LoadingSpinner } from "../../../components/ui";
import PromptSheet from "../../../components/common/PromptSheet";
import { colors, spacing, typography } from "../../../styles/theme";
import { classAdminService } from "../../../services/api";
import { ClassEntity } from "../../../types";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  ACTIVE: "success",
  APPROVED: "success",
  PENDING: "warning",
  EN_ATTENTE: "warning",
  REJECTED: "danger",
  REJETEE: "danger",
};

const AdminClassesBody = () => {
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [rejectingClass, setRejectingClass] = useState<ClassEntity | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await classAdminService.getAll();
      setClasses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du chargement des classes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = classes.filter((c) =>
    (c.nom ?? "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleApprove = async (cls: ClassEntity) => {
    try {
      await classAdminService.approve(cls.id);
      load();
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de l'approbation.");
    }
  };

  const handleReject = (cls: ClassEntity) => {
    setRejectingClass(cls);
  };

  const handleConfirmReject = async (motif: string) => {
    if (!rejectingClass) return;
    try {
      await classAdminService.reject(rejectingClass.id, motif);
      setRejectingClass(null);
      load();
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec du rejet.");
    }
  };

  const handleDelete = (cls: ClassEntity) => {
    Alert.alert("Supprimer la classe", `Voulez-vous vraiment supprimer "${cls.nom}" ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await classAdminService.remove(cls.id);
            setClasses((prev) => prev.filter((c) => c.id !== cls.id));
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
        <Text style={styles.title}>Classes</Text>
      </View>

      <View style={styles.searchWrap}>
        <Input placeholder="Rechercher une classe..." value={searchTerm} onChangeText={setSearchTerm} />
      </View>

      <ScrollView style={styles.list}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? (
          <LoadingSpinner label="Chargement des classes..." />
        ) : filtered.length === 0 ? (
          <EmptyState icon="chalkboard" title="Aucune classe" />
        ) : (
          filtered.map((cls) => {
            const etat = (cls.etat as string) ?? "PENDING";
            const isPending = etat.toUpperCase().includes("PENDING") || etat.toUpperCase().includes("ATTENTE");
            return (
              <Card key={cls.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{cls.nom ?? "Classe sans nom"}</Text>
                  <Badge label={etat} tone={STATUS_TONE[etat.toUpperCase()] ?? "neutral"} />
                </View>
                {cls.niveau ? <Text style={styles.cardSubtitle}>Niveau: {cls.niveau}</Text> : null}
                {cls.etablissement?.nom ? (
                  <Text style={styles.cardSubtitle}>Établissement: {cls.etablissement.nom}</Text>
                ) : null}
                <View style={styles.cardActions}>
                  {isPending && (
                    <>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => handleApprove(cls)}>
                        <FontAwesome5 name="check" size={14} color={colors.success} />
                        <Text style={[styles.actionText, { color: colors.success }]}>Approuver</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => handleReject(cls)}>
                        <FontAwesome5 name="times" size={14} color={colors.danger} />
                        <Text style={[styles.actionText, { color: colors.danger }]}>Rejeter</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(cls)}>
                    <FontAwesome5 name="trash" size={14} color={colors.textMuted} />
                    <Text style={styles.actionText}>Supprimer</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <PromptSheet
        visible={!!rejectingClass}
        title="Motif du rejet"
        message={rejectingClass ? `Pourquoi rejeter "${rejectingClass.nom}" ?` : undefined}
        placeholder="Motif"
        submitLabel="Rejeter"
        onCancel={() => setRejectingClass(null)}
        onSubmit={handleConfirmReject}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, marginTop: 20, marginBottom: spacing.md },
  title: { ...typography.h1, color: colors.text },
  searchWrap: { paddingHorizontal: 16, marginBottom: spacing.sm },
  list: { flex: 1, paddingHorizontal: 16 },
  error: { color: colors.danger, marginBottom: spacing.md },
  card: { marginBottom: spacing.md },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  cardTitle: { ...typography.h3, color: colors.text, flex: 1, marginRight: spacing.sm },
  cardSubtitle: { ...typography.caption, color: colors.textMuted },
  cardActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionText: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
});

export default AdminClassesBody;
