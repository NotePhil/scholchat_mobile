import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text } from "react-native";
import { BottomSheet, Button, Input } from "../../components/ui";
import { spacing, typography, useThemeColors } from "../../styles/theme";
import { accederService } from "../../services/api";
import { useUser } from "../../context/UserContext";
import { useClassPreview } from "../../hooks/useClassPreview";
import ClassPreviewCard from "../../components/common/ClassPreviewCard";
import { translate, useT } from "../../i18n";

interface JoinClassSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  /** The user who will get access — the student themself, or (for a parent) the selected child. */
  utilisateurId?: string;
  estParent?: boolean;
}

/**
 * "Rejoindre une classe" — the activation code is looked up with the public preview
 * (GET /public/classes/apercu) only with the "Vérifier le code" button (nothing while typing), the
 * class card is shown, then the access request is sent (POST /acceder/demandes, web AccederService.demanderAcces).
 */
const JoinClassSheet = ({ visible, onClose, onSubmitted, utilisateurId, estParent }: JoinClassSheetProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const { user } = useUser();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const lookup = useClassPreview(code, estParent ? "parent" : "eleve");

  useEffect(() => {
    if (visible) {
      setCode("");
      lookup.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const executeSubmit = async () => {
    const preview = lookup.preview;
    if (!preview || !utilisateurId) return;
    setSubmitting(true);
    try {
      // Backend requires the request to come from oneself (utilisateurId = logged-in user). Like
      // web's StudentClassList, a parent sends it with their own id and names the child in eleveAssocieId.
      await accederService.demanderAcces({
        utilisateurId: estParent ? user?.userId ?? utilisateurId : utilisateurId,
        classeId: preview.classeId,
        codeActivation: code.trim(),
        estParent,
        eleveAssocieId: estParent ? utilisateurId : undefined,
      });
      Alert.alert(translate("joinClass.sentTitle"), translate("joinClass.sentMessage"));
      onSubmitted();
      onClose();
    } catch (err) {
      Alert.alert(translate("common.error"), err instanceof Error && err.message ? err.message : translate("joinClass.sendFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    const preview = lookup.preview;
    if (!preview || !utilisateurId) return;
    Alert.alert(t("joinClass.confirmTitle"), t("joinClass.confirmMessage", { name: preview.nom }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("joinClass.confirmAction"), onPress: executeSubmit },
    ]);
  };

  const found = lookup.status === "found" && !!lookup.preview;

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t("joinClass.title")}>
      <Text style={styles.hint}>{t("joinClass.hint")}</Text>
      {!utilisateurId ? <Text style={styles.error}>{t("joinClass.noChild")}</Text> : null}
      <Input
        label={t("joinClass.codeLabel")}
        value={code}
        onChangeText={setCode}
        placeholder={t("joinClass.codePlaceholder")}
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={() => lookup.check()}
      />

      <ClassPreviewCard status={lookup.status} preview={lookup.preview} error={lookup.error} style={{ marginBottom: spacing.md }} />

      {found ? (
        <Button
          label={t("joinClass.confirmAction")}
          icon="paper-plane"
          onPress={handleSubmit}
          loading={submitting}
          disabled={!utilisateurId}
          fullWidth
          style={{ marginBottom: spacing.lg }}
        />
      ) : (
        <Button
          label={lookup.status === "loading" ? t("classPreview.verifying") : t("classPreview.verify")}
          icon="search"
          onPress={() => lookup.check()}
          loading={lookup.status === "loading"}
          disabled={!code.trim()}
          fullWidth
          style={{ marginBottom: spacing.lg }}
        />
      )}
    </BottomSheet>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    hint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
    error: { ...typography.caption, color: colors.danger, marginBottom: spacing.md },
  });

export default JoinClassSheet;
