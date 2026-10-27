import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text } from "react-native";
import { BottomSheet, Button, Input } from "../../components/ui";
import { spacing, typography, useThemeColors } from "../../styles/theme";
import { parentService } from "../../services/api";
import {
  ADULT_NOT_IN_CLASS,
  CHILD_EXISTS_WITH_ACCOUNT,
  ChildKind,
  cleanCodes,
  isChildEmailError,
  isClassCodeError,
} from "../../services/api/parentService";
import { useClassPreview } from "../../hooks/useClassPreview";
import ClassPreviewCard from "../../components/common/ClassPreviewCard";
import { SIGNUP_EMAIL_REGEX } from "../auth/components/passwordRules";
import { translate, useT } from "../../i18n";
import ChildKindToggle from "./ChildKindToggle";
import AdultClassCodesInput from "./AdultClassCodesInput";

interface AddChildSheetProps {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
  parentId?: string;
  /**
   * "Suivre une autre classe" of an adult child already known: adult mode only, e-mail fixed, only the
   * class code(s) are asked.
   */
  adultEmail?: string;
  adultName?: string;
}

type Errors = { prenom?: string; nom?: string; code?: string; email?: string; codes?: string; general?: string };

/**
 * "Ajouter un enfant", two kinds of child:
 *  - Mineur (sans compte): prénom, nom and the verified class code → POST /parents/{id}/enfants/inscription
 *    (the teacher approves; the parent acts for the child). A same-name student with their own account in
 *    that class → 409 ELEVE_EXISTE_AVEC_COMPTE: the message is shown with "Ajouter avec son e-mail".
 *  - Majeur (own account): e-mail + one or several class codes → POST /parents/{id}/enfants/majeur
 *    {email, codesClasse}: one follow request per class, validated by that class's professor. No student
 *    account → 404 ELEVE_INTROUVABLE (under the e-mail); not a member of a class → 400 ELEVE_PAS_DANS_CLASSE
 *    (under the codes). The parent then only reads the data of the accepted classes.
 *  - adultEmail given: "Suivre une autre classe" of a known adult child (codes only).
 */
const AddChildSheet = ({ visible, onClose, onAdded, parentId, adultEmail, adultName }: AddChildSheetProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const [kind, setKind] = useState<ChildKind>("MINEUR");
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[]>([""]);
  const [errors, setErrors] = useState<Errors>({});
  const [suggestAdult, setSuggestAdult] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const adult = kind === "MAJEUR";
  const lookup = useClassPreview(code, "parent");

  useEffect(() => {
    if (!visible) return;
    setKind(adultEmail ? "MAJEUR" : "MINEUR");
    setPrenom("");
    setNom("");
    setEmail(adultEmail ?? "");
    setCode("");
    setCodes([""]);
    setErrors({});
    setSuggestAdult(false);
    lookup.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const found = lookup.status === "found" && !!lookup.preview;

  const changeKind = (next: ChildKind) => {
    if (next === kind) return;
    setKind(next);
    setErrors({});
    setSuggestAdult(false);
    lookup.reset();
  };

  const clearError = (field: keyof Errors) => {
    if (errors[field] || errors.general) setErrors((p) => ({ ...p, [field]: undefined, general: undefined }));
  };

  const handleError = (err: unknown) => {
    const e = err as Error & { code?: string };
    const message = e?.message || translate("parentChildren.add.failed");
    if (!adult && e?.code === CHILD_EXISTS_WITH_ACCOUNT) {
      setErrors({ general: message });
      setSuggestAdult(true);
    } else if (adult && (e?.code === ADULT_NOT_IN_CLASS || e?.code === "LIEN_PARENT_DEJA_DEMANDE" || e?.code === "ENFANT_INVALIDE")) {
      setErrors({ codes: message });
    } else if (adult && isChildEmailError(e?.code)) {
      setErrors(adultEmail ? { general: message } : { email: message });
    } else if (isClassCodeError(e?.code)) {
      lookup.reset();
      setErrors({ code: message });
    } else {
      setErrors({ general: message });
    }
  };

  const submitMinor = async () => {
    const errs: Errors = {};
    if (!prenom.trim()) errs.prenom = t("auth.signup.errors.firstName");
    if (!nom.trim()) errs.nom = t("auth.signup.errors.lastName");
    if (!code.trim()) errs.code = t("classPreview.errors.required");
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (!found) {
      await lookup.check();
      return;
    }
    await parentService.enrollChild(parentId as string, { prenom, nom, codeClasse: code });
    const name = `${prenom.trim()} ${nom.trim()}`.trim();
    onAdded();
    onClose();
    Alert.alert(
      translate("parentChildren.add.successTitle"),
      translate("parentChildren.add.successMessage", { name, classe: lookup.preview?.nom ?? "" })
    );
  };

  const submitAdult = async () => {
    const errs: Errors = {};
    if (!email.trim()) errs.email = t("adultChild.emailRequired");
    else if (!SIGNUP_EMAIL_REGEX.test(email.trim())) errs.email = t("adultChild.emailInvalid");
    const codesClasse = cleanCodes(codes);
    if (!codesClasse.length) errs.codes = t("adultChild.codes.required");
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const res = await parentService.enrollAdultChild(parentId as string, { email, codesClasse });
    onAdded();
    onClose();
    const name = `${res?.prenom ?? ""} ${res?.nom ?? ""}`.trim() || adultName || email.trim();
    const classes = (res?.classesSuivi ?? []).map((c) => c.classeNom).filter(Boolean).join(", ") || codesClasse.join(", ");
    Alert.alert(translate("adultChild.successLinkTitle"), translate("adultChild.successLinkMessage", { name, classes }));
  };

  const submit = async () => {
    if (submitting) return;
    if (!parentId) {
      setErrors({ general: t("parentChildren.add.failed") });
      return;
    }
    setSubmitting(true);
    try {
      if (adult) await submitAdult();
      else await submitMinor();
    } catch (err) {
      handleError(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Minor: the class code must be verified before submitting. Adult: e-mail only.
  const needsCheck = !adult && !found;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={adultEmail ? t("adultChild.followAnother.title") : t("parentChildren.add.title")}
    >
      {adultEmail ? (
        <Text style={styles.hint}>{t("adultChild.followAnother.hint", { name: adultName || adultEmail })}</Text>
      ) : (
        <ChildKindToggle value={kind} onChange={changeKind} disabled={submitting} />
      )}
      {!adult ? <Text style={styles.hint}>{t("parentChildren.add.hint")}</Text> : null}
      {adult ? (
        <>
          {adultEmail ? null : (
            <Input
              label={`${t("adultChild.email")} *`}
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                clearError("email");
              }}
              placeholder={t("adultChild.emailPlaceholder")}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.email}
            />
          )}
          <AdultClassCodesInput
            codes={codes}
            onChange={(v) => {
              setCodes(v);
              clearError("codes");
            }}
            error={errors.codes}
            disabled={submitting}
          />
        </>
      ) : (
        <>
      <Input
        label={`${t("auth.signup.infos.firstName")} *`}
        value={prenom}
        onChangeText={(v) => {
          setPrenom(v);
          setSuggestAdult(false);
          clearError("prenom");
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
          setSuggestAdult(false);
          clearError("nom");
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
          clearError("code");
        }}
        placeholder={t("auth.signup.classe.placeholder")}
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={() => code.trim() && lookup.check()}
        error={errors.code}
      />
      <ClassPreviewCard status={lookup.status} preview={lookup.preview} error={lookup.error} style={{ marginBottom: spacing.md }} />
        </>
      )}
      {errors.general ? <Text style={styles.error}>{errors.general}</Text> : null}
      {suggestAdult ? (
        <Button
          label={t("adultChild.switchToAdult")}
          icon="envelope"
          variant="secondary"
          onPress={() => changeKind("MAJEUR")}
          fullWidth
          style={{ marginBottom: spacing.md }}
        />
      ) : null}
      {needsCheck ? (
        <Button
          label={lookup.status === "loading" ? t("classPreview.verifying") : t("classPreview.verify")}
          icon="search"
          onPress={() => lookup.check()}
          loading={lookup.status === "loading"}
          disabled={!code.trim()}
          fullWidth
          style={{ marginBottom: spacing.lg }}
        />
      ) : (
        <Button
          label={t("parentChildren.add.submit")}
          icon="user-plus"
          onPress={submit}
          loading={submitting}
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
