import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { FontAwesome5 } from "@expo/vector-icons";
import { BottomSheet, Button, Input } from "../../components/ui";
import { radius, spacing, typography, useThemeColors } from "../../styles/theme";
import { mediaService, userService } from "../../services/api";
import { CLASS_APPROVAL_PENDING, authService } from "../../services/home/authService";
import { useAuthStore } from "../../store/useAuthStore";
import { useUiStore } from "../../store/useUiStore";
import { normalizeRoleKey, roleDisplay } from "./RoleSelectorSheet";
import { translate, useT } from "../../i18n";
import { AddableRoleKey, useAddableRoles } from "../../utils/roleRules";
import { useClassPreview } from "../../hooks/useClassPreview";
import ClassPreviewCard from "../../components/common/ClassPreviewCard";

type AddType = "parent" | "professeur" | "eleve";

/**
 * Profiles a user can add to their own account from a parent / professor session (a student
 * session adds nothing — see utils/roleRules + backend CHANGEMENT_PROFIL_INTERDIT_ELEVE).
 */
const ADDABLE: { type: AddType; key: AddableRoleKey }[] = [
  { type: "parent", key: "parent" },
  { type: "professeur", key: "professor" },
  { type: "eleve", key: "student" },
];

type DocField = "cniUrlRecto" | "cniUrlVerso" | "selfieUrl";
const DOCS: { field: DocField; docType: string }[] = [
  { field: "cniUrlRecto", docType: "cni-recto" },
  { field: "cniUrlVerso", docType: "cni-verso" },
  { field: "selfieUrl", docType: "selfie" },
];

interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
}

interface AddRoleSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Pre-selected profile (e.g. "Compléter les documents" of a professor request). */
  initialType?: AddType;
  /** Called once a profile was added / requested (lets the caller reload statuses). */
  onDone?: () => void;
}

type Done = { title: string; message: string; pending: boolean };

/**
 * "Ajouter un profil" for the logged-in user — POST /utilisateurs with the account's own
 * e-mail and the requested type adds that role to the SAME account (web SignUp.jsx's
 * "existing email" path). The personal details are reused from the account:
 *  - parent: usable immediately;
 *  - professeur: only the identity documents are asked (CNI recto/verso + selfie, authenticated
 *    upload) → PATCH /utilisateurs/{id}; then admin validation (status shown in "Mes profils");
 *  - élève: class code (previewed with GET /public/classes/apercu) → request approved by the
 *    class teacher, then the profile becomes active (notification).
 * The session is refreshed afterwards so availableRoles / pendingRoles are up to date.
 */
const AddRoleSheet = ({ visible, onClose, initialType, onDone }: AddRoleSheetProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const authUser = useAuthStore((s) => s.user);
  const currentRole = useAuthStore((s) => s.role);
  const login = useAuthStore((s) => s.login);

  const [type, setType] = useState<AddType | null>(null);
  const [matricule, setMatricule] = useState("");
  const [files, setFiles] = useState<Partial<Record<DocField, PickedFile>>>({});
  const [codeClasse, setCodeClasse] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Done | null>(null);
  const [profile, setProfile] = useState<{ nom: string; prenom: string } | null>(null);
  // Professor role already requested (POST done) but an upload failed: retry only the documents.
  const [professorRequested, setProfessorRequested] = useState(false);
  const lookup = useClassPreview(codeClasse, "eleve");
  const verifyingCode = type === "eleve" && lookup.status !== "found";

  const addable = useAddableRoles();
  const userId = (authUser?.userId as string | undefined) ?? "";
  const email = (authUser?.userEmail as string | undefined) ?? (authUser?.email as string | undefined) ?? "";
  const pendingKeys = new Set(((authUser?.pendingRoles as string[] | null | undefined) ?? []).map(normalizeRoleKey));

  useEffect(() => {
    if (!visible) {
      setType(null);
      setMatricule("");
      setFiles({});
      setCodeClasse("");
      setError("");
      setDone(null);
      setProfessorRequested(false);
      lookup.reset();
      return;
    }
    if (initialType) setType(initialType);
    // Personal details reused from the account (POST /utilisateurs requires nom / prénom).
    if (userId) {
      userService
        .getUserById(userId)
        .then((p) => setProfile({ nom: String(p.nom ?? ""), prenom: String(p.prenom ?? "") }))
        .catch(() => setProfile({ nom: String(authUser?.nom ?? ""), prenom: String(authUser?.prenom ?? "") }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const pickFile = async (field: DocField) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["image/*"], copyToCacheDirectory: true });
      if (!result.canceled && result.assets?.length) {
        const a = result.assets[0];
        setFiles((prev) => ({ ...prev, [field]: { uri: a.uri, name: a.name, mimeType: a.mimeType || "image/jpeg" } }));
        setError("");
      }
    } catch (err) {
      console.warn("Document picking failed:", err);
    }
  };

  const refreshRoles = async () => {
    // Re-issue the session for the current role: new availableRoles / pendingRoles + JWT roles.
    try {
      const session = await authService.refreshSession(currentRole);
      login(session);
    } catch {
      // Non-fatal: the new role appears at the next login.
    }
  };

  const uploadDocuments = async () => {
    const urls: Partial<Record<DocField, string>> = {};
    for (const doc of DOCS) {
      const f = files[doc.field] as PickedFile;
      const ext = f.name.split(".").pop() || "jpg";
      // Authenticated presign → PUT (xhrUpload, with backend proxy fallback).
      urls[doc.field] = await mediaService.uploadFile(
        { uri: f.uri, name: `${doc.docType}_${Date.now()}.${ext}`, mimeType: f.mimeType },
        userId,
        "IMAGE",
        doc.docType
      );
    }
    await authService.updateProfessorUrls(
      userId,
      { cniRecto: urls.cniUrlRecto ?? "", cniVerso: urls.cniUrlVerso ?? "", selfie: urls.selfieUrl ?? "" },
      matricule
    );
  };

  const handleSubmit = async () => {
    if (!type || !userId || !email) return;
    setError("");
    if (type === "professeur" && DOCS.some((d) => !files[d.field])) {
      setError(t("addRole.docsRequiredMessage"));
      return;
    }
    let preview = lookup.preview;
    if (type === "eleve" && (lookup.status !== "found" || !preview)) {
      // Single button: "Vérifier le code" first (class card or error), then "Envoyer la demande".
      await lookup.check();
      return;
    }
    setSubmitting(true);
    try {
      const names = profile ?? { nom: String(authUser?.nom ?? ""), prenom: String(authUser?.prenom ?? "") };
      let result: Record<string, unknown> = {};
      if (!(type === "professeur" && professorRequested)) {
        // Phone / address are NOT re-sent: the backend keeps the account's stored details.
        result = await authService.addRole({
          type,
          nom: names.nom,
          prenom: names.prenom,
          email,
          ...(type === "eleve" ? { codeClasse: codeClasse.trim(), niveau: preview?.niveau ?? undefined } : {}),
        });
      }

      if (type === "professeur") {
        setProfessorRequested(true);
        try {
          await uploadDocuments();
        } catch (uploadErr) {
          const msg = uploadErr instanceof Error ? uploadErr.message : "";
          setError(`${msg} ${translate("addRoleFlow.retryUploads")}`.trim());
          return;
        }
      }

      await refreshRoles();
      onDone?.();
      if (type === "professeur") {
        setDone({ title: t("addRoleFlow.sentTitle"), message: t("addRoleFlow.sentMessage"), pending: true });
      } else if (type === "eleve" || result.statutInscription === CLASS_APPROVAL_PENDING || result.inscriptionStatut === "ROLE_PENDING_VALIDATION") {
        setDone({
          title: t("addRoleFlow.sentTitle"),
          message: t("addRoleFlow.studentSentMessage", { name: preview?.nom ?? String(result.classeNom ?? "") }),
          pending: true,
        });
      } else {
        setDone({ title: t("auth.signup.roleAdded.title"), message: t("addRole.addedMessage"), pending: false });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : translate("auth.errors.addRoleFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const goToProfile = () => {
    onClose();
    useUiStore.getState().requestTab("settings");
  };

  const options = ADDABLE.filter((o) => addable.includes(o.key) || (initialType === o.type && o.type === "professeur"));
  const fullName = profile ? `${profile.prenom} ${profile.nom}`.trim() : "";

  if (done) {
    return (
      <BottomSheet visible={visible} onClose={onClose} title={done.title}>
        <View style={styles.doneWrap}>
          <View style={[styles.doneIcon, { backgroundColor: done.pending ? `${colors.warning}22` : `${colors.success}22` }]}>
            <FontAwesome5 name={done.pending ? "paper-plane" : "check"} size={24} color={done.pending ? colors.warningDark : colors.success} />
          </View>
          <Text style={styles.doneText}>{done.message}</Text>
        </View>
        <Button label={t("addRoleFlow.seeProfile")} icon="user-cog" onPress={goToProfile} fullWidth style={{ marginBottom: spacing.sm }} />
        <Button label={t("addRoleFlow.continue")} variant="ghost" onPress={onClose} fullWidth style={{ marginBottom: spacing.lg }} />
      </BottomSheet>
    );
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t("roles.addProfile")}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>{t("addRole.subtitle", { email })}</Text>

        {options.length === 0 ? (
          <Text style={styles.empty}>
            {currentRole === "student"
              ? t("addRole.studentExclusive")
              : pendingKeys.size > 0
                ? t("addRole.allOwnedPending")
                : t("addRole.allOwned")}
          </Text>
        ) : (
          <View style={styles.list}>
            {options.map((o) => {
              const cfg = roleDisplay(o.key);
              const selected = type === o.type;
              const tint = cfg?.color ?? colors.primary;
              const hint = o.type === "professeur" ? t("addRole.teacherHint") : o.type === "eleve" ? t("addRoleFlow.studentHint") : cfg?.subtitle;
              return (
                <TouchableOpacity
                  key={o.type}
                  style={[styles.option, { borderColor: selected ? tint : colors.border, backgroundColor: `${tint}14` }]}
                  onPress={() => {
                    setType(o.type);
                    setError("");
                  }}
                  activeOpacity={0.75}
                  disabled={submitting}
                >
                  <View style={[styles.optionIcon, { backgroundColor: tint }]}>
                    <FontAwesome5 name={cfg?.icon ?? "user"} size={16} color={colors.white} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, { color: tint }]}>{cfg?.label ?? o.type}</Text>
                    <Text style={styles.optionSub} numberOfLines={2}>
                      {hint}
                    </Text>
                  </View>
                  <FontAwesome5 name={selected ? "check-circle" : "circle"} size={16} color={selected ? tint : colors.textMuted} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {type === "professeur" ? (
          <View>
            <View style={styles.infoBox}>
              <FontAwesome5 name="info-circle" size={13} color={colors.infoDark} />
              <Text style={styles.infoText}>{t("addRoleFlow.docsOnlyIntro", { name: fullName || "—", email })}</Text>
            </View>
            <Input
              label={t("auth.signup.verification.matricule")}
              value={matricule}
              onChangeText={setMatricule}
              placeholder={t("addRole.matriculePlaceholder")}
              autoCapitalize="characters"
            />
            {DOCS.map((doc) => {
              const picked = files[doc.field];
              return (
                <TouchableOpacity
                  key={doc.field}
                  style={[styles.docRow, picked && { borderColor: colors.success }]}
                  onPress={() => pickFile(doc.field)}
                  disabled={submitting}
                  activeOpacity={0.75}
                >
                  <FontAwesome5 name={picked ? "check-circle" : "id-card"} size={16} color={picked ? colors.success : colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docLabel}>{t(`addRole.docs.${doc.field}`)} *</Text>
                    <Text style={styles.docSub} numberOfLines={1}>
                      {picked ? picked.name : t("addRole.tapToPick")}
                    </Text>
                  </View>
                  <FontAwesome5 name={picked ? "sync-alt" : "upload"} size={13} color={colors.textMuted} />
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {type === "eleve" ? (
          <View>
            <View style={styles.infoBox}>
              <FontAwesome5 name="info-circle" size={13} color={colors.infoDark} />
              <Text style={styles.infoText}>{t("addRoleFlow.studentIntro")}</Text>
            </View>
            <Input
              label={t("joinClass.codeLabel")}
              value={codeClasse}
              onChangeText={setCodeClasse}
              placeholder={t("joinClass.codePlaceholder")}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => lookup.check()}
            />
            <ClassPreviewCard status={lookup.status} preview={lookup.preview} error={lookup.error} />
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorRow}>
            <FontAwesome5 name="exclamation-circle" size={12} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Button
          label={
            verifyingCode
              ? lookup.status === "loading"
                ? t("classPreview.verifying")
                : t("classPreview.verify")
              : type === "parent" || !type
                ? t("addRole.addThis")
                : t("addRole.sendRequest")
          }
          icon={verifyingCode ? "search" : type === "parent" || !type ? "plus" : "paper-plane"}
          onPress={handleSubmit}
          loading={submitting || (verifyingCode && lookup.status === "loading")}
          disabled={!type || (type === "eleve" && !codeClasse.trim())}
          fullWidth
          style={{ marginTop: spacing.md, marginBottom: spacing.lg }}
        />
      </ScrollView>
    </BottomSheet>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    subtitle: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
    empty: { ...typography.body, color: colors.textMuted, textAlign: "center", paddingVertical: spacing.lg },
    list: { gap: spacing.sm, marginBottom: spacing.md },
    option: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1.5,
    },
    optionIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    optionLabel: { ...typography.bodyBold, fontSize: 15 },
    optionSub: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
    infoBox: {
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: `${colors.info}14`,
      marginBottom: spacing.md,
    },
    infoText: { ...typography.caption, color: colors.text, flex: 1, lineHeight: 18 },
    docRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      marginBottom: spacing.sm,
    },
    docLabel: { ...typography.bodyBold, color: colors.text },
    docSub: { ...typography.caption, color: colors.textMuted },
    errorRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm },
    errorText: { ...typography.caption, color: colors.danger, flex: 1 },
    doneWrap: { alignItems: "center", paddingVertical: spacing.md, gap: spacing.md },
    doneIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
    doneText: { ...typography.body, color: colors.text, textAlign: "center", lineHeight: 22, marginBottom: spacing.md },
  });

export default AddRoleSheet;
