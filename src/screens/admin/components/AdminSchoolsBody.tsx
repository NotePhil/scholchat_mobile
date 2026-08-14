import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Badge, BottomSheet, Button, Card, EmptyState, Input, LoadingSpinner } from "../../../components/ui";
import PaymentModal from "../../../components/common/PaymentModal";
import { colors, spacing, typography } from "../../../styles/theme";
import { establishmentService, gestionnaireService, offerService } from "../../../services/api";
import { PaymentInfo } from "../../../services/api/contratService";
import { Etablissement, Gestionnaire, Offre } from "../../../types";
import EstablishmentDetails from "../../establishment/EstablishmentDetails";

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

type Segment = "etablissements" | "offres";

interface AdminSchoolsBodyProps {
  initialSegment?: Segment;
  /** When true, opens the create sheet immediately — used by the "Créer un Établissement" quick action so it lands on the actual form instead of the plain list. */
  autoCreate?: boolean;
}

const AdminSchoolsBody = ({ initialSegment = "etablissements", autoCreate }: AdminSchoolsBodyProps) => {
  const [segment, setSegment] = useState<Segment>(initialSegment);
  const [establishments, setEstablishments] = useState<Etablissement[]>([]);
  const [offres, setOffres] = useState<Offre[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(!!autoCreate);
  const [managedEstId, setManagedEstId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingEstablishment, setEditingEstablishment] = useState<Etablissement | null>(null);
  const [editingOffre, setEditingOffre] = useState<Offre | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (segment === "etablissements") setEstablishments(await establishmentService.getAll());
      else setOffres(await offerService.list(undefined, true));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du chargement.");
    } finally {
      setLoading(false);
    }
  }, [segment]);

  useEffect(() => {
    load();
  }, [load]);

  // Re-sync when reached again via a quick-action targeting a different segment (component instance persists across tab switches).
  useEffect(() => {
    setSegment(initialSegment);
  }, [initialSegment]);

  useEffect(() => {
    if (autoCreate) setShowCreate(true);
  }, [autoCreate]);

  if (managedEstId) {
    return <EstablishmentDetails establishmentId={managedEstId} onBack={() => setManagedEstId(null)} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Écoles & Configuration</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)} style={styles.addButton}>
          <FontAwesome5 name="plus" size={14} color={colors.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.segmentRow}>
        {(
          [
            { id: "etablissements", label: "Établissements" },
            { id: "offres", label: "Offres" },
          ] as { id: Segment; label: string }[]
        ).map((seg) => (
          <TouchableOpacity
            key={seg.id}
            style={[styles.segment, segment === seg.id && styles.segmentActive]}
            onPress={() => setSegment(seg.id)}
          >
            <Text style={[styles.segmentText, segment === seg.id && styles.segmentTextActive]}>{seg.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {segment === "etablissements" && (
        <View style={styles.searchWrap}>
          <Input placeholder="Rechercher un établissement..." value={searchTerm} onChangeText={setSearchTerm} />
        </View>
      )}

      <ScrollView style={styles.list}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? (
          <LoadingSpinner label="Chargement..." />
        ) : segment === "etablissements" ? (
          (() => {
            const term = searchTerm.trim().toLowerCase();
            const filtered = term
              ? establishments.filter(
                  (e) =>
                    (e.nom ?? "").toLowerCase().includes(term) ||
                    (e.localisation ?? "").toLowerCase().includes(term) ||
                    (e.pays ?? "").toLowerCase().includes(term) ||
                    (e.email ?? "").toLowerCase().includes(term)
                )
              : establishments;
            return filtered.length === 0 ? (
              <EmptyState icon="school" title={term ? "Aucun résultat" : "Aucun établissement"} />
            ) : (
              filtered.map((e) => (
                <Card key={e.id} style={styles.estCard}>
                  <TouchableOpacity activeOpacity={0.7} onPress={() => setManagedEstId(e.id)}>
                    <View style={styles.estCardHeader}>
                      <Text style={styles.estCardTitle} numberOfLines={1}>
                        {e.nom ?? "Établissement"}
                      </Text>
                      {(e as any).expireParOffre ? <Badge label="Offre expirée" tone="danger" /> : null}
                    </View>
                    {e.localisation ? (
                      <View style={styles.estInfoRow}>
                        <FontAwesome5 name="map-marker-alt" size={11} color={colors.textMuted} />
                        <Text style={styles.estInfoText} numberOfLines={1}>{e.localisation}</Text>
                      </View>
                    ) : null}
                    {e.pays ? (
                      <View style={styles.estInfoRow}>
                        <FontAwesome5 name="globe" size={11} color={colors.textMuted} />
                        <Text style={styles.estInfoText} numberOfLines={1}>{e.pays}</Text>
                      </View>
                    ) : null}
                    {e.email ? (
                      <View style={styles.estInfoRow}>
                        <FontAwesome5 name="envelope" size={11} color={colors.textMuted} />
                        <Text style={styles.estInfoText} numberOfLines={1}>{e.email}</Text>
                      </View>
                    ) : null}
                    {e.telephone ? (
                      <View style={styles.estInfoRow}>
                        <FontAwesome5 name="phone" size={11} color={colors.textMuted} />
                        <Text style={styles.estInfoText} numberOfLines={1}>{e.telephone}</Text>
                      </View>
                    ) : null}
                    {(e.optionEnvoiMailNewClasse || e.optionTokenGeneral) && (
                      <View style={styles.estBadgeRow}>
                        {e.optionEnvoiMailNewClasse ? <Badge label="Email Classes" tone="success" /> : null}
                        {e.optionTokenGeneral ? <Badge label="Code Unique" tone="info" /> : null}
                      </View>
                    )}
                  </TouchableOpacity>

                  <View style={styles.estActions}>
                    <TouchableOpacity style={styles.estActionBtn} onPress={() => setManagedEstId(e.id)}>
                      <FontAwesome5 name="eye" size={13} color={colors.primary} />
                      <Text style={[styles.estActionText, { color: colors.primary }]}>Voir</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.estActionBtn} onPress={() => setEditingEstablishment(e)}>
                      <FontAwesome5 name="edit" size={13} color={colors.success} />
                      <Text style={[styles.estActionText, { color: colors.success }]}>Modifier</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.estActionBtn}
                      onPress={() =>
                        Alert.alert("Supprimer", `Supprimer "${e.nom}" ?`, [
                          { text: "Annuler", style: "cancel" },
                          {
                            text: "Supprimer",
                            style: "destructive",
                            onPress: async () => {
                              try {
                                await establishmentService.remove(e.id);
                                setEstablishments((prev) => prev.filter((x) => x.id !== e.id));
                              } catch (err) {
                                Alert.alert("Erreur", err instanceof Error ? err.message : "Échec.");
                              }
                            },
                          },
                        ])
                      }
                    >
                      <FontAwesome5 name="trash" size={13} color={colors.danger} />
                      <Text style={[styles.estActionText, { color: colors.danger }]}>Supprimer</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              ))
            );
          })()
        ) : offres.length === 0 ? (
          <EmptyState icon="tags" title="Aucune offre" />
        ) : (
          offres.map((o) => {
            const isEtab = o.cible === "ETABLISSEMENT";
            return (
              <Card key={o.id} style={styles.estCard}>
                <View style={styles.estCardHeader}>
                  <Text style={styles.estCardTitle} numberOfLines={1}>
                    {o.nom ?? "Offre"}
                  </Text>
                  {(o as any).estTest ? <Badge label="TEST" tone="warning" /> : null}
                  <Badge label={o.actif ? "Active" : "Désactivée"} tone={o.actif ? "success" : "neutral"} />
                </View>
                <View style={styles.estInfoRow}>
                  <FontAwesome5 name={isEtab ? "school" : "chalkboard"} size={11} color={colors.textMuted} />
                  <Text style={styles.estInfoText}>{isEtab ? "Établissement" : "Classe indépendante"}</Text>
                </View>
                <View style={styles.estInfoRow}>
                  <FontAwesome5 name="calendar-day" size={11} color={colors.textMuted} />
                  <Text style={styles.estInfoText}>
                    Mensuel:{" "}
                    {o.prixMensuel != null
                      ? `${Number(o.prixMensuel).toLocaleString("fr-FR")} FCFA / ${(o as any).dureeMensuelleMinutes ?? "?"} min`
                      : "—"}
                  </Text>
                </View>
                <View style={styles.estInfoRow}>
                  <FontAwesome5 name="calendar-alt" size={11} color={colors.textMuted} />
                  <Text style={styles.estInfoText}>
                    Annuel:{" "}
                    {o.prixAnnuel != null
                      ? `${Number(o.prixAnnuel).toLocaleString("fr-FR")} FCFA / ${(o as any).dureeAnnuelleMinutes ?? "?"} min`
                      : "—"}
                  </Text>
                </View>
                {isEtab && (o as any).nombreClassesInclues != null ? (
                  <View style={styles.estInfoRow}>
                    <FontAwesome5 name="layer-group" size={11} color={colors.textMuted} />
                    <Text style={styles.estInfoText}>
                      Quota: {(o as any).nombreClassesInclues}
                      {(o as any).classesBonus ? ` +${(o as any).classesBonus} bonus` : ""} classes
                    </Text>
                  </View>
                ) : null}

                <View style={styles.estActions}>
                  <TouchableOpacity style={styles.estActionBtn} onPress={() => setEditingOffre(o)}>
                    <FontAwesome5 name="edit" size={13} color={colors.success} />
                    <Text style={[styles.estActionText, { color: colors.success }]}>Modifier</Text>
                  </TouchableOpacity>
                  {o.actif ? (
                    <TouchableOpacity
                      style={styles.estActionBtn}
                      onPress={() =>
                        Alert.alert("Désactiver", `Désactiver l'offre "${o.nom}" ? Elle ne sera plus proposée aux nouveaux abonnements.`, [
                          { text: "Annuler", style: "cancel" },
                          {
                            text: "Désactiver",
                            style: "destructive",
                            onPress: async () => {
                              try {
                                await offerService.deactivate(o.id);
                                load();
                              } catch (err) {
                                Alert.alert("Erreur", err instanceof Error ? err.message : "Échec.");
                              }
                            },
                          },
                        ])
                      }
                    >
                      <FontAwesome5 name="ban" size={13} color={colors.danger} />
                      <Text style={[styles.estActionText, { color: colors.danger }]}>Désactiver</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </Card>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {segment === "etablissements" ? (
        <CreateEstablishmentSheet visible={showCreate} onClose={() => setShowCreate(false)} onCreated={load} />
      ) : (
        <CreateOfferSheet visible={showCreate} onClose={() => setShowCreate(false)} onCreated={load} />
      )}

      <CreateEstablishmentSheet
        visible={!!editingEstablishment}
        onClose={() => setEditingEstablishment(null)}
        onCreated={load}
        editingEstablishment={editingEstablishment}
      />

      <CreateOfferSheet
        visible={!!editingOffre}
        onClose={() => setEditingOffre(null)}
        onCreated={load}
        editingOffre={editingOffre}
      />
    </View>
  );
};

interface CreateSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** When set, the sheet opens in edit mode (web's isEditMode): pre-fills fields, hides the offer/payment section (not applicable when editing an existing établissement), and PATCHes instead of POSTs. */
  editingEstablishment?: Etablissement | null;
  editingOffre?: Offre | null;
}

/**
 * Full parity with web's CreateEstablishmentContent.jsx: nom/localisation/
 * pays/email/téléphone, a required gestionnaire picker, the two
 * option toggles (mail-on-new-class / code unique), and an optional
 * offre/forfait selector that — when chosen — routes through PaymentModal
 * before the établissement is actually created (same pattern as class
 * creation without an établissement).
 */
const CreateEstablishmentSheet = ({ visible, onClose, onCreated, editingEstablishment }: CreateSheetProps) => {
  const isEditMode = !!editingEstablishment;
  const [nom, setNom] = useState("");
  const [localisation, setLocalisation] = useState("");
  const [pays, setPays] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [optionEnvoiMailNewClasse, setOptionEnvoiMailNewClasse] = useState(false);
  const [optionTokenGeneral, setOptionTokenGeneral] = useState(false);
  const [gestionnaires, setGestionnaires] = useState<Gestionnaire[]>([]);
  const [gestionnaireId, setGestionnaireId] = useState<string | null>(null);
  const [offres, setOffres] = useState<Offre[]>([]);
  const [selectedOffreId, setSelectedOffreId] = useState<string | null>(null);
  const [periodicite, setPeriodicite] = useState<"MENSUEL" | "ANNUEL">("MENSUEL");
  const [showPayment, setShowPayment] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedGestionnaire = gestionnaires.find((g) => g.id === gestionnaireId) || null;
  const selectedOffre = offres.find((o) => o.id === selectedOffreId) || null;
  const offreReduction = calculerReduction(selectedOffre);
  const montant = selectedOffre
    ? Number(periodicite === "ANNUEL" ? selectedOffre.prixAnnuel : selectedOffre.prixMensuel) || 0
    : 0;

  useEffect(() => {
    if (!visible) return;
    setNom(editingEstablishment?.nom ?? "");
    setLocalisation(editingEstablishment?.localisation ?? "");
    setPays(editingEstablishment?.pays ?? "");
    setEmail(editingEstablishment?.email ?? "");
    setTelephone(editingEstablishment?.telephone ?? "");
    setOptionEnvoiMailNewClasse(editingEstablishment?.optionEnvoiMailNewClasse ?? false);
    setOptionTokenGeneral(editingEstablishment?.optionTokenGeneral ?? false);
    setGestionnaireId(null);
    setSelectedOffreId(null);
    setPeriodicite("MENSUEL");
    setErrors({});
    gestionnaireService.getAll().then(setGestionnaires).catch(() => setGestionnaires([]));
    if (editingEstablishment) {
      establishmentService
        .getGestionnaire(editingEstablishment.id)
        .then((g) => g?.id && setGestionnaireId(g.id))
        .catch(() => {});
    } else {
      offerService.list("ETABLISSEMENT").then(setOffres).catch(() => setOffres([]));
    }
  }, [visible, editingEstablishment]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!nom.trim()) errs.nom = "Le nom est requis";
    if (!localisation.trim()) errs.localisation = "La localisation est requise";
    if (!pays.trim()) errs.pays = "Le pays est requis";
    if (!gestionnaireId) errs.gestionnaire = "Un gestionnaire est requis";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const buildPayload = () => ({
    nom: nom.trim(),
    localisation: localisation.trim(),
    pays: pays.trim(),
    email: email.trim(),
    telephone: telephone.trim(),
    optionEnvoiMailNewClasse,
    optionTokenGeneral,
    gestionnaire: selectedGestionnaire ? { id: selectedGestionnaire.id, type: (selectedGestionnaire as any).type } : undefined,
  });

  const doSubmit = async (paymentInfo?: PaymentInfo) => {
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = buildPayload();
      if (paymentInfo) {
        payload.offreId = selectedOffreId;
        payload.periodicite = periodicite;
        payload.paymentInfo = paymentInfo;
      }
      if (isEditMode && editingEstablishment) {
        await establishmentService.update(editingEstablishment.id, payload);
        Alert.alert("Succès", "Établissement modifié avec succès.");
      } else {
        await establishmentService.create(payload);
        Alert.alert("Succès", "Établissement créé avec succès.");
      }
      onCreated();
      onClose();
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : `Échec de ${isEditMode ? "la modification" : "la création"}.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (!validate()) return;
    if (!isEditMode && selectedOffreId) {
      setShowPayment(true);
    } else {
      doSubmit();
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={isEditMode ? "Modifier l'établissement" : "Nouvel établissement"}>
      <ScrollView style={{ maxHeight: 560 }} showsVerticalScrollIndicator={false}>
        <Input label="Nom de l'établissement *" value={nom} onChangeText={setNom} placeholder="Nom de l'établissement" />
        {errors.nom ? <Text style={styles.fieldError}>{errors.nom}</Text> : null}

        <Input label="Localisation *" value={localisation} onChangeText={setLocalisation} placeholder="Adresse ou localisation" />
        {errors.localisation ? <Text style={styles.fieldError}>{errors.localisation}</Text> : null}

        <Input label="Pays *" value={pays} onChangeText={setPays} placeholder="Pays" />
        {errors.pays ? <Text style={styles.fieldError}>{errors.pays}</Text> : null}

        <Input label="Email" value={email} onChangeText={setEmail} placeholder="contact@etablissement.com" keyboardType="email-address" autoCapitalize="none" />
        <Input label="Téléphone" value={telephone} onChangeText={setTelephone} placeholder="+237 6XX XX XX XX" keyboardType="phone-pad" />

        <Text style={styles.fieldLabel}>Gestionnaire *</Text>
        <ScrollView style={{ maxHeight: 160, marginBottom: spacing.sm }} nestedScrollEnabled>
          {gestionnaires.length === 0 ? (
            <Text style={styles.emptyOffresText}>Aucun gestionnaire disponible</Text>
          ) : (
            gestionnaires.map((g) => (
              <TouchableOpacity
                key={g.id}
                style={[styles.gestionnaireRow, gestionnaireId === g.id && styles.gestionnaireRowActive]}
                onPress={() => setGestionnaireId(g.id)}
              >
                <FontAwesome5
                  name={gestionnaireId === g.id ? "check-circle" : "circle"}
                  solid={gestionnaireId === g.id}
                  size={16}
                  color={gestionnaireId === g.id ? colors.primary : colors.textMuted}
                />
                <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                  <Text style={styles.gestionnaireName}>{g.prenom} {g.nom}</Text>
                  <Text style={styles.gestionnaireEmail}>{g.email}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
        {errors.gestionnaire ? <Text style={styles.fieldError}>{errors.gestionnaire}</Text> : null}

        <View style={styles.optionsBox}>
          <Text style={styles.fieldLabel}>Options de configuration</Text>
          <TouchableOpacity style={styles.optionRow} onPress={() => setOptionEnvoiMailNewClasse((v) => !v)}>
            <FontAwesome5
              name={optionEnvoiMailNewClasse ? "check-square" : "square"}
              size={18}
              color={optionEnvoiMailNewClasse ? colors.primary : colors.textMuted}
            />
            <Text style={styles.optionText}>Validation nouvelle classe</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.optionRow} onPress={() => setOptionTokenGeneral((v) => !v)}>
            <FontAwesome5
              name={optionTokenGeneral ? "check-square" : "square"}
              size={18}
              color={optionTokenGeneral ? colors.primary : colors.textMuted}
            />
            <Text style={styles.optionText}>Code unique</Text>
          </TouchableOpacity>
        </View>

        {!isEditMode && (
        <View style={styles.offreBox}>
          <Text style={styles.fieldLabel}>Offre / Forfait (optionnel)</Text>
          <Text style={styles.offreHint}>
            Choisissez un forfait pour définir le quota de classes et la durée de vie de l'établissement. Sans
            forfait, il est créé sans restriction — un administrateur pourra en associer un plus tard.
          </Text>
          <View style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, !selectedOffreId && styles.chipActive]}
              onPress={() => setSelectedOffreId(null)}
            >
              <Text style={[styles.chipText, !selectedOffreId && styles.chipTextActive]}>Aucun</Text>
            </TouchableOpacity>
            {offres.map((o) => (
              <TouchableOpacity
                key={o.id}
                style={[styles.chip, selectedOffreId === o.id && styles.chipActive]}
                onPress={() => {
                  setSelectedOffreId(o.id);
                  if (periodicite === "ANNUEL" && o.prixAnnuel == null) setPeriodicite("MENSUEL");
                }}
              >
                <Text style={[styles.chipText, selectedOffreId === o.id && styles.chipTextActive]}>{o.nom}</Text>
              </TouchableOpacity>
            ))}
          </View>

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
                  🎉 Réduction de {Math.round(offreReduction * 100)}% en optant pour l'annuel !
                </Text>
              )}
            </>
          )}
        </View>
        )}

        <Button
          label={
            !isEditMode && selectedOffreId
              ? "Continuer vers le paiement"
              : isEditMode
              ? "Enregistrer les modifications"
              : "Créer l'établissement"
          }
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
          doSubmit(info);
        }}
        montant={montant}
        label={selectedOffre?.nom || "Souscription établissement"}
        subLabel={periodicite === "ANNUEL" ? "Périodicité annuelle" : "Périodicité mensuelle"}
      />
    </BottomSheet>
  );
};

const DUREE_PRESETS = [
  { label: "1 mois", minutes: 30 * 24 * 60 },
  { label: "1 an", minutes: 365 * 24 * 60 },
  { label: "2 ans", minutes: 2 * 365 * 24 * 60 },
  { label: "Test 3min", minutes: 3 },
];
const DELAI_RAPPEL_PRESETS = [
  { label: "2 jours", minutes: 2 * 24 * 60 },
  { label: "7 jours", minutes: 7 * 24 * 60 },
  { label: "Test 1min", minutes: 1 },
];
const DELAI_SUPPRESSION_PRESETS = [
  { label: "3 jours", minutes: 3 * 24 * 60 },
  { label: "14 jours", minutes: 14 * 24 * 60 },
  { label: "Test 2min", minutes: 2 },
];

const toNumOrUndef = (v: string) => (v.trim() === "" ? undefined : Number(v));

/** Full parity with web's OfferAdminContent.jsx — all 15 fields, duration presets, the annual-discount preview, and edit support (web's ouvrirEdition/handleSubmit). */
const CreateOfferSheet = ({ visible, onClose, onCreated, editingOffre }: CreateSheetProps) => {
  const isEditMode = !!editingOffre;
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [cible, setCible] = useState<"CLASSE" | "ETABLISSEMENT">("CLASSE");
  const [estTest, setEstTest] = useState(false);
  const [actif, setActif] = useState(true);
  const [prixMensuel, setPrixMensuel] = useState("");
  const [dureeMensuelleMinutes, setDureeMensuelleMinutes] = useState("");
  const [prixAnnuel, setPrixAnnuel] = useState("");
  const [dureeAnnuelleMinutes, setDureeAnnuelleMinutes] = useState("");
  const [delaiRappelSuppressionMinutes, setDelaiRappelSuppressionMinutes] = useState("");
  const [delaiSuppressionMinutes, setDelaiSuppressionMinutes] = useState("");
  const [elevesMax, setElevesMax] = useState("");
  const [stockageMaxGo, setStockageMaxGo] = useState("");
  const [messagerieIncluse, setMessagerieIncluse] = useState(false);
  const [nombreClassesInclues, setNombreClassesInclues] = useState("");
  const [classesBonus, setClassesBonus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const o = editingOffre as any;
    setNom(o?.nom ?? "");
    setDescription(o?.description ?? "");
    setCible(o?.cible === "ETABLISSEMENT" ? "ETABLISSEMENT" : "CLASSE");
    setEstTest(!!o?.estTest);
    setActif(o ? !!o.actif : true);
    setPrixMensuel(o?.prixMensuel != null ? String(o.prixMensuel) : "");
    setDureeMensuelleMinutes(o?.dureeMensuelleMinutes != null ? String(o.dureeMensuelleMinutes) : "");
    setPrixAnnuel(o?.prixAnnuel != null ? String(o.prixAnnuel) : "");
    setDureeAnnuelleMinutes(o?.dureeAnnuelleMinutes != null ? String(o.dureeAnnuelleMinutes) : "");
    setDelaiRappelSuppressionMinutes(o?.delaiRappelSuppressionMinutes != null ? String(o.delaiRappelSuppressionMinutes) : "");
    setDelaiSuppressionMinutes(o?.delaiSuppressionMinutes != null ? String(o.delaiSuppressionMinutes) : "");
    setElevesMax(o?.elevesMax != null ? String(o.elevesMax) : "");
    setStockageMaxGo(o?.stockageMaxGo != null ? String(o.stockageMaxGo) : "");
    setMessagerieIncluse(!!o?.messagerieIncluse);
    setNombreClassesInclues(o?.nombreClassesInclues != null ? String(o.nombreClassesInclues) : "");
    setClassesBonus(o?.classesBonus != null ? String(o.classesBonus) : "");
  }, [visible, editingOffre]);

  const reduction = (() => {
    if (!prixMensuel || !prixAnnuel || !dureeMensuelleMinutes || !dureeAnnuelleMinutes) return null;
    const pm = Number(prixMensuel);
    const pa = Number(prixAnnuel);
    const dm = Number(dureeMensuelleMinutes);
    const da = Number(dureeAnnuelleMinutes);
    if (!pm || !pa || !dm || !da) return null;
    const moisEquivalents = da / dm;
    const prixMensualiseSurAnnee = pm * moisEquivalents;
    if (prixMensualiseSurAnnee <= 0) return null;
    return 1 - pa / prixMensualiseSurAnnee;
  })();

  const handleSubmit = async () => {
    if (!nom.trim()) {
      Alert.alert("Erreur", "Le nom est obligatoire.");
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        nom: nom.trim(),
        description: description.trim() || undefined,
        cible,
        prixMensuel: toNumOrUndef(prixMensuel),
        dureeMensuelleMinutes: toNumOrUndef(dureeMensuelleMinutes),
        prixAnnuel: toNumOrUndef(prixAnnuel),
        dureeAnnuelleMinutes: toNumOrUndef(dureeAnnuelleMinutes),
        nombreClassesInclues: cible === "ETABLISSEMENT" ? toNumOrUndef(nombreClassesInclues) : undefined,
        classesBonus: cible === "ETABLISSEMENT" ? toNumOrUndef(classesBonus) : undefined,
        estTest,
        actif,
        delaiRappelSuppressionMinutes: toNumOrUndef(delaiRappelSuppressionMinutes),
        delaiSuppressionMinutes: toNumOrUndef(delaiSuppressionMinutes),
        elevesMax: toNumOrUndef(elevesMax),
        stockageMaxGo: toNumOrUndef(stockageMaxGo),
        messagerieIncluse,
      };
      if (isEditMode && editingOffre) {
        await offerService.update(editingOffre.id, payload);
        Alert.alert("Succès", "Offre modifiée avec succès.");
      } else {
        await offerService.create(payload);
        Alert.alert("Succès", "Offre créée avec succès.");
      }
      onCreated();
      onClose();
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : `Échec de ${isEditMode ? "la modification" : "la création"}.`);
    } finally {
      setSubmitting(false);
    }
  };

  const PresetRow = ({ presets, onPick }: { presets: { label: string; minutes: number }[]; onPick: (m: string) => void }) => (
    <View style={styles.chipRow}>
      {presets.map((p) => (
        <TouchableOpacity key={p.label} style={styles.presetChip} onPress={() => onPick(String(p.minutes))}>
          <Text style={styles.presetChipText}>{p.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} title={isEditMode ? "Modifier l'offre" : "Nouvelle offre"}>
      <ScrollView style={{ maxHeight: 580 }} showsVerticalScrollIndicator={false}>
        <Input label="Nom de l'offre *" value={nom} onChangeText={setNom} placeholder="Nom de l'offre" />
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Description"
          multiline
          numberOfLines={2}
          style={{ height: 60, textAlignVertical: "top" }}
        />

        <Text style={styles.fieldLabel}>Cible</Text>
        <View style={styles.chipRow}>
          <TouchableOpacity style={[styles.chip, cible === "CLASSE" && styles.chipActive]} onPress={() => setCible("CLASSE")}>
            <Text style={[styles.chipText, cible === "CLASSE" && styles.chipTextActive]}>Classe indépendante</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.chip, cible === "ETABLISSEMENT" && styles.chipActive]} onPress={() => setCible("ETABLISSEMENT")}>
            <Text style={[styles.chipText, cible === "ETABLISSEMENT" && styles.chipTextActive]}>Établissement</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.optionsBox}>
          <TouchableOpacity style={styles.optionRow} onPress={() => setEstTest((v) => !v)}>
            <FontAwesome5 name={estTest ? "check-square" : "square"} size={18} color={estTest ? colors.primary : colors.textMuted} />
            <Text style={styles.optionText}>Offre de test (badge "TEST")</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.optionRow} onPress={() => setActif((v) => !v)}>
            <FontAwesome5 name={actif ? "check-square" : "square"} size={18} color={actif ? colors.primary : colors.textMuted} />
            <Text style={styles.optionText}>Active</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Périodicité mensuelle</Text>
        <Input label="Prix mensuel (FCFA)" value={prixMensuel} onChangeText={setPrixMensuel} placeholder="0" keyboardType="numeric" />
        <Input label="Durée (minutes)" value={dureeMensuelleMinutes} onChangeText={setDureeMensuelleMinutes} placeholder="0" keyboardType="numeric" />
        <PresetRow presets={DUREE_PRESETS} onPick={setDureeMensuelleMinutes} />

        <Text style={styles.sectionTitle}>Périodicité annuelle (optionnelle)</Text>
        <Input label="Prix annuel (FCFA)" value={prixAnnuel} onChangeText={setPrixAnnuel} placeholder="0" keyboardType="numeric" />
        <Input label="Durée (minutes)" value={dureeAnnuelleMinutes} onChangeText={setDureeAnnuelleMinutes} placeholder="0" keyboardType="numeric" />
        <PresetRow presets={DUREE_PRESETS} onPick={setDureeAnnuelleMinutes} />
        {reduction != null && reduction > 0 && (
          <Text style={styles.reductionText}>
            Réduction annuelle affichée au client : {Math.round(reduction * 100)}%
          </Text>
        )}

        <Text style={styles.sectionTitle}>Purge automatique après expiration</Text>
        <Text style={styles.offreHint}>Laissez vide pour désactiver la purge automatique sur cette offre.</Text>
        <Input
          label="Rappel de suppression (min après expiration)"
          value={delaiRappelSuppressionMinutes}
          onChangeText={setDelaiRappelSuppressionMinutes}
          placeholder="0"
          keyboardType="numeric"
        />
        <PresetRow presets={DELAI_RAPPEL_PRESETS} onPick={setDelaiRappelSuppressionMinutes} />
        <Input
          label="Suppression définitive (min après expiration)"
          value={delaiSuppressionMinutes}
          onChangeText={setDelaiSuppressionMinutes}
          placeholder="0"
          keyboardType="numeric"
        />
        <PresetRow presets={DELAI_SUPPRESSION_PRESETS} onPick={setDelaiSuppressionMinutes} />

        <Text style={styles.sectionTitle}>Restrictions (informatif)</Text>
        <Input label="Élèves max" value={elevesMax} onChangeText={setElevesMax} placeholder="0" keyboardType="numeric" />
        <Input label="Stockage max (Go)" value={stockageMaxGo} onChangeText={setStockageMaxGo} placeholder="0" keyboardType="numeric" />
        <TouchableOpacity style={styles.optionRow} onPress={() => setMessagerieIncluse((v) => !v)}>
          <FontAwesome5 name={messagerieIncluse ? "check-square" : "square"} size={18} color={messagerieIncluse ? colors.primary : colors.textMuted} />
          <Text style={styles.optionText}>Messagerie incluse</Text>
        </TouchableOpacity>

        {cible === "ETABLISSEMENT" && (
          <>
            <Text style={styles.sectionTitle}>Quota de classes (établissement)</Text>
            <Input label="Nombre de classes incluses" value={nombreClassesInclues} onChangeText={setNombreClassesInclues} placeholder="0" keyboardType="numeric" />
            <Input label="Classes bonus offertes" value={classesBonus} onChangeText={setClassesBonus} placeholder="0" keyboardType="numeric" />
          </>
        )}

        <Button
          label={isEditMode ? "Enregistrer" : "Créer l'offre"}
          onPress={handleSubmit}
          loading={submitting}
          fullWidth
          style={{ marginTop: spacing.md, marginBottom: spacing.lg }}
        />
      </ScrollView>
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
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: spacing.sm, marginBottom: spacing.md },
  segment: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 20, backgroundColor: colors.grayLight, alignItems: "center" },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { ...typography.caption, color: colors.text, fontWeight: "600" },
  segmentTextActive: { color: colors.white },
  list: { flex: 1, paddingHorizontal: 16 },
  searchWrap: { paddingHorizontal: 16 },
  estCard: { marginBottom: spacing.md },
  estCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  estCardTitle: { ...typography.h3, color: colors.text, flex: 1 },
  estInfoRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: 4 },
  estInfoText: { ...typography.caption, color: colors.textMuted, flex: 1 },
  estBadgeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.sm },
  estActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  estActionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  estActionText: { ...typography.caption, fontWeight: "600" },
  error: { color: colors.danger, marginBottom: spacing.md },
  fieldError: { ...typography.caption, color: colors.danger, marginTop: -spacing.sm, marginBottom: spacing.sm },
  fieldLabel: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20, backgroundColor: colors.grayLight },
  chipActive: { backgroundColor: colors.primary },
  chipText: { ...typography.caption, color: colors.text },
  chipTextActive: { color: colors.white, fontWeight: "600" },
  emptyOffresText: { ...typography.caption, color: colors.textMuted, fontStyle: "italic" },
  gestionnaireRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  gestionnaireRowActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  gestionnaireName: { ...typography.bodyBold, color: colors.text, fontSize: 13 },
  gestionnaireEmail: { ...typography.caption, color: colors.textMuted },
  optionsBox: {
    backgroundColor: colors.grayLight,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  optionRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  optionText: { ...typography.caption, color: colors.text, fontWeight: "600" },
  offreBox: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
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
  sectionTitle: {
    ...typography.bodyBold,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  presetChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    marginRight: spacing.xs,
    marginBottom: spacing.sm,
  },
  presetChipText: { fontSize: 11, fontWeight: "600", color: colors.primary },
});

export default AdminSchoolsBody;
