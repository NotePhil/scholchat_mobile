import React, { useState } from "react";
import { Alert } from "react-native";
import { BottomSheet, Button, DropdownField, Input } from "../../components/ui";
import { spacing } from "../../styles/theme";
import { parentService } from "../../services/api";
import { NIVEAUX } from "../../constants/niveaux";

interface AddChildSheetProps {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
  parentId?: string;
}

/**
 * Mirrors web's AddChildModal.jsx exactly: prenom, nom, niveau (shared NIVEAUX list)
 * required, email/telephone optional; POST /profil-eleves then
 * POST /parents/{parentId}/enfants/{eleveId}; same validation/success/error messages.
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
      Alert.alert("Erreur", "Nom, prenom et niveau sont obligatoires");
      return;
    }
    setSubmitting(true);
    try {
      // 1. create the child's profile, 2. link it to this parent (same two calls as web's AddChildModal)
      const created = await parentService.createChildProfile({
        prenom: prenom.trim(),
        nom: nom.trim(),
        niveau,
        email: email.trim(),
        telephone: telephone.trim(),
      });
      if (!created?.id) throw new Error("Erreur lors de la creation de l'eleve");
      await parentService.addChild(parentId, created.id);
      resetForm();
      onAdded();
      onClose();
      Alert.alert("Succès", `${prenom} ${nom} a ete ajoute avec succes !`);
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error && err.message ? err.message : "Erreur lors de l'ajout de l'enfant");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Ajouter un enfant">
      <Input label="Prénom *" value={prenom} onChangeText={setPrenom} placeholder="Prenom" />
      <Input label="Nom *" value={nom} onChangeText={setNom} placeholder="Nom" />
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
        placeholder="email@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Input
        label="Téléphone (optionnel)"
        value={telephone}
        onChangeText={setTelephone}
        placeholder="6XXXXXXXX"
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
