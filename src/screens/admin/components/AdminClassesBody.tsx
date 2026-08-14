import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { BottomSheet, Badge, Button, Card, EmptyState, Input, LoadingSpinner } from "../../../components/ui";
import PromptSheet from "../../../components/common/PromptSheet";
import PaymentModal from "../../../components/common/PaymentModal";
import ClassDetails from "../../professeurs/components/classes/ClassDetails";
import { UIClass, FormattedAccessRequest } from "../../professeurs/components/classes/DashboardClassesBody";
import { colors, spacing, typography } from "../../../styles/theme";
import { classAdminService, establishmentService, offerService } from "../../../services/api";
import { classService } from "../../../services/classService";
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

/** Fetches everything ClassDetails' Professeurs/Élèves/Parents/Utilisateurs/Demandes tabs need (members, access requests, moderator, establishment) for one class, on demand. */
const enrichClassForDetails = async (cls: ClassEntity): Promise<UIClass> => {
  const [classDetails, accessRequests, classUsers] = await Promise.all([
    classService.getClassDetails(cls.id),
    classService.getClassAccessRequests(cls.id).catch(() => []),
    classService.getClassUsers(cls.id).catch(() => []),
  ]);

  // GET /acceder/classes/{id}/utilisateurs returns UtilisateurSimpleDto — the
  // discriminator is `typeUtilisateur` (uppercase), not `type`/`admin` (neither
  // field exists on this endpoint's response).
  const students = classUsers.filter((u) => u.typeUtilisateur === "ELEVE");
  const parents = classUsers.filter((u) => u.typeUtilisateur === "PARENT");
  const professeurs = classUsers.filter((u) => u.typeUtilisateur === "PROFESSEUR" || u.typeUtilisateur === "REPETITEUR");
  const others = classUsers.filter((u) => u.typeUtilisateur === "UTILISATEUR" || !u.typeUtilisateur);

  const formattedAccessRequests: FormattedAccessRequest[] = (accessRequests || []).map((request: any) => ({
    id: request.id,
    name: `${request.utilisateurPrenom || ""} ${request.utilisateurNom || ""}`.trim(),
    role: "Utilisateur",
    date: request.dateDemande ? new Date(request.dateDemande).toLocaleDateString("fr-FR") : "",
    status: request.etat || "EN_ATTENTE",
  }));

  return {
    id: cls.id,
    name: classDetails.nom || cls.nom || "Nom non défini",
    level: classDetails.niveau || cls.niveau || "Niveau non défini",
    state: classDetails.etat === "ACTIF" ? "ACTIVE" : "INACTIVE",
    studentsCount: students.length,
    parentsCount: parents.length,
    professeursCount: professeurs.length,
    othersCount: others.length,
    creationDate: (classDetails as any).dateCreation || new Date().toISOString(),
    description: (classDetails as any).description || "",
    etablissement: (classDetails as any).etablissement?.nom || "Non spécifié",
    moderator: (classDetails as any).moderator
      ? `${(classDetails as any).moderator.prenom || ""} ${(classDetails as any).moderator.nom || ""}`.trim()
      : "Non spécifié",
    teacherRights: "Droit de publication",
    codeActivation: (classDetails as any).codeActivation || (cls as any).codeActivation,
    droitPublication: (classDetails as any).droitPublication || (classDetails as any).droit_publication || "PROFESSEURS_SEULEMENT",
    accesMajeur: !!(classDetails as any).accesMajeur,
    students: students.map((s) => ({
      id: s.id,
      name: `${s.prenom || ""} ${s.nom || ""}`.trim(),
      email: s.email || s.telephone || "Non spécifié",
      niveau: (s as any).niveau || "Non spécifié",
      dateCreation: (s as any).dateCreation || (s as any).creationDate,
      etat: (s as any).etat,
    })),
    parents: parents.map((p) => ({
      id: p.id,
      name: `${p.prenom || ""} ${p.nom || ""}`.trim(),
      phone: p.telephone || p.email || "Non spécifié",
      adresse: (p as any).adresse,
      dateCreation: (p as any).dateCreation || (p as any).creationDate,
      etat: (p as any).etat,
    })),
    professeurs,
    others,
    accessRequests: formattedAccessRequests,
    etablissementDetails: (classDetails as any).etablissement,
    moderatorDetails: (classDetails as any).moderator,
  };
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

interface CreateClassSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  creatorId?: string;
}

/**
 * Admin class creation — full parity with web's CreateClassContent.jsx:
 * niveau picker (fixed list, not free text), accesMajeur ("Classe Majeure")
 * toggle, établissement-conditional codeUnique field, and — when no
 * établissement is chosen — a required Offre/Forfait + périodicité selector
 * that routes through the same PaymentModal used for offer renewals.
 */
const CreateClassSheet = ({ visible, onClose, onCreated, creatorId }: CreateClassSheetProps) => {
  const [nom, setNom] = useState("");
  const [niveau, setNiveau] = useState("");
  const [accesMajeur, setAccesMajeur] = useState(false);
  const [establishments, setEstablishments] = useState<Etablissement[]>([]);
  const [etablissementId, setEtablissementId] = useState<string | null>(null);
  const [codeUnique, setCodeUnique] = useState("");
  const [offres, setOffres] = useState<Offre[]>([]);
  const [selectedOffreId, setSelectedOffreId] = useState<string | null>(null);
  const [periodicite, setPeriodicite] = useState<"MENSUEL" | "ANNUEL">("MENSUEL");
  const [showPayment, setShowPayment] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedEstablishment = establishments.find((e) => e.id === etablissementId) || null;
  const selectedOffre = offres.find((o) => o.id === selectedOffreId) || null;
  const offreReduction = calculerReduction(selectedOffre);
  const montant = selectedOffre
    ? Number(periodicite === "ANNUEL" ? selectedOffre.prixAnnuel : selectedOffre.prixMensuel) || 0
    : 0;

  useEffect(() => {
    if (!visible) return;
    setNom("");
    setNiveau("");
    setAccesMajeur(false);
    setEtablissementId(null);
    setCodeUnique("");
    setSelectedOffreId(null);
    setPeriodicite("MENSUEL");
    setErrors({});
    establishmentService.getAll().then(setEstablishments).catch(() => setEstablishments([]));
    offerService.list("CLASSE").then(setOffres).catch(() => setOffres([]));
  }, [visible]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!nom.trim()) errs.nom = "Le nom de la classe est requis";
    if (!niveau) errs.niveau = "Le niveau est requis";
    if (etablissementId && selectedEstablishment?.optionTokenGeneral && !codeUnique.trim()) {
      errs.codeUnique = "Le code unique de l'établissement est requis";
    }
    // Unlike the professor/gestionnaire-facing web form, admin isn't required to pick
    // (and pay for) an offer to create a standalone class — admin can always assign one
    // later, sans paiement, from OffreInfoPanel. The offer selector below stays available
    // for when an admin does want to test/set up a paid plan at creation time.
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const doCreate = async (paymentInfo?: PaymentInfo) => {
    if (!creatorId) {
      Alert.alert("Erreur", "Utilisateur non identifié.");
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        nom: nom.trim(),
        niveau,
        creatorId,
        moderatorId: creatorId,
        accesMajeur,
      };
      if (etablissementId) {
        payload.etablissementId = etablissementId;
        if (selectedEstablishment?.optionTokenGeneral && codeUnique) payload.codeUnique = codeUnique;
      } else if (paymentInfo) {
        payload.paymentInfo = paymentInfo;
        payload.offreId = selectedOffreId;
        payload.periodicite = periodicite;
      }
      await classService.createNewClass(payload as Parameters<typeof classService.createNewClass>[0]);
      Alert.alert("Succès", "Classe créée avec succès.");
      onCreated();
      onClose();
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la création.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (!validate()) return;
    if (selectedOffreId) {
      setShowPayment(true);
    } else {
      doCreate();
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Nouvelle classe">
      <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
        <Input label="Nom de la classe *" value={nom} onChangeText={setNom} placeholder="Ex: 3ème A" />
        {errors.nom ? <Text style={styles.fieldError}>{errors.nom}</Text> : null}

        <Text style={styles.fieldLabel}>Niveau *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
          <View style={styles.chipRow}>
            {NIVEAUX.map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.chip, niveau === n && styles.chipActive]}
                onPress={() => setNiveau(n)}
              >
                <Text style={[styles.chipText, niveau === n && styles.chipTextActive]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        {errors.niveau ? <Text style={styles.fieldError}>{errors.niveau}</Text> : null}

        <TouchableOpacity style={styles.accesMajeurBox} onPress={() => setAccesMajeur((v) => !v)}>
          <FontAwesome5
            name={accesMajeur ? "check-square" : "square"}
            size={18}
            color={accesMajeur ? colors.primary : colors.textMuted}
          />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={styles.accesMajeurTitle}>Classe Majeure</Text>
            <Text style={styles.accesMajeurSub}>Les élèves rejoignent par recherche d'email</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.fieldLabel}>Établissement (optionnel)</Text>
        <View style={styles.chipRow}>
          <TouchableOpacity
            style={[styles.chip, !etablissementId && styles.chipActive]}
            onPress={() => setEtablissementId(null)}
          >
            <Text style={[styles.chipText, !etablissementId && styles.chipTextActive]}>Aucun</Text>
          </TouchableOpacity>
          {establishments.map((est) => (
            <TouchableOpacity
              key={est.id}
              style={[styles.chip, etablissementId === est.id && styles.chipActive]}
              onPress={() => setEtablissementId(est.id)}
            >
              <Text style={[styles.chipText, etablissementId === est.id && styles.chipTextActive]}>{est.nom}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {etablissementId && selectedEstablishment?.optionTokenGeneral && (
          <>
            <Input
              label="Code Unique de l'établissement *"
              value={codeUnique}
              onChangeText={setCodeUnique}
              placeholder="ABC123"
              autoCapitalize="characters"
            />
            {errors.codeUnique ? <Text style={styles.fieldError}>{errors.codeUnique}</Text> : null}
          </>
        )}

        {!etablissementId && (
          <View style={styles.offreBox}>
            <Text style={styles.fieldLabel}>Offre / Forfait (optionnel)</Text>
            <Text style={styles.offreHint}>
              Sans forfait, la classe est créée directement, sans restriction — vous pourrez lui en associer un plus
              tard.
            </Text>
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, !selectedOffreId && styles.chipActive]}
                onPress={() => setSelectedOffreId(null)}
              >
                <Text style={[styles.chipText, !selectedOffreId && styles.chipTextActive]}>Aucune</Text>
              </TouchableOpacity>
              {offres.length === 0 ? (
                <Text style={styles.emptyOffresText}>Aucune offre disponible</Text>
              ) : (
                offres.map((o) => {
                  const prix =
                    o.prixMensuel != null
                      ? `${Number(o.prixMensuel).toLocaleString("fr-FR")} FCFA/mois`
                      : o.prixAnnuel != null
                      ? `${Number(o.prixAnnuel).toLocaleString("fr-FR")} FCFA/an`
                      : "";
                  return (
                    <TouchableOpacity
                      key={o.id}
                      style={[styles.chip, selectedOffreId === o.id && styles.chipActive]}
                      onPress={() => {
                        setSelectedOffreId(o.id);
                        if (periodicite === "ANNUEL" && o.prixAnnuel == null) setPeriodicite("MENSUEL");
                      }}
                    >
                      <Text style={[styles.chipText, selectedOffreId === o.id && styles.chipTextActive]}>
                        {o.nom}
                        {prix ? ` — ${prix}` : ""}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
            {errors.offre ? <Text style={styles.fieldError}>{errors.offre}</Text> : null}

            {selectedOffre && (
              <>
                <Text style={[styles.fieldLabel, { marginTop: spacing.sm }]}>Périodicité</Text>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <TouchableOpacity
                    style={[styles.periodBtn, periodicite === "MENSUEL" && styles.periodBtnActive]}
                    disabled={selectedOffre.prixMensuel == null}
                    onPress={() => setPeriodicite("MENSUEL")}
                  >
                    <Text style={[styles.periodBtnText, periodicite === "MENSUEL" && styles.periodBtnTextActive]}>
                      Mensuel{selectedOffre.prixMensuel != null ? ` - ${Number(selectedOffre.prixMensuel).toLocaleString("fr-FR")} FCFA` : ""}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.periodBtn, periodicite === "ANNUEL" && styles.periodBtnActive]}
                    disabled={selectedOffre.prixAnnuel == null}
                    onPress={() => setPeriodicite("ANNUEL")}
                  >
                    <Text style={[styles.periodBtnText, periodicite === "ANNUEL" && styles.periodBtnTextActive]}>
                      Annuel{selectedOffre.prixAnnuel != null ? ` - ${Number(selectedOffre.prixAnnuel).toLocaleString("fr-FR")} FCFA` : ""}
                    </Text>
                  </TouchableOpacity>
                </View>
                {periodicite === "ANNUEL" && offreReduction != null && offreReduction > 0 && (
                  <Text style={styles.reductionText}>
                    🎉 Réduction de {Math.round(offreReduction * 100)}% pour l'offre annuelle !
                  </Text>
                )}
              </>
            )}
          </View>
        )}

        <Button
          label={selectedOffreId ? `Procéder au paiement (${montant.toLocaleString("fr-FR")} FCFA)` : "Créer"}
          onPress={handleSubmit}
          loading={submitting}
          fullWidth
          style={{ marginTop: spacing.md, marginBottom: spacing.lg }}
        />
      </ScrollView>

      <PaymentModal
        visible={showPayment}
        onClose={() => setShowPayment(false)}
        onSuccess={(info) => {
          setShowPayment(false);
          doCreate(info);
        }}
        montant={montant}
        label={selectedOffre?.nom || "Création de classe"}
        subLabel={selectedOffre ? (periodicite === "ANNUEL" ? "Périodicité annuelle" : "Périodicité mensuelle") : ""}
      />
    </BottomSheet>
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
      <Input label="Niveau" value={niveau} onChangeText={setNiveau} placeholder="Ex: Collège" />
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
