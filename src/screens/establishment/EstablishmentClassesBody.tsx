import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Badge, BottomSheet, Button, EmptyState, Input, LoadingSpinner } from "../../components/ui";
import { colors, spacing, typography, useThemeColors } from "../../styles/theme";
import { classAdminService, establishmentService } from "../../services/api";
import { classService } from "../../services/classService";
import ClassDetails from "../professeurs/components/classes/ClassDetails";
import { UIClass, enrichClassForDetails } from "../professeurs/components/classes/DashboardClassesBody";
import { ClassEntity, Etablissement } from "../../types";
import { useUser } from "../../context/UserContext";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  ACTIF: "success",
  INACTIF: "neutral",
  EN_ATTENTE_APPROBATION: "warning",
};

/**
 * Establishment/Gestionnaire "Classes" section — mirrors web's create-class/
 * manage-class sidebar dropdown. Tapping a class opens the SAME ClassDetails
 * component admin and professor use (members, access requests, moderator,
 * offer status, cours/exercices) — this used to be a dead-end card with only
 * approve/reject, no way to actually manage the class, unlike every other
 * role's class list.
 */
const EstablishmentClassesBody = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useUser();
  const [establishments, setEstablishments] = useState<Etablissement[]>([]);
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [managedClass, setManagedClass] = useState<ClassEntity | null>(null);
  const [selectedClass, setSelectedClass] = useState<UIClass | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState("info");
  const [managing, setManaging] = useState(false);

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

  const handleManage = async (cls: ClassEntity) => {
    setManagedClass(cls);
    setActiveDetailTab("info");
    setManaging(true);
    try {
      setSelectedClass(await enrichClassForDetails(cls));
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec du chargement des détails.");
      setManagedClass(null);
    } finally {
      setManaging(false);
    }
  };

  const handleRefreshManaged = async () => {
    if (!managedClass) return;
    try {
      setSelectedClass(await enrichClassForDetails(managedClass));
    } catch {
      // keep showing the previous snapshot on transient refresh failures
    }
  };

  if (managedClass) {
    if (managing || !selectedClass) {
      return <LoadingSpinner label="Chargement des détails..." fullScreen />;
    }
    return (
      <ClassDetails
        selectedClass={selectedClass}
        onBack={() => {
          setManagedClass(null);
          setSelectedClass(null);
        }}
        activeDetailTab={activeDetailTab}
        setActiveDetailTab={setActiveDetailTab}
        onRefresh={handleRefreshManaged}
      />
    );
  }

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
            const isPending = etat.toUpperCase().includes("ATTENTE");
            return (
              <TouchableOpacity key={cls.id} style={styles.card} activeOpacity={0.7} onPress={() => handleManage(cls)}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{cls.nom ?? "Classe sans nom"}</Text>
                  <Badge label={etat} tone={STATUS_TONE[etat] ?? "neutral"} />
                </View>
                {cls.niveau ? <Text style={styles.cardMeta}>Niveau: {cls.niveau}</Text> : null}
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleManage(cls)}>
                    <FontAwesome5 name="cog" size={14} color={colors.primary} />
                    <Text style={[styles.actionText, { color: colors.primary }]}>Gérer</Text>
                  </TouchableOpacity>
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
                </View>
              </TouchableOpacity>
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

const NIVEAUX = ["CP", "CE1", "CE2", "CM1", "CM2", "6ème", "5ème", "4ème", "3ème", "2nde", "1ère", "Terminale", "Autre"];

const CreateClassSheet = ({ visible, onClose, onCreated, establishments, creatorId }: CreateClassSheetProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [nom, setNom] = useState("");
  const [niveau, setNiveau] = useState("");
  const [accesMajeur, setAccesMajeur] = useState(false);
  const [codeUnique, setCodeUnique] = useState("");
  const [etablissementId, setEtablissementId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && establishments.length > 0 && !etablissementId) {
      setEtablissementId(establishments[0].id);
    }
    if (!visible) {
      setNom("");
      setNiveau("");
      setAccesMajeur(false);
      setCodeUnique("");
    }
  }, [visible, establishments]);

  const selectedEstablishment = establishments.find((e) => e.id === etablissementId) || null;

  const handleSubmit = async () => {
    if (!creatorId) {
      Alert.alert("Erreur", "Utilisateur non identifié.");
      return;
    }
    if (!nom.trim()) {
      Alert.alert("Erreur", "Le nom est obligatoire.");
      return;
    }
    if (!niveau) {
      Alert.alert("Erreur", "Le niveau est requis.");
      return;
    }
    if (!etablissementId) {
      Alert.alert("Erreur", "Sélectionnez un établissement.");
      return;
    }
    if (selectedEstablishment?.optionTokenGeneral && !codeUnique.trim()) {
      Alert.alert("Erreur", "Le code unique de l'établissement est requis.");
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        nom: nom.trim(),
        niveau,
        etablissementId,
        creatorId,
        moderatorId: creatorId,
        accesMajeur,
      };
      if (selectedEstablishment?.optionTokenGeneral && codeUnique) payload.codeUnique = codeUnique;
      await classService.createNewClass(payload as Parameters<typeof classService.createNewClass>[0]);
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
      <Input label="Nom de la classe *" value={nom} onChangeText={setNom} placeholder="Ex: 3ème A" />

      <Text style={styles.fieldLabel}>Niveau *</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
        <View style={styles.chipRow}>
          {NIVEAUX.map((n) => (
            <TouchableOpacity key={n} style={[styles.chip, niveau === n && styles.chipActive]} onPress={() => setNiveau(n)}>
              <Text style={[styles.chipText, niveau === n && styles.chipTextActive]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.accesMajeurBox} onPress={() => setAccesMajeur((v) => !v)}>
        <FontAwesome5 name={accesMajeur ? "check-square" : "square"} size={18} color={accesMajeur ? colors.primary : colors.textMuted} />
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={styles.accesMajeurTitle}>Classe Majeure</Text>
          <Text style={styles.accesMajeurSub}>Les élèves rejoignent par recherche d'email</Text>
        </View>
      </TouchableOpacity>

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

      {selectedEstablishment?.optionTokenGeneral && (
        <Input
          label="Code Unique de l'établissement *"
          value={codeUnique}
          onChangeText={setCodeUnique}
          placeholder="ABC123"
          autoCapitalize="characters"
        />
      )}

      <Button label="Créer" onPress={handleSubmit} loading={submitting} fullWidth style={{ marginTop: spacing.md, marginBottom: spacing.lg }} />
    </BottomSheet>
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
  addButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  list: { flex: 1, paddingHorizontal: 16 },
  error: { color: colors.danger, marginBottom: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  cardTitle: { ...typography.bodyBold, color: colors.text, flex: 1, marginRight: spacing.sm },
  cardMeta: { ...typography.caption, color: colors.textMuted },
  cardActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionText: { ...typography.caption, fontWeight: "600" },
  fieldLabel: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20, backgroundColor: colors.grayLight },
  chipActive: { backgroundColor: colors.primary },
  chipText: { ...typography.caption, color: colors.text },
  chipTextActive: { color: colors.white, fontWeight: "600" },
  accesMajeurBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  accesMajeurTitle: { ...typography.bodyBold, color: colors.text },
  accesMajeurSub: { ...typography.caption, color: colors.textMuted },
});

export default EstablishmentClassesBody;
