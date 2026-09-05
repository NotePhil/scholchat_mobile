import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { BottomSheet, Button, Input } from "../../components/ui";
import { colors, radius, spacing, typography } from "../../styles/theme";
import { accederService, classAdminService } from "../../services/api";
import { ClassEntity } from "../../types";

interface JoinClassSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  /** The user who will get access — the student themself, or (for a parent) the selected child. */
  utilisateurId?: string;
  estParent?: boolean;
}

/**
 * "Rejoindre une classe" — a student/parent enters the class's activation
 * code to send an access request, mirroring web's AccederService.demanderAcces
 * flow (POST /acceder/demandes with utilisateurId/classeId/codeActivation).
 * No equivalent screen existed on mobile before — access requests could only
 * be approved by a professor/admin, never originated by a parent/student.
 */
const JoinClassSheet = ({ visible, onClose, onSubmitted, utilisateurId, estParent }: JoinClassSheetProps) => {
  const [code, setCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundClass, setFoundClass] = useState<ClassEntity | null>(null);
  const [searchError, setSearchError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setCode("");
      setFoundClass(null);
      setSearchError("");
    }
  }, [visible]);

  const handleSearch = async () => {
    if (!code.trim()) return;
    setSearching(true);
    setSearchError("");
    setFoundClass(null);
    try {
      const cls = await classAdminService.getByCode(code.trim());
      setFoundClass(cls);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Classe introuvable pour ce code.");
    } finally {
      setSearching(false);
    }
  };

  const executeSubmit = async () => {
    if (!foundClass || !utilisateurId) return;
    setSubmitting(true);
    try {
      await accederService.demanderAcces({
        utilisateurId,
        classeId: foundClass.id,
        codeActivation: code.trim(),
        estParent,
        eleveAssocieId: estParent ? utilisateurId : undefined,
      });
      Alert.alert("Demande envoyée", "Votre demande d'accès a été envoyée. Vous serez notifié une fois approuvée.");
      onSubmitted();
      onClose();
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de l'envoi de la demande.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (!foundClass || !utilisateurId) return;
    Alert.alert(
      "Confirmer la demande",
      `Êtes-vous sûr de vouloir envoyer une demande d'accès pour la classe "${foundClass.nom}" ?`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Confirmer la demande", onPress: executeSubmit },
      ]
    );
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Rejoindre une classe">
      <Text style={styles.hint}>Entrez le code d'activation communiqué par le professeur ou l'établissement.</Text>
      <Input
        label="Code d'activation"
        value={code}
        onChangeText={(text) => {
          setCode(text);
          setFoundClass(null);
          setSearchError("");
        }}
        placeholder="Ex: ABC123"
        autoCapitalize="characters"
      />

      {!foundClass && (
        <Button label="Rechercher" onPress={handleSearch} loading={searching} fullWidth style={{ marginBottom: spacing.md }} />
      )}

      {searchError ? <Text style={styles.error}>{searchError}</Text> : null}

      {foundClass && (
        <View style={styles.previewCard}>
          <FontAwesome5 name="chalkboard" size={18} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={styles.previewTitle}>{foundClass.nom}</Text>
            {foundClass.niveau ? <Text style={styles.previewMeta}>Niveau: {foundClass.niveau}</Text> : null}
          </View>
        </View>
      )}

      {foundClass && (
        <Button label="Envoyer la demande d'accès" onPress={handleSubmit} loading={submitting} fullWidth style={{ marginTop: spacing.md, marginBottom: spacing.lg }} />
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  hint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.md },
  previewCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  previewTitle: { ...typography.bodyBold, color: colors.text },
  previewMeta: { ...typography.caption, color: colors.textMuted },
});

export default JoinClassSheet;
