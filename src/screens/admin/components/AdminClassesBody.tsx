import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { BottomSheet, Badge, Button, Card, DropdownField, EmptyState, Input, LoadingSpinner } from "../../../components/ui";
import PromptSheet from "../../../components/common/PromptSheet";
import PaymentModal from "../../../components/common/PaymentModal";
import ClassDetails from "../../professeurs/components/classes/ClassDetails";
import { UIClass, enrichClassForDetails } from "../../professeurs/components/classes/DashboardClassesBody";
import { colors, spacing, typography } from "../../../styles/theme";
import { classAdminService, establishmentService, offerService } from "../../../services/api";
import { classService } from "../../../services/classService";
import CreateClassSheet from "./CreateClassSheet";
import { PaymentInfo } from "../../../services/api/contratService";
import { useUser } from "../../../context/UserContext";
import { ClassEntity, Etablissement, Offre } from "../../../types";

const NIVEAUX = ["CP", "CE1", "CE2", "CM1", "CM2", "6ème", "5ème", "4ème", "3ème", "2nde", "1ère", "Terminale", "Autre"];

/** Mirrors web's OfferService.calculerReduction() exactly. */
const calculerReduction = (offre: Offre | null): number | null => {
  if (!offre) return null;
  const o = offre as any;
  if (o.reductionAnnuellePourcentage != null) return o.reductionAnnuellePourcentage;
  if (!o.prixMensuel || !o.prixAnnuel || !o.dureeMensuelleMinutes || !o.dureeAnnuelleMinutes) return null;
  const moisEquivalents = o.dureeAnnuelleMinutes / o.dureeMensuelleMinutes;
  const prixMensualiseSurAnnee = o.prixMensuel * moisEquivalents;
  if (prixMensualiseSurAnnee <= 0) return null;
  return 1 - o.prixAnnuel / prixMensualiseSurAnnee;
};

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  ACTIVE: "success",
  APPROVED: "success",
  PENDING: "warning",
  EN_ATTENTE: "warning",
  REJECTED: "danger",
  REJETEE: "danger",
};

interface AdminClassesBodyProps {
  /** When true, opens the create sheet immediately — used by the "Créer une Classe" quick action so it lands on the actual form instead of the plain list. */
  autoCreate?: boolean;
}

const AdminClassesBody = ({ autoCreate }: AdminClassesBodyProps) => {
  const { user } = useUser();
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [rejectingClass, setRejectingClass] = useState<ClassEntity | null>(null);
  const [showCreate, setShowCreate] = useState(!!autoCreate);
  const [managedClass, setManagedClass] = useState<ClassEntity | null>(null);
  const [selectedClass, setSelectedClass] = useState<UIClass | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState("info");
  const [managing, setManaging] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassEntity | null>(null);

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

  const handleManage = async (cls: ClassEntity) => {
    setManagedClass(cls);
    setActiveDetailTab("professeurs");
    setManaging(true);
    try {
      const enriched = await enrichClassForDetails(cls);
      setSelectedClass(enriched);
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

  const handleEditSubmit = async (nom: string, niveau: string) => {
    if (!editingClass) return;
    try {
      await classAdminService.update(editingClass.id, { nom, niveau });
      setEditingClass(null);
      load();
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la modification.");
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
        isAdmin
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Classes</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowCreate(true)}>
          <FontAwesome5 name="plus" size={14} color={colors.white} />
        </TouchableOpacity>
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
                <TouchableOpacity activeOpacity={0.7} onPress={() => handleManage(cls)}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{cls.nom ?? "Classe sans nom"}</Text>
                    <Badge label={etat} tone={STATUS_TONE[etat.toUpperCase()] ?? "neutral"} />
                  </View>
                  {cls.niveau ? <Text style={styles.cardSubtitle}>Niveau: {cls.niveau}</Text> : null}
                  {cls.etablissement?.nom ? (
                    <Text style={styles.cardSubtitle}>Établissement: {cls.etablissement.nom}</Text>
                  ) : null}
                </TouchableOpacity>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleManage(cls)}>
                    <FontAwesome5 name="cog" size={14} color={colors.primary} />
                    <Text style={[styles.actionText, { color: colors.primary }]}>Gérer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => setEditingClass(cls)}>
                    <FontAwesome5 name="edit" size={14} color={colors.textMuted} />
                    <Text style={styles.actionText}>Modifier</Text>
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

      <CreateClassSheet visible={showCreate} onClose={() => setShowCreate(false)} onCreated={load} creatorId={user?.userId} />
      <EditClassSheet classItem={editingClass} onClose={() => setEditingClass(null)} onSubmit={handleEditSubmit} />
    </View>
  );
};



interface EditClassSheetProps {
  classItem: ClassEntity | null;
  onClose: () => void;
  onSubmit: (nom: string, niveau: string) => void | Promise<void>;
}

/** Matches web's ManageClassList.jsx "Modifier" modal (nom + niveau). */
const EditClassSheet = ({ classItem, onClose, onSubmit }: EditClassSheetProps) => {
  const [nom, setNom] = useState("");
  const [niveau, setNiveau] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (classItem) {
      setNom(classItem.nom ?? "");
      setNiveau(classItem.niveau ?? "");
    }
  }, [classItem]);

  const handleSubmit = async () => {
    if (!nom.trim()) {
      Alert.alert("Erreur", "Le nom est obligatoire.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(nom.trim(), niveau.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet visible={!!classItem} onClose={onClose} title={`Modifier — ${classItem?.nom ?? ""}`}>
      <Input label="Nom de la classe" value={nom} onChangeText={setNom} placeholder="Ex: 3ème A" />
      <DropdownField label="Niveau" placeholder="Sélectionner un niveau" value={niveau} options={NIVEAUX.map((n) => ({ label: n, value: n }))} onChange={setNiveau} />
      <Button label="Enregistrer" onPress={handleSubmit} loading={submitting} fullWidth style={{ marginTop: spacing.md, marginBottom: spacing.lg }} />
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
  fieldLabel: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20, backgroundColor: colors.grayLight },
  chipActive: { backgroundColor: colors.primary },
  chipText: { ...typography.caption, color: colors.text },
  chipTextActive: { color: colors.white, fontWeight: "600" },
  fieldError: { ...typography.caption, color: colors.danger, marginTop: -spacing.sm, marginBottom: spacing.sm },
  accesMajeurBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  accesMajeurTitle: { ...typography.bodyBold, color: "#6D28D9" },
  accesMajeurSub: { ...typography.caption, color: "#7C3AED" },
  offreBox: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  emptyOffresText: { ...typography.caption, color: colors.textMuted, fontStyle: "italic" },
  offreHint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  periodBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  periodBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  periodBtnText: { ...typography.caption, color: colors.text, fontWeight: "600" },
  periodBtnTextActive: { color: colors.white },
  reductionText: {
    ...typography.caption,
    color: colors.success,
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 8,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  searchWrap: { paddingHorizontal: 16, marginBottom: spacing.sm },
  list: { flex: 1, paddingHorizontal: 16 },
  error: { color: colors.danger, marginBottom: spacing.md },
  card: { marginBottom: spacing.md },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  cardTitle: { ...typography.h3, color: colors.text, flex: 1, marginRight: spacing.sm },
  cardSubtitle: { ...typography.caption, color: colors.textMuted },
  cardActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionText: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
});

export default AdminClassesBody;
