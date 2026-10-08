import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text } from "react-native";
import { BottomSheet, Button, Input } from "../../components/ui";
import { spacing, typography, useThemeColors } from "../../styles/theme";
import { parentService } from "../../services/api";
import { isClassCodeError } from "../../services/api/parentService";
import { useClassPreview } from "../../hooks/useClassPreview";
import ClassPreviewCard from "../../components/common/ClassPreviewCard";
import { translate, useT } from "../../i18n";

interface AddChildSheetProps {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
  parentId?: string;
}

/**
 * "Ajouter un enfant": prénom, nom and the code of the child's class, checked with the public
 * preview ("Vérifier le code" → class card), then POST /parents/{id}/enfants/inscription — the
 * child is created with a request for that class, which its teacher approves (status shown in
 * "Mes enfants").
 */
const AddChildSheet = ({ visible, onClose, onAdded, parentId }: AddChildSheetProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<{ prenom?: string; nom?: string; code?: string; general?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const lookup = useClassPreview(code, "parent");

  useEffect(() => {
    if (!visible) return;
    setPrenom("");
    setNom("");
    setCode("");
    setErrors({});
    lookup.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const found = lookup.status === "found" && !!lookup.preview;

  const submit = async () => {
    if (submitting) return;
    const errs: typeof errors = {};
    if (!prenom.trim()) errs.prenom = t("auth.signup.errors.firstName");
    if (!nom.trim()) errs.nom = t("auth.signup.errors.lastName");
    if (!code.trim()) errs.code = t("classPreview.errors.required");
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (!found) {
      await lookup.check();
      return;
    }
    if (!parentId) {
      setErrors({ general: t("parentChildren.add.failed") });
      return;
    }
    setSubmitting(true);
    try {
      await parentService.enrollChild(parentId, { prenom, nom, codeClasse: code });
      const name = `${prenom.trim()} ${nom.trim()}`.trim();
      onAdded();
      onClose();
      Alert.alert(
        translate("parentChildren.add.successTitle"),
        translate("parentChildren.add.successMessage", { name, classe: lookup.preview?.nom ?? "" })
      );
    } catch (err) {
      const e = err as Error & { code?: string };
      const message = e?.message || translate("parentChildren.add.failed");
      if (isClassCodeError(e?.code)) {
        lookup.reset();
        setErrors({ code: message });
      } else {
        setErrors({ general: message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t("parentChildren.add.title")}>
      <Text style={styles.hint}>{t("parentChildren.add.hint")}</Text>
      <Input
        label={`${t("auth.signup.infos.firstName")} *`}
        value={prenom}
        onChangeText={(v) => {
          setPrenom(v);
          if (errors.prenom || errors.general) setErrors((p) => ({ ...p, prenom: undefined, general: undefined }));
        }}
        placeholder={t("parentChildren.firstNamePlaceholder")}
        autoCapitalize="words"
        error={errors.prenom}
      />
      <Input
        label={`${t("auth.signup.infos.lastName")} *`}
        value={nom}
        onChangeText={(v) => {
          setNom(v);
          if (errors.nom || errors.general) setErrors((p) => ({ ...p, nom: undefined, general: undefined }));
        }}
        placeholder={t("parentChildren.lastNamePlaceholder")}
        autoCapitalize="words"
        error={errors.nom}
      />
      <Input
        label={`${t("auth.signup.classe.label")} *`}
        value={code}
        onChangeText={(v) => {
          setCode(v);
          if (errors.code || errors.general) setErrors((p) => ({ ...p, code: undefined, general: undefined }));
        }}
        placeholder={t("auth.signup.classe.placeholder")}
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={() => lookup.check()}
        error={errors.code}
      />
      <ClassPreviewCard status={lookup.status} preview={lookup.preview} error={lookup.error} style={{ marginBottom: spacing.md }} />
      {errors.general ? <Text style={styles.error}>{errors.general}</Text> : null}
      {found ? (
        <Button
          label={t("parentChildren.add.submit")}
          icon="user-plus"
          onPress={submit}
          loading={submitting}
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

export default AddChildSheet;
