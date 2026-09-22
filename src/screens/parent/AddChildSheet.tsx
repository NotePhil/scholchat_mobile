import React, { useState } from "react";
import { Alert } from "react-native";
import { BottomSheet, Button, DropdownField, Input } from "../../components/ui";
import { spacing } from "../../styles/theme";
import { parentService, studentService } from "../../services/api";

/** Mirrors web's AddChildModal.jsx `niveaux` list exactly. */
const NIVEAUX = ["CP", "CE1", "CE2", "CM1", "CM2", "6eme", "5eme", "4eme", "3eme", "2nde", "1ere", "Terminale"];

interface AddChildSheetProps {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
  parentId?: string;
}

/**
 * Mirrors web's AddChildModal.jsx field set exactly (prenom, nom, niveau
 * required from a fixed list, email/telephone optional) — mobile previously
 * only asked for 3 free-text fields with no niveau list.
 */
const AddChildSheet = ({ visible, onClose, onAdded, parentId }: AddChildSheetProps) => {
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [niveau, setNiveau] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setPrenom("");
    setNom("");
    setNiveau("");
    setEmail("");
    setTelephone("");
  };

  const handleSubmit = async () => {
    if (!parentId) {
      Alert.alert("Erreur", "Utilisateur non identifié.");
      return;
    }
    if (!prenom.trim() || !nom.trim() || !niveau) {
      Alert.alert("Erreur", "Le prénom, le nom et le niveau sont obligatoires.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await studentService.create({
        prenom: prenom.trim(),
        nom: nom.trim(),
        niveau,
        email: email.trim(),
        telephone: telephone.trim(),
      });
      if (created.id) {
        await parentService.addChild(parentId, created.id);
      }
      resetForm();
      onAdded();
      onClose();
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de l'ajout de l'enfant.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Ajouter un enfant">
      <Input label="Prénom *" value={prenom} onChangeText={setPrenom} placeholder="Prénom de l'enfant" />
      <Input label="Nom *" value={nom} onChangeText={setNom} placeholder="Nom de l'enfant" />
      <DropdownField
        label="Niveau *"
        value={niveau}
        options={NIVEAUX.map((n) => ({ label: n, value: n }))}
        onChange={setNiveau}
        placeholder="Choisir le niveau"
        sheetTitle="Niveau"
      />
      <Input
        label="Email (optionnel)"
        value={email}
        onChangeText={setEmail}
        placeholder="email@exemple.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Input
        label="Téléphone (optionnel)"
        value={telephone}
        onChangeText={setTelephone}
        placeholder="6 00 00 00 00"
        keyboardType="phone-pad"
      />
      <Button
        label="Ajouter"
        onPress={handleSubmit}
        loading={submitting}
        fullWidth
        style={{ marginTop: spacing.md, marginBottom: spacing.lg }}
      />
    </BottomSheet>
  );
};

export default AddChildSheet;
