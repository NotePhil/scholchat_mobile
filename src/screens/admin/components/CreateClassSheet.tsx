import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import {
  BottomSheet,
  Button,
  DropdownField,
  Input,
} from "../../../components/ui";
import PaymentModal from "../../../components/common/PaymentModal";
import { colors, spacing, typography } from "../../../styles/theme";
import { establishmentService, offerService } from "../../../services/api";
import { classService } from "../../../services/classService";
import { PaymentInfo } from "../../../services/api/contratService";
import { Etablissement, Offre } from "../../../types";

export const NIVEAUX = [
  "CP",
  "CE1",
  "CE2",
  "CM1",
  "CM2",
  "6ème",
  "5ème",
  "4ème",
  "3ème",
  "2nde",
  "1ère",
  "Terminale",
  "MATERNELLE",
  "PRIMAIRE",
  "COLLEGE",
  "LYCEE",
  "UNIVERSITE",
  "Autre",
];

export const calculerReduction = (offre: Offre | null): number | null => {
  if (!offre) return null;
  const o = offre as any;
  if (o.reductionAnnuellePourcentage != null) return o.reductionAnnuellePourcentage;
  if (!o.prixMensuel || !o.prixAnnuel || !o.dureeMensuelleMinutes || !o.dureeAnnuelleMinutes) return null;
  const moisEquivalents = o.dureeAnnuelleMinutes / o.dureeMensuelleMinutes;
  const prixMensualiseSurAnnee = o.prixMensuel * moisEquivalents;
  if (prixMensualiseSurAnnee <= 0) return null;
  return 1 - o.prixAnnuel / prixMensualiseSurAnnee;
};

export interface CreateClassSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  creatorId?: string;
  defaultEstablishmentId?: string;
  lockEstablishment?: boolean;
}

export const CreateClassSheet = ({
  visible,
  onClose,
  onCreated,
  creatorId,
  defaultEstablishmentId,
  lockEstablishment,
}: CreateClassSheetProps) => {
  const [nom, setNom] = useState("");
  const [niveau, setNiveau] = useState("");
  const [accesMajeur, setAccesMajeur] = useState(false);
  const [establishments, setEstablishments] = useState<Etablissement[]>([]);
  const [etablissementId, setEtablissementId] = useState<string | null>(defaultEstablishmentId || null);
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
    setEtablissementId(defaultEstablishmentId || null);
    setCodeUnique("");
    setSelectedOffreId(null);
    setPeriodicite("MENSUEL");
    setErrors({});
    establishmentService.getAll().then(setEstablishments).catch(() => setEstablishments([]));
    offerService.list("CLASSE").then(setOffres).catch(() => setOffres([]));
  }, [visible, defaultEstablishmentId]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!nom.trim()) errs.nom = "Le nom de la classe est requis";
    if (!niveau) errs.niveau = "Le niveau est requis";
    if (etablissementId && selectedEstablishment?.optionTokenGeneral && !codeUnique.trim()) {
      errs.codeUnique = "Le code unique de l'établissement est requis";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const doCreate = async (paymentInfo?: PaymentInfo) => {
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        nom: nom.trim(),
        niveau,
        accesMajeur,
      };
      if (creatorId) {
        payload.creatorId = creatorId;
        payload.moderatorId = creatorId;
      }
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

        <DropdownField
          label="Niveau *"
          placeholder="Sélectionner un niveau"
          value={niveau}
          options={NIVEAUX.map((n) => ({ label: n, value: n }))}
          onChange={setNiveau}
          error={errors.niveau}
        />

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

        {!lockEstablishment && (
          <DropdownField
            label="Établissement (optionnel)"
            placeholder="Aucun établissement (Classe indépendante)"
            value={etablissementId ?? ""}
            options={[
              { label: "Aucun établissement (Classe indépendante)", value: "" },
              ...establishments.map((est) => ({ label: est.nom ?? "Établissement", value: est.id })),
            ]}
            onChange={(id) => setEtablissementId(id || null)}
          />
        )}

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
              Sans forfait, la classe est créée directement — vous pourrez lui en associer un plus tard.
            </Text>
            <DropdownField
              placeholder="Aucune"
              value={selectedOffreId ?? ""}
              options={[
                { label: "Aucune", value: "" },
                ...offres.map((o) => {
                  const prix =
                    o.prixMensuel != null
                      ? `${Number(o.prixMensuel).toLocaleString("fr-FR")} FCFA/mois`
                      : o.prixAnnuel != null
                      ? `${Number(o.prixAnnuel).toLocaleString("fr-FR")} FCFA/an`
                      : "";
                  return { label: `${o.nom}${prix ? ` — ${prix}` : ""}`, value: o.id };
                }),
              ]}
              onChange={(id) => {
                setSelectedOffreId(id || null);
                const o = offres.find((of) => of.id === id);
                if (o && periodicite === "ANNUEL" && o.prixAnnuel == null) setPeriodicite("MENSUEL");
              }}
              error={errors.offre}
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

const styles = StyleSheet.create({
  fieldLabel: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.sm },
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
export default CreateClassSheet;
