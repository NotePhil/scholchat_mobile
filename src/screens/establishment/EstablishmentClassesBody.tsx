import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Badge, BottomSheet, Button, EmptyState, Input, LoadingSpinner } from "../../components/ui";
import { colors, spacing, typography } from "../../styles/theme";
import { classAdminService, establishmentService } from "../../services/api";
import { classService } from "../../services/classService";
import { ClassEntity, Etablissement } from "../../types";
import { useUser } from "../../context/UserContext";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  ACTIF: "success",
  INACTIF: "neutral",
  EN_ATTENTE_APPROBATION: "warning",
};

/** Establishment/Gestionnaire "Classes" section — mirrors web's create-class/manage-class sidebar dropdown. */
const EstablishmentClassesBody = () => {
  const { user } = useUser();
  const [establishments, setEstablishments] = useState<Etablissement[]>([]);
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!user?.userId) return;
    setLoading(true);
    setError("");
    try {
      const ests = await establishmentService.getByGestionnaire(user.userId);
      setEstablishments(ests);
      const estIds = new Set(ests.map((e) => e.id));
      const allClasses = await classAdminService.getAll();
      setClasses(allClasses.filter((c) => c.etablissement?.id && estIds.has(c.etablissement.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du chargement des classes.");
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (cls: ClassEntity) => {
    if (!cls.etablissement?.id) return;
    try {
      await establishmentService.approveClass(cls.id, cls.etablissement.id);
      load();
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de l'approbation.");
    }
  };

  const handleReject = async (cls: ClassEntity) => {
    if (!cls.etablissement?.id) return;
    try {
      await establishmentService.rejectClass(cls.id, cls.etablissement.id);
      load();
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec du rejet.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Classes</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)} style={styles.addButton}>
          <FontAwesome5 name="plus" size={14} color={colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? (
          <LoadingSpinner label="Chargement des classes..." />
        ) : classes.length === 0 ? (
          <EmptyState icon="chalkboard" title="Aucune classe" actionLabel="Créer une classe" onAction={() => setShowCreate(true)} />
        ) : (
          classes.map((cls) => {
            const etat = (cls.etat as string) ?? "EN_ATTENTE_APPROBATION";
            const isPending = etat === "EN_ATTENTE_APPROBATION";
            return (
              <View key={cls.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{cls.nom ?? "Classe sans nom"}</Text>
                  <Badge label={etat} tone={STATUS_TONE[etat] ?? "neutral"} />
                </View>
                {cls.niveau ? <Text style={styles.cardMeta}>Niveau: {cls.niveau}</Text> : null}
                {isPending && (
                  <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleApprove(cls)}>
                      <FontAwesome5 name="check" size={14} color={colors.success} />
                      <Text style={[styles.actionText, { color: colors.success }]}>Approuver</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleReject(cls)}>
                      <FontAwesome5 name="times" size={14} color={colors.danger} />
                      <Text style={[styles.actionText, { color: colors.danger }]}>Rejeter</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <CreateClassSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={load}
        establishments={establishments}
        creatorId={user?.userId}
      />
    </View>
  );
};

interface CreateClassSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  establishments: Etablissement[];
  creatorId?: string;
}

const CreateClassSheet = ({ visible, onClose, onCreated, establishments, creatorId }: CreateClassSheetProps) => {
  const [nom, setNom] = useState("");
  const [niveau, setNiveau] = useState("");
  const [etablissementId, setEtablissementId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && establishments.length > 0 && !etablissementId) {
      setEtablissementId(establishments[0].id);
    }
  }, [visible, establishments]);

  const handleSubmit = async () => {
    if (!creatorId) {
      Alert.alert("Erreur", "Utilisateur non identifié.");
      return;
    }
    if (!nom.trim()) {
      Alert.alert("Erreur", "Le nom est obligatoire.");
      return;
    }
    if (!etablissementId) {
      Alert.alert("Erreur", "Sélectionnez un établissement.");
      return;
    }
    setSubmitting(true);
    try {
      await classService.createNewClass({
        nom: nom.trim(),
        niveau: niveau.trim() || undefined,
        etablissementId,
        creatorId,
      });
      setNom("");
      setNiveau("");
      onCreated();
      onClose();
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la création.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Nouvelle classe">
      <Input label="Nom de la classe" value={nom} onChangeText={setNom} placeholder="Ex: 3ème A" />
      <Input label="Niveau" value={niveau} onChangeText={setNiveau} placeholder="Ex: Collège" />

      <Text style={styles.fieldLabel}>Établissement</Text>
      <View style={styles.chipRow}>
        {establishments.length === 0 ? (
          <Text style={styles.cardMeta}>Aucun établissement — créez-en un d'abord.</Text>
        ) : (
          establishments.map((est) => (
            <TouchableOpacity
              key={est.id}
              style={[styles.chip, etablissementId === est.id && styles.chipActive]}
              onPress={() => setEtablissementId(est.id)}
            >
              <Text style={[styles.chipText, etablissementId === est.id && styles.chipTextActive]}>{est.nom}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      <Button label="Créer" onPress={handleSubmit} loading={submitting} fullWidth style={{ marginTop: spacing.md, marginBottom: spacing.lg }} />
    </BottomSheet>
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
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  cardTitle: { ...typography.bodyBold, color: colors.text, flex: 1, marginRight: spacing.sm },
  cardMeta: { ...typography.caption, color: colors.textMuted },
  cardActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionText: { ...typography.caption, fontWeight: "600" },
  fieldLabel: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20, backgroundColor: colors.grayLight },
  chipActive: { backgroundColor: colors.primary },
  chipText: { ...typography.caption, color: colors.text },
  chipTextActive: { color: colors.white, fontWeight: "600" },
});

export default EstablishmentClassesBody;
