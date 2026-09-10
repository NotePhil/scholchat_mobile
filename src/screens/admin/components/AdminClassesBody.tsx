import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { BottomSheet, Badge, Button, DropdownField, EmptyState, Input, LoadingSpinner } from "../../../components/ui";
import PromptSheet from "../../../components/common/PromptSheet";
import PaymentModal from "../../../components/common/PaymentModal";
import ClassDetails from "../../professeurs/components/classes/ClassDetails";
import { UIClass, enrichClassForDetails } from "../../professeurs/components/classes/DashboardClassesBody";
import { colors, radius, shadow, spacing, typography, useThemeColors } from "../../../styles/theme";
import { classAdminService, establishmentService, offerService } from "../../../services/api";
import { classService } from "../../../services/classService";
import CreateClassSheet from "./CreateClassSheet";
import { PaymentInfo } from "../../../services/api/contratService";
import { useUser } from "../../../context/UserContext";
import { ClassEntity, Etablissement, Offre } from "../../../types";

// LinearGradient with safe fallback
let LinearGradient: any;
try { LinearGradient = require("expo-linear-gradient").LinearGradient; } catch { LinearGradient = ({ children, style }: any) => <View style={style}>{children}</View>; }

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
  ACTIVE: "success", APPROVED: "success", PENDING: "warning", EN_ATTENTE: "warning", REJECTED: "danger", REJETEE: "danger",
};

const STATUS_GRADIENT: Record<string, string[]> = {
  ACTIVE: ["#10B981", "#059669"],
  APPROVED: ["#10B981", "#059669"],
  PENDING: ["#F59E0B", "#D97706"],
  EN_ATTENTE: ["#F59E0B", "#D97706"],
  REJECTED: ["#EF4444", "#DC2626"],
  REJETEE: ["#EF4444", "#DC2626"],
};

const STATUS_ACCENT: Record<string, string> = {
  ACTIVE: colors.success, APPROVED: colors.success,
  PENDING: colors.warning, EN_ATTENTE: colors.warning,
  REJECTED: colors.danger, REJETEE: colors.danger,
};

interface AdminClassesBodyProps {
  autoCreate?: boolean;
}

const AdminClassesBody = ({ autoCreate }: AdminClassesBodyProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
    setLoading(true); setError("");
    try { setClasses(await classAdminService.getAll()); }
    catch (err) { setError(err instanceof Error ? err.message : "Échec du chargement des classes."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = classes.filter((c) => (c.nom ?? "").toLowerCase().includes(searchTerm.toLowerCase()));

  const handleApprove = async (cls: ClassEntity) => {
    try { await classAdminService.approve(cls.id); load(); }
    catch (err) { Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de l'approbation."); }
  };

  const handleReject = (cls: ClassEntity) => setRejectingClass(cls);

  const handleConfirmReject = async (motif: string) => {
    if (!rejectingClass) return;
    try { await classAdminService.reject(rejectingClass.id, motif); setRejectingClass(null); load(); }
    catch (err) { Alert.alert("Erreur", err instanceof Error ? err.message : "Échec du rejet."); }
  };

  const handleManage = async (cls: ClassEntity) => {
    setManagedClass(cls); setActiveDetailTab("professeurs"); setManaging(true);
    try { setSelectedClass(await enrichClassForDetails(cls)); }
    catch (err) { Alert.alert("Erreur", err instanceof Error ? err.message : "Échec du chargement des détails."); setManagedClass(null); }
    finally { setManaging(false); }
  };

  const handleRefreshManaged = async () => {
    if (!managedClass) return;
    try { setSelectedClass(await enrichClassForDetails(managedClass)); } catch { }
  };

  const handleEditSubmit = async (nom: string, niveau: string) => {
    if (!editingClass) return;
    try { await classAdminService.update(editingClass.id, { nom, niveau }); setEditingClass(null); load(); }
    catch (err) { Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la modification."); }
  };

  const handleDelete = (cls: ClassEntity) => {
    Alert.alert("Supprimer la classe", `Voulez-vous vraiment supprimer "${cls.nom}" ?`, [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: async () => {
        try { await classAdminService.remove(cls.id); setClasses((prev) => prev.filter((c) => c.id !== cls.id)); }
        catch (err) { Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la suppression."); }
      }},
    ]);
  };

  if (managedClass) {
    if (managing || !selectedClass) return <LoadingSpinner label="Chargement des détails..." fullScreen />;
    return (
      <ClassDetails
        selectedClass={selectedClass}
        onBack={() => { setManagedClass(null); setSelectedClass(null); }}
        activeDetailTab={activeDetailTab}
        setActiveDetailTab={setActiveDetailTab}
        onRefresh={handleRefreshManaged}
        isAdmin
      />
    );
  }

  const pendingCount = filtered.filter((c) => {
    const e = ((c.etat as string) ?? "").toUpperCase();
    return e.includes("PENDING") || e.includes("ATTENTE");
  }).length;

  return (
    <View style={styles.container}>
      {/* Page Header */}
      <LinearGradient colors={[colors.heroStart, colors.heroMid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pageHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.pageTitle}>Classes</Text>
          <View style={styles.headerMetaRow}>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{filtered.length} total</Text>
            </View>
            {pendingCount > 0 && (
              <View style={[styles.headerBadge, styles.headerBadgeWarning]}>
                <Text style={[styles.headerBadgeText, { color: colors.warningDark }]}>{pendingCount} en attente</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity style={styles.addFab} onPress={() => setShowCreate(true)}>
          <FontAwesome5 name="plus" size={16} color={colors.white} />
        </TouchableOpacity>
      </LinearGradient>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchRow}>
          <FontAwesome5 name="search" size={13} color={colors.textMuted} style={styles.searchIcon} />
          <Input placeholder="Rechercher une classe..." value={searchTerm} onChangeText={setSearchTerm} style={styles.searchInput} />
        </View>
      </View>

      {/* List */}
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
        {loading ? (
          <LoadingSpinner label="Chargement des classes..." />
        ) : filtered.length === 0 ? (
          <EmptyState icon="chalkboard" title="Aucune classe" />
        ) : (
          filtered.map((cls) => {
            const etat = (cls.etat as string) ?? "PENDING";
            const etatUpper = etat.toUpperCase();
            const isPending = etatUpper.includes("PENDING") || etatUpper.includes("ATTENTE");
            const accentColor = STATUS_ACCENT[etatUpper] ?? colors.textMuted;
            const gradient = STATUS_GRADIENT[etatUpper] ?? ["#6B7280", "#9CA3AF"];
            return (
              <TouchableOpacity key={cls.id} activeOpacity={0.85} onPress={() => handleManage(cls)} style={styles.card}>
                {/* Status accent bar */}
                <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />
                <View style={styles.cardBody}>
                  {/* Card header */}
                  <View style={styles.cardHeaderRow}>
                    <LinearGradient colors={gradient} style={styles.cardIcon}>
                      <FontAwesome5 name="chalkboard" size={13} color={colors.white} />
                    </LinearGradient>
                    <View style={styles.cardTitleWrap}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{cls.nom ?? "Classe sans nom"}</Text>
                      {cls.niveau ? <Text style={styles.cardNiveau}>{cls.niveau}</Text> : null}
                    </View>
                    <Badge label={etat} tone={STATUS_TONE[etatUpper] ?? "neutral"} />
                  </View>

                  {/* Establishment */}
                  {cls.etablissement?.nom ? (
                    <View style={styles.metaRow}>
                      <FontAwesome5 name="school" size={10} color={colors.textMuted} />
                      <Text style={styles.metaText} numberOfLines={1}>{cls.etablissement.nom}</Text>
                    </View>
                  ) : null}

                  {/* Actions */}
                  <View style={styles.cardActions}>
                    <ActionChip icon="cog" label="Gérer" color={colors.primary} onPress={() => handleManage(cls)} />
                    <ActionChip icon="edit" label="Modifier" color={colors.info} onPress={() => setEditingClass(cls)} />
                    {isPending && (
                      <>
                        <ActionChip icon="check" label="Approuver" color={colors.success} onPress={() => handleApprove(cls)} />
                        <ActionChip icon="times" label="Rejeter" color={colors.danger} onPress={() => handleReject(cls)} />
                      </>
                    )}
                    <ActionChip icon="trash" label="Supprimer" color={colors.danger} onPress={() => handleDelete(cls)} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 110 }} />
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

const ActionChip = ({ icon, label, color, onPress }: { icon: any; label: string; color: string; onPress: () => void }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
  <TouchableOpacity style={[styles.actionChip, { borderColor: `${color}30`, backgroundColor: `${color}10` }]} onPress={onPress} activeOpacity={0.7}>
    <FontAwesome5 name={icon} size={11} color={color} />
    <Text style={[styles.actionChipText, { color }]}>{label}</Text>
  </TouchableOpacity>
  );
};

interface EditClassSheetProps {
  classItem: ClassEntity | null;
  onClose: () => void;
  onSubmit: (nom: string, niveau: string) => void | Promise<void>;
}

const EditClassSheet = ({ classItem, onClose, onSubmit }: EditClassSheetProps) => {
  const [nom, setNom] = useState("");
  const [niveau, setNiveau] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (classItem) { setNom(classItem.nom ?? ""); setNiveau(classItem.niveau ?? ""); }
  }, [classItem]);

  const handleSubmit = async () => {
    if (!nom.trim()) { Alert.alert("Erreur", "Le nom est obligatoire."); return; }
    setSubmitting(true);
    try { await onSubmit(nom.trim(), niveau.trim()); } finally { setSubmitting(false); }
  };

  return (
    <BottomSheet visible={!!classItem} onClose={onClose} title={`Modifier — ${classItem?.nom ?? ""}`}>
      <Input label="Nom de la classe" value={nom} onChangeText={setNom} placeholder="Ex: 3ème A" />
      <DropdownField label="Niveau" placeholder="Sélectionner un niveau" value={niveau} options={NIVEAUX.map((n) => ({ label: n, value: n }))} onChange={setNiveau} />
      <Button label="Enregistrer" onPress={handleSubmit} loading={submitting} fullWidth style={{ marginTop: spacing.md, marginBottom: spacing.lg }} />
    </BottomSheet>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Page header
  pageHeader: {
    // Fallback if LinearGradient ever fails — keeps the white header text
    // readable instead of white-on-white.
    backgroundColor: colors.heroStart,
    paddingTop: 52,
    paddingBottom: 20,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
    marginBottom: 16,
    ...shadow.hero,
  },
  headerLeft: { flex: 1 },
  pageTitle: { fontSize: 26, fontWeight: "800", color: colors.white, letterSpacing: -0.5 },
  headerMetaRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  headerBadge: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  headerBadgeWarning: { backgroundColor: "rgba(245,158,11,0.25)" },
  headerBadgeText: { fontSize: 11, fontWeight: "700", color: colors.white },
  addFab: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center", justifyContent: "center",
    ...shadow.sm,
  },

  // Search
  searchWrap: { paddingHorizontal: 16, marginBottom: 8 },
  searchRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingLeft: 12, ...shadow.sm },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, borderWidth: 0, shadowOpacity: 0, backgroundColor: "transparent" },

  list: { flex: 1, paddingHorizontal: 16 },
  errorBox: { backgroundColor: colors.dangerLight, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  errorText: { color: colors.danger, fontSize: 13 },

  // Card
  card: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    marginBottom: 12,
    overflow: "hidden",
    ...shadow.card,
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: spacing.md },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  cardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardTitleWrap: { flex: 1 },
  cardTitle: { ...typography.h4, color: colors.text },
  cardNiveau: { fontSize: 11, color: colors.primary, fontWeight: "600", marginTop: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 },
  metaText: { ...typography.caption, color: colors.textMuted, flex: 1 },
  cardActions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderLight },
  actionChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, borderWidth: 1 },
  actionChipText: { fontSize: 11, fontWeight: "700" },

  // Edit sheet internals reuse
  fieldLabel: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20, backgroundColor: colors.grayLight },
  chipActive: { backgroundColor: colors.primary },
  chipText: { ...typography.caption, color: colors.text },
  chipTextActive: { color: colors.white, fontWeight: "600" },
  fieldError: { ...typography.caption, color: colors.danger, marginTop: -spacing.sm, marginBottom: spacing.sm },
  accesMajeurBox: { flexDirection: "row", alignItems: "flex-start", backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: spacing.md, marginBottom: spacing.md },
  accesMajeurTitle: { ...typography.bodyBold, color: colors.text },
  accesMajeurSub: { ...typography.caption, color: colors.textMuted },
  offreBox: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: spacing.md, marginBottom: spacing.md },
  emptyOffresText: { ...typography.caption, color: colors.textMuted, fontStyle: "italic" },
  offreHint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  periodBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: "center", backgroundColor: colors.surface },
  periodBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  periodBtnText: { ...typography.caption, color: colors.text, fontWeight: "600" },
  periodBtnTextActive: { color: colors.white },
  reductionText: { ...typography.caption, color: colors.successDark, backgroundColor: colors.successLight, borderWidth: 1, borderColor: colors.successLight, borderRadius: 8, padding: spacing.sm, marginTop: spacing.sm, fontWeight: "700" },
});

export default AdminClassesBody;
