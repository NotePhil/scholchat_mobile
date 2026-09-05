import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Badge, Button, LoadingSpinner } from "../../components/ui";
import OffreInfoPanel from "../../components/common/OffreInfoPanel";
import CreateEstablishmentSheet from "../admin/components/CreateEstablishmentSheet";
import CreateClassSheet from "../admin/components/CreateClassSheet";
import ClassDetails from "../professeurs/components/classes/ClassDetails";
import { UIClass, enrichClassForDetails } from "../professeurs/components/classes/DashboardClassesBody";
import { colors, radius, spacing, typography } from "../../styles/theme";
import { classAdminService, establishmentService } from "../../services/api";
import { classService } from "../../services/classService";
import { ClassEntity, Etablissement, Gestionnaire } from "../../types";

type Tab = "classes" | "professeurs" | "settings" | "info";

interface EstablishmentDetailsProps {
  establishmentId: string;
  onBack: () => void;
}

/**
 * Mirrors scholchat_front's real ManageEstablishmentDetailsView.jsx:
 * - General Info + Gestionnaire + OffreInfoPanel
 * - Classes tab with:
 *   - Create class button for this establishment
 *   - Class list with status badges
 *   - Full ClassDetails inspection (9 tabs) on tap or "Gérer"
 *   - Approve / Reject for pending classes
 *   - Activate / Deactivate toggle
 *   - Delete class
 * - Professeurs tab:
 *   - List with class count, details alert on tap
 * - Paramètres tab:
 *   - optionEnvoiMailNewClasse toggle
 *   - optionTokenGeneral toggle
 *   - Save settings
 * - Informations Système tab
 */
const EstablishmentDetails = ({ establishmentId, onBack }: EstablishmentDetailsProps) => {
  const [establishment, setEstablishment] = useState<Etablissement | null>(null);
  const [gestionnaire, setGestionnaire] = useState<Gestionnaire | null>(null);
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [tab, setTab] = useState<Tab>("classes");

  // Managing a class inside establishment
  const [managedClass, setManagedClass] = useState<ClassEntity | null>(null);
  const [selectedUIClass, setSelectedUIClass] = useState<UIClass | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState("overview");
  const [managingClass, setManagingClass] = useState(false);

  // Settings tab form state
  const [optionEnvoiMail, setOptionEnvoiMail] = useState(false);
  const [optionTokenGeneral, setOptionTokenGeneral] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const load = useCallback(async (silent?: boolean) => {
    if (!silent) setLoading(true);
    try {
      const [est, allClasses] = await Promise.all([
        establishmentService.getById(establishmentId),
        classAdminService.getAll().catch(() => []),
      ]);
      setEstablishment(est);
      setOptionEnvoiMail(!!est.optionEnvoiMailNewClasse);
      setOptionTokenGeneral(!!est.optionTokenGeneral);
      setClasses(allClasses.filter((c) => c.etablissement?.id === establishmentId));
      establishmentService
        .getGestionnaire(establishmentId)
        .then(setGestionnaire)
        .catch(() => setGestionnaire(null));
    } finally {
      setLoading(false);
    }
  }, [establishmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  const handleDelete = () => {
    Alert.alert(
      "Supprimer l'établissement",
      "Êtes-vous sûr de vouloir supprimer cet établissement ? Cette action est irréversible.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await establishmentService.remove(establishmentId);
              onBack();
            } catch (err) {
              Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la suppression.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleOpenClass = async (cls: ClassEntity) => {
    setManagedClass(cls);
    setActiveDetailTab("overview");
    setManagingClass(true);
    try {
      const enriched = await enrichClassForDetails(cls);
      setSelectedUIClass(enriched);
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Impossible de charger les détails de la classe.");
      setManagedClass(null);
    } finally {
      setManagingClass(false);
    }
  };

  const handleApproveClass = async (cls: ClassEntity) => {
    try {
      await establishmentService.approveClass(cls.id, establishmentId);
      Alert.alert("Succès", `Classe "${cls.nom}" approuvée.`);
      load(true);
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de l'approbation.");
    }
  };

  const handleRejectClass = async (cls: ClassEntity) => {
    try {
      await establishmentService.rejectClass(cls.id, establishmentId);
      Alert.alert("Succès", `Classe "${cls.nom}" rejetée.`);
      load(true);
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec du rejet.");
    }
  };

  const handleToggleClassState = async (cls: ClassEntity) => {
    const isActif = cls.etat === "ACTIF" || cls.etat === "ACTIVE";
    const newEtat = isActif ? "INACTIF" : "ACTIF";
    try {
      await classAdminService.update(cls.id, { etat: newEtat });
      Alert.alert("Succès", `Classe passée à l'état ${newEtat}.`);
      load(true);
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la mise à jour.");
    }
  };

  const handleDeleteClass = (cls: ClassEntity) => {
    Alert.alert("Supprimer la classe", `Supprimer définitivement la classe "${cls.nom}" ?`, [
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

  const handleSaveSettings = async () => {
    if (!establishment) return;
    setSavingSettings(true);
    try {
      await establishmentService.update(establishmentId, {
        nom: establishment.nom,
        localisation: establishment.localisation,
        pays: establishment.pays,
        email: establishment.email,
        telephone: establishment.telephone,
        optionEnvoiMailNewClasse: optionEnvoiMail,
        optionTokenGeneral: optionTokenGeneral,
      });
      Alert.alert("Succès", "Paramètres de l'établissement enregistrés avec succès.");
      load(true);
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de l'enregistrement des paramètres.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleProfessorPress = (p: {
    id: string;
    nom?: string;
    prenom?: string;
    email?: string;
    telephone?: string;
    etat?: string;
    count: number;
  }) => {
    const name = `${p.prenom ?? ""} ${p.nom ?? ""}`.trim();
    Alert.alert(
      name || "Professeur",
      `Email : ${p.email || "Non renseigné"}\nTéléphone : ${p.telephone || "Non renseigné"}\nClasses modérées : ${p.count}\nStatut : ${p.etat || "ACTIF"}`,
      [{ text: "Fermer" }]
    );
  };

  const professeurs = useMemo(() => {
    const seen = new Map<
      string,
      { id: string; nom?: string; prenom?: string; email?: string; telephone?: string; etat?: string; count: number }
    >();
    classes.forEach((c) => {
      const mod = (c as any).moderator;
      if (!mod?.id) return;
      const existing = seen.get(mod.id);
      if (existing) existing.count += 1;
      else
        seen.set(mod.id, {
          id: mod.id,
          nom: mod.nom,
          prenom: mod.prenom,
          email: mod.email,
          telephone: mod.telephone,
          etat: mod.etat,
          count: 1,
        });
    });
    return Array.from(seen.values());
  }, [classes]);

  if (loading || !establishment) {
    return <LoadingSpinner label="Chargement de l'établissement..." fullScreen />;
  }

  // If viewing a class's full details modal
  if (managedClass) {
    if (managingClass || !selectedUIClass) {
      return <LoadingSpinner label="Chargement des détails de la classe..." fullScreen />;
    }
    return (
      <ClassDetails
        selectedClass={selectedUIClass}
        onBack={() => {
          setManagedClass(null);
          setSelectedUIClass(null);
          load(true);
        }}
        activeDetailTab={activeDetailTab}
        setActiveDetailTab={setActiveDetailTab}
        onRefresh={async () => {
          if (!managedClass) return;
          const fresh = await enrichClassForDetails(managedClass);
          setSelectedUIClass(fresh);
        }}
      />
    );
  }

  const classesActives = classes.filter((c) => c.etat === "ACTIF" || c.etat === "ACTIVE").length;
  const classesEnAttente = classes.filter((c) => c.etat === "EN_ATTENTE_APPROBATION").length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <FontAwesome5 name="arrow-left" size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerEyebrow}>Gestion de l'établissement</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {establishment.nom}
            </Text>
          </View>
        </View>
        <View style={styles.headerActionsRow}>
          <TouchableOpacity style={styles.headerActionBtn} onPress={handleRefresh} disabled={refreshing}>
            <FontAwesome5 name="sync-alt" size={13} color={colors.textMuted} />
            <Text style={styles.headerActionText}>Actualiser</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerActionBtn, styles.headerActionBtnPrimary]}
            onPress={() => setShowEdit(true)}
          >
            <FontAwesome5 name="edit" size={13} color={colors.white} />
            <Text style={[styles.headerActionText, styles.headerActionTextPrimary]}>Modifier</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerActionBtn, styles.headerActionBtnDanger]}
            onPress={handleDelete}
            disabled={deleting}
          >
            <FontAwesome5 name="trash" size={13} color={colors.white} />
            <Text style={[styles.headerActionText, styles.headerActionTextPrimary]}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Establishment Info Card */}
        <View style={styles.card}>
          <Row icon="school" label="Nom" value={establishment.nom} />
          <Row icon="map-marker-alt" label="Localisation" value={establishment.localisation || "N/A"} />
          <Row icon="globe" label="Pays" value={establishment.pays || "N/A"} />
          <Row icon="envelope" label="Email" value={establishment.email || "N/A"} />
          <Row icon="phone" label="Téléphone" value={establishment.telephone || "N/A"} />
          {establishment.codeUnique ? (
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>Code Unique</Text>
              <Text style={styles.codeValue}>{establishment.codeUnique}</Text>
            </View>
          ) : null}
        </View>

        {/* Gestionnaire Card */}
        {gestionnaire ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Gestionnaire</Text>
            <Row icon="user" label="Nom" value={`${gestionnaire.prenom ?? ""} ${gestionnaire.nom ?? ""}`.trim()} />
            <Row icon="envelope" label="Email" value={gestionnaire.email || "N/A"} />
            <Row icon="phone" label="Téléphone" value={gestionnaire.telephone || "N/A"} />
          </View>
        ) : null}

        {/* Offre / Forfait Info */}
        <View style={{ marginBottom: spacing.md }}>
          <OffreInfoPanel type="ETABLISSEMENT" entityId={establishmentId} />
        </View>

        {/* 4 Tabs matching Web */}
        <View style={styles.tabsRow}>
          <TabButton
            active={tab === "classes"}
            label={`Classes (${classes.length})`}
            onPress={() => setTab("classes")}
          />
          <TabButton
            active={tab === "professeurs"}
            label={`Profs (${professeurs.length})`}
            onPress={() => setTab("professeurs")}
          />
          <TabButton
            active={tab === "settings"}
            label="Paramètres"
            onPress={() => setTab("settings")}
          />
          <TabButton
            active={tab === "info"}
            label="Infos"
            onPress={() => setTab("info")}
          />
        </View>

        {/* Classes Tab */}
        {tab === "classes" && (
          <View>
            <TouchableOpacity
              style={styles.addClassButton}
              onPress={() => setShowCreateClass(true)}
            >
              <FontAwesome5 name="plus-circle" size={15} color={colors.white} />
              <Text style={styles.addClassButtonText}>Créer une classe pour cet établissement</Text>
            </TouchableOpacity>

            <View style={styles.card}>
              {classes.length === 0 ? (
                <Text style={styles.emptyText}>Aucune classe dans cet établissement</Text>
              ) : (
                classes.map((c) => {
                  const isPending = c.etat === "EN_ATTENTE_APPROBATION";
                  const isActif = c.etat === "ACTIF" || c.etat === "ACTIVE";
                  return (
                    <View key={c.id} style={styles.classItemContainer}>
                      <TouchableOpacity
                        style={styles.classItemHeader}
                        activeOpacity={0.7}
                        onPress={() => handleOpenClass(c)}
                      >
                        <View style={styles.listItemAvatar}>
                          <FontAwesome5 name="chalkboard" size={13} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.listItemName}>{c.nom}</Text>
                          <Text style={styles.listItemMeta}>
                            {c.niveau ?? ""}
                            {(c as any).codeActivation ? ` • Code: ${(c as any).codeActivation}` : ""}
                            {(c as any).dateCreation
                              ? ` • ${new Date((c as any).dateCreation).toLocaleDateString("fr-FR")}`
                              : ""}
                          </Text>
                          <View style={{ marginTop: 4, flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Badge
                              label={isActif ? "Actif" : isPending ? "En attente" : c.etat || "Inactif"}
                              tone={isActif ? "success" : isPending ? "warning" : "danger"}
                            />
                            {(c as any).accesMajeur && (
                              <Badge label="Majeure" tone="info" />
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>

                      {/* Class Card Actions */}
                      <View style={styles.classActionsRow}>
                        <TouchableOpacity
                          style={[styles.smallActionBtn, styles.smallActionBtnPrimary]}
                          onPress={() => handleOpenClass(c)}
                        >
                          <FontAwesome5 name="cog" size={11} color={colors.white} />
                          <Text style={[styles.smallActionText, { color: colors.white }]}>Gérer</Text>
                        </TouchableOpacity>

                        {isPending && (
                          <>
                            <TouchableOpacity
                              style={[styles.smallActionBtn, styles.smallActionBtnSuccess]}
                              onPress={() => handleApproveClass(c)}
                            >
                              <FontAwesome5 name="check" size={11} color={colors.white} />
                              <Text style={[styles.smallActionText, { color: colors.white }]}>Approuver</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.smallActionBtn, styles.smallActionBtnDanger]}
                              onPress={() => handleRejectClass(c)}
                            >
                              <FontAwesome5 name="times" size={11} color={colors.white} />
                              <Text style={[styles.smallActionText, { color: colors.white }]}>Rejeter</Text>
                            </TouchableOpacity>
                          </>
                        )}

                        <TouchableOpacity
                          style={[styles.smallActionBtn, isActif ? styles.smallActionBtnWarning : styles.smallActionBtnSuccess]}
                          onPress={() => handleToggleClassState(c)}
                        >
                          <FontAwesome5 name={isActif ? "pause" : "play"} size={11} color={colors.white} />
                          <Text style={[styles.smallActionText, { color: colors.white }]}>
                            {isActif ? "Désactiver" : "Activer"}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.smallActionBtn, styles.smallActionBtnDangerOutline]}
                          onPress={() => handleDeleteClass(c)}
                        >
                          <FontAwesome5 name="trash" size={11} color={colors.danger} />
                          <Text style={[styles.smallActionText, { color: colors.danger }]}>Supprimer</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        )}

        {/* Professeurs Tab */}
        {tab === "professeurs" && (
          <View style={styles.card}>
            {professeurs.length === 0 ? (
              <Text style={styles.emptyText}>Aucun professeur dans cet établissement</Text>
            ) : (
              professeurs.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.listItem}
                  activeOpacity={0.7}
                  onPress={() => handleProfessorPress(p)}
                >
                  <View style={styles.listItemAvatar}>
                    <FontAwesome5 name="chalkboard-teacher" size={13} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listItemName}>{`${p.prenom ?? ""} ${p.nom ?? ""}`.trim()}</Text>
                    <Text style={styles.listItemMeta}>
                      {p.email ?? ""}
                      {p.telephone ? ` • ${p.telephone}` : ""} • {p.count} classe{p.count > 1 ? "s" : ""} modérée{p.count > 1 ? "s" : ""}
                    </Text>
                    {p.etat ? (
                      <View style={{ marginTop: 4 }}>
                        <Badge
                          label={p.etat === "ACTIF" || p.etat === "ACTIVE" ? "Actif" : "Inactif"}
                          tone={p.etat === "ACTIF" || p.etat === "ACTIVE" ? "success" : "danger"}
                        />
                      </View>
                    ) : null}
                  </View>
                  <FontAwesome5 name="chevron-right" size={12} color={colors.textMuted} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Paramètres Tab */}
        {tab === "settings" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Paramètres du système</Text>
            <View style={styles.switchRow}>
              <View style={{ flex: 1, paddingRight: spacing.md }}>
                <Text style={styles.switchLabel}>Notifier par e-mail</Text>
                <Text style={styles.switchSub}>
                  Envoyer un email automatique lors de la création d'une nouvelle classe.
                </Text>
              </View>
              <Switch
                value={optionEnvoiMail}
                onValueChange={setOptionEnvoiMail}
                trackColor={{ false: colors.grayLight, true: colors.primary }}
              />
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1, paddingRight: spacing.md }}>
                <Text style={styles.switchLabel}>Token général d'établissement</Text>
                <Text style={styles.switchSub}>
                  Exiger le code unique de l'établissement pour la création de classes.
                </Text>
              </View>
              <Switch
                value={optionTokenGeneral}
                onValueChange={setOptionTokenGeneral}
                trackColor={{ false: colors.grayLight, true: colors.primary }}
              />
            </View>

            <Button
              label="Enregistrer les paramètres"
              onPress={handleSaveSettings}
              loading={savingSettings}
              fullWidth
              style={{ marginTop: spacing.md }}
            />
          </View>
        )}

        {/* Infos Système Tab */}
        {tab === "info" && (
          <View style={styles.card}>
            <Row icon="fingerprint" label="ID" value={establishment.id} mono />
            <Row
              icon="calendar-alt"
              label="Date de création"
              value={establishment.dateCreation ? new Date(establishment.dateCreation).toLocaleDateString("fr-FR") : "N/A"}
            />
            <Row icon="key" label="Code Unique" value={establishment.codeUnique || "Non défini"} mono />
            <Row icon="chalkboard" label="Total Classes" value={String(classes.length)} />
            <Row icon="check-circle" label="Classes Actives" value={String(classesActives)} />
            <Row icon="clock" label="Classes en Attente" value={String(classesEnAttente)} />
            <Row icon="chalkboard-teacher" label="Total Professeurs" value={String(professeurs.length)} />
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Edit Establishment Modal */}
      <CreateEstablishmentSheet
        visible={showEdit}
        onClose={() => setShowEdit(false)}
        onCreated={() => load(true)}
        editingEstablishment={establishment}
      />

      {/* Create Class for this Establishment Modal */}
      <CreateClassSheet
        visible={showCreateClass}
        onClose={() => setShowCreateClass(false)}
        onCreated={() => load(true)}
        creatorId={gestionnaire?.id}
        defaultEstablishmentId={establishment.id}
        lockEstablishment
      />
    </View>
  );
};

const Row = ({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ComponentProps<typeof FontAwesome5>["name"];
  label: string;
  value?: string;
  mono?: boolean;
}) => (
  <View style={styles.row}>
    <View style={styles.rowIcon}>
      <FontAwesome5 name={icon} size={12} color={colors.textMuted} />
    </View>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={[styles.rowValue, mono && { fontFamily: "monospace" }]} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

const TabButton = ({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) => (
  <TouchableOpacity style={[styles.tabButton, active && styles.tabButtonActive]} onPress={onPress}>
    <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]} numberOfLines={1}>
      {label}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  headerTopRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerEyebrow: { ...typography.caption, color: colors.textMuted },
  headerTitle: { ...typography.h3, color: colors.text },
  headerActionsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  headerActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerActionBtnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  headerActionBtnDanger: { backgroundColor: colors.danger, borderColor: colors.danger },
  headerActionText: { ...typography.caption, fontWeight: "700", color: colors.textMuted },
  headerActionTextPrimary: { color: colors.white },
  content: { flex: 1, padding: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 7, gap: spacing.sm },
  rowIcon: { width: 20, alignItems: "center" },
  rowLabel: { ...typography.caption, color: colors.textMuted, width: 100 },
  rowValue: { ...typography.caption, color: colors.text, fontWeight: "600", flex: 1, textAlign: "right" },
  codeBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  codeLabel: { ...typography.caption, color: colors.primary },
  codeValue: { ...typography.bodyBold, color: colors.primary, fontFamily: "monospace" },
  tabsRow: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.md },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  tabButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabButtonText: { ...typography.caption, color: colors.text, fontWeight: "600", fontSize: 11 },
  tabButtonTextActive: { color: colors.white },
  emptyText: { ...typography.caption, color: colors.textMuted, textAlign: "center", paddingVertical: spacing.lg },
  addClassButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  addClassButtonText: { ...typography.bodyBold, color: colors.white },
  classItemContainer: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  classItemHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  classActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: spacing.sm,
    paddingLeft: 40,
  },
  smallActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  smallActionBtnPrimary: { backgroundColor: colors.primary },
  smallActionBtnSuccess: { backgroundColor: colors.success },
  smallActionBtnDanger: { backgroundColor: colors.danger },
  smallActionBtnDangerOutline: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.danger },
  smallActionBtnWarning: { backgroundColor: colors.warning },
  smallActionText: { ...typography.caption, fontSize: 11, fontWeight: "600" },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  listItemAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  listItemName: { ...typography.bodyBold, color: colors.text, fontSize: 13 },
  listItemMeta: { ...typography.caption, color: colors.textMuted, marginTop: 1 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  switchLabel: { ...typography.bodyBold, color: colors.text },
  switchSub: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
});

export default EstablishmentDetails;
