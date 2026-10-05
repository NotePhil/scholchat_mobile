import React, { useMemo, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { BottomSheet, Button, Input } from "../../../components/ui";
import { radius, spacing, typography, useThemeColors } from "../../../styles/theme";
import { mediaService, parentService, studentService, userService } from "../../../services/api";
import { PROFESSOR_DOCS, PickedDocument, ProfessorDocKey } from "../../../hooks/useProfessorDocumentsUpload";

export type CreatableUserKind = "professeur" | "parent" | "eleve";

interface CreateUserSheetProps {
  kind: CreatableUserKind | null;
  onClose: () => void;
  onCreated: () => void;
}

const TITLES: Record<CreatableUserKind, string> = {
  professeur: "Nouveau professeur",
  parent: "Nouveau parent",
  eleve: "Nouvel élève",
};

const DOC_LABELS: Record<ProfessorDocKey, string> = {
  cniRecto: "CNI Recto",
  cniVerso: "CNI Verso",
  selfie: "Photo de profil",
};

/** Web's PhoneInput (default country CM) always yields an international number. */
const toInternational = (raw: string) => {
  const v = raw.replace(/\s+/g, "");
  if (!v) return "";
  return v.startsWith("+") ? v : `+237${v}`;
};
const isValidPhone = (v: string) => /^\+\d{8,15}$/.test(v);

/**
 * Admin "Ajouter" flows of the web dashboard, one sheet per user kind:
 * - professeur → ProfessorModal.jsx: prénom*, nom*, email*, téléphone*, adresse*, matricule (optionnel),
 *   CNI recto*, CNI verso*, photo de profil*; POST /utilisateurs { type: "professeur", … } then the
 *   documents are uploaded for the new id and stored with PATCH /utilisateurs/{id}.
 * - parent → ParentModal.jsx: prénom*, nom*, email*, téléphone*, adresse*; POST /utilisateurs { type: "parent", … }.
 * - eleve → StudentModal.jsx: prénom*, nom*, email*, téléphone, adresse; POST /utilisateurs { type: "eleve", … }.
 *   (web's form also shows date de naissance / classe, but ScholchatService.createStudent drops both
 *   from the payload, so they never reach the server.)
 */
const CreateUserSheet = ({ kind, onClose, onCreated }: CreateUserSheetProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [adresse, setAdresse] = useState("");
  const [matricule, setMatricule] = useState("");
  const [files, setFiles] = useState<Partial<Record<ProfessorDocKey, PickedDocument>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setPrenom(""); setNom(""); setEmail(""); setTelephone(""); setAdresse(""); setMatricule("");
    setFiles({}); setError("");
  };

  const close = () => { reset(); onClose(); };

  const pick = async (key: ProfessorDocKey) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["image/*"], copyToCacheDirectory: true });
      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        setFiles((prev) => ({ ...prev, [key]: { uri: asset.uri, name: asset.name || `${key}.jpg`, mimeType: asset.mimeType || "image/jpeg" } }));
      }
    } catch {
      setError("Veuillez télécharger un fichier image (JPEG, PNG)");
    }
  };

  const handleSubmit = async () => {
    if (!kind) return;
    const phone = toInternational(telephone);
    const phoneRequired = kind !== "eleve";
    const adresseRequired = kind !== "eleve";
    if (!prenom.trim() || !nom.trim() || !email.trim() || (phoneRequired && !phone) || (adresseRequired && !adresse.trim())) {
      setError("Veuillez remplir tous les champs obligatoires (*).");
      return;
    }
    if (kind !== "professeur" && phone && !isValidPhone(phone)) {
      setError("Le numéro de téléphone est incomplet ou invalide");
      return;
    }
    if (kind === "professeur" && PROFESSOR_DOCS.some((d) => !files[d.key])) {
      setError("Veuillez remplir tous les champs obligatoires (*).");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (kind === "parent") {
        await parentService.create({ nom, prenom, email, telephone: phone, adresse });
      } else if (kind === "eleve") {
        await studentService.create({ nom, prenom, email, telephone: phone, adresse });
      } else {
        // Step 1: create the professor; step 2: upload documents for the new id and PATCH the references.
        const created = await userService.createUser({
          type: "professeur",
          nom, prenom, email, telephone: phone, adresse,
          matriculeProfesseur: matricule.trim() || null,
        });
        const newUserId = String(created.id ?? "");
        if (newUserId) {
          const updatePayload: Record<string, string> = {};
          await Promise.all(
            PROFESSOR_DOCS.map(async (doc) => {
              const file = files[doc.key] as PickedDocument;
              const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
              updatePayload[doc.field] = await mediaService.uploadFile(
                { uri: file.uri, mimeType: file.mimeType, name: `${newUserId}_${doc.docType}_${Date.now()}.${ext}` },
                newUserId,
                "IMAGE",
                doc.docType
              );
            })
          );
          if (Object.keys(updatePayload).length > 0) {
            await userService.updateUser(newUserId, { type: "professeur", ...updatePayload });
          }
        }
        Alert.alert("Succès", "Professeur créé avec succès");
      }
      reset();
      onCreated();
      onClose();
    } catch (err) {
      setError("Erreur lors de l'enregistrement: " + (err instanceof Error && err.message ? err.message : "Erreur lors de l'enregistrement"));
    } finally {
      setLoading(false);
    }
  };

  if (!kind) return null;
  const optional = kind === "eleve";

  return (
    <BottomSheet visible={!!kind} onClose={close} title={TITLES[kind]}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.lg }} keyboardShouldPersistTaps="handled">
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
        <Input label="Prénom *" placeholder="Entrez le prénom" value={prenom} onChangeText={setPrenom} />
        <Input label="Nom *" placeholder="Entrez le nom" value={nom} onChangeText={setNom} />
        <Input label="Email *" placeholder="exemple@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Input label={optional ? "Numéro de téléphone" : "Numéro de téléphone *"} placeholder="Entrez le numéro" value={telephone} onChangeText={setTelephone} keyboardType="phone-pad" />
        <Input label={optional ? "Adresse" : "Adresse *"} placeholder="Entrez l'adresse complète" value={adresse} onChangeText={setAdresse} />
        {kind === "professeur" ? (
          <>
            <Input label="Matricule du professeur (Optionnel)" placeholder="Matricule professionnel" value={matricule} onChangeText={setMatricule} />
            <Text style={styles.sectionTitle}>Documents d'identité</Text>
            {PROFESSOR_DOCS.map((d) => {
              const file = files[d.key];
              return (
                <TouchableOpacity key={d.key} style={styles.docBox} onPress={() => pick(d.key)} disabled={loading} activeOpacity={0.75}>
                  {file ? (
                    <Image source={{ uri: file.uri }} style={styles.thumb} resizeMode="cover" />
                  ) : (
                    <FontAwesome5 name={d.icon} size={16} color={colors.primary} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docLabel}>{DOC_LABELS[d.key]} *</Text>
                    <Text style={styles.docHint} numberOfLines={1}>{file ? file.name : "Choisir un fichier"}</Text>
                  </View>
                  <FontAwesome5 name="camera" size={14} color={colors.primary} />
                </TouchableOpacity>
              );
            })}
          </>
        ) : null}
        <Button label="Enregistrer" onPress={handleSubmit} loading={loading} fullWidth style={{ marginTop: spacing.md }} />
      </ScrollView>
    </BottomSheet>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  errorBox: { backgroundColor: colors.dangerLight, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  errorText: { color: colors.danger, fontSize: 13 },
  sectionTitle: { ...typography.bodyBold, color: colors.text, marginTop: spacing.sm, marginBottom: spacing.sm },
  docBox: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, marginBottom: spacing.sm,
    borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: colors.border, backgroundColor: colors.surface,
  },
  thumb: { width: 36, height: 36, borderRadius: radius.sm },
  docLabel: { ...typography.bodyBold, color: colors.text },
  docHint: { ...typography.caption, color: colors.textMuted },
});

export default CreateUserSheet;
