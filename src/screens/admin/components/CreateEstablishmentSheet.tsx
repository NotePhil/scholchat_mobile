import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { BottomSheet, Button, DropdownField, Input } from "../../../components/ui";
import PaymentModal from "../../../components/common/PaymentModal";
import { colors, spacing, typography } from "../../../styles/theme";
import { establishmentService, gestionnaireService, offerService } from "../../../services/api";
import { PaymentInfo } from "../../../services/api/contratService";
import { Etablissement, Gestionnaire, Offre } from "../../../types";

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

export interface CreateEstablishmentSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** When set, the sheet opens in edit mode (web's isEditMode): pre-fills fields, hides the offer/payment section (not applicable when editing an existing établissement), and PATCHes instead of POSTs. */
  editingEstablishment?: Etablissement | null;
  /**
   * Pre-selects this gestionnaire once the list loads — mirrors web's
   * "Pre-fill gestionnaire and email for gestionnaire role" behavior in
   * CreateEstablishmentContent.jsx, used when a gestionnaire (rather than
   * admin) opens this same shared form to create their own établissement.
   */
  defaultGestionnaireId?: string;
}

/**
 * Full parity with web's CreateEstablishmentContent.jsx: nom/localisation/
 * pays/email/téléphone, a required gestionnaire dropdown, the two option
 * toggles (mail-on-new-class / code unique), and an optional offre/forfait
 * dropdown that — when chosen — routes through PaymentModal before the
 * établissement is actually created (same pattern as class creation without
 * an établissement). Lives in its own file (not nested inside
 * AdminSchoolsBody.tsx) so admin's list, gestionnaire's own list
 * (EstablishmentListBody), and the établissement detail view's "Modifier"
 * button can all import it without a circular import between screens.
 */
export const CreateEstablishmentSheet = ({ visible, onClose, onCreated, editingEstablishment, defaultGestionnaireId }: CreateEstablishmentSheetProps) => {
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
    setGestionnaireId(defaultGestionnaireId ?? null);
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
  }, [visible, editingEstablishment, defaultGestionnaireId]);

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

        <DropdownField
          label="Gestionnaire *"
          placeholder="Sélectionner un gestionnaire"
          value={gestionnaireId ?? ""}
          options={gestionnaires.map((g) => ({ label: `${g.nom} ${g.prenom} (${g.email})`, value: g.id }))}
          onChange={setGestionnaireId}
          error={errors.gestionnaire}
        />

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
          <DropdownField
            placeholder="Aucun forfait pour le moment"
            value={selectedOffreId ?? ""}
            options={[
              { label: "Aucun", value: "" },
              ...offres.map((o) => ({ label: o.nom ?? "Offre", value: o.id })),
            ]}
            onChange={(id) => {
              setSelectedOffreId(id || null);
              const o = offres.find((of) => of.id === id);
              if (o && periodicite === "ANNUEL" && o.prixAnnuel == null) setPeriodicite("MENSUEL");
            }}
          />

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

const styles = StyleSheet.create({
  fieldError: { ...typography.caption, color: colors.danger, marginTop: -spacing.sm, marginBottom: spacing.sm },
  fieldLabel: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.sm },
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
});

export default CreateEstablishmentSheet;
