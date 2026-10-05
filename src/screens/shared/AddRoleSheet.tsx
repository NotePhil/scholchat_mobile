import React, { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { FontAwesome5 } from "@expo/vector-icons";
import { BottomSheet, Button, Input } from "../../components/ui";
import { radius, spacing, typography, useThemeColors } from "../../styles/theme";
import { mediaService, userService } from "../../services/api";
import { authService } from "../../services/home/authService";
import { useAuthStore } from "../../store/useAuthStore";
import { normalizeRoleKey, roleDisplay } from "./RoleSelectorSheet";
import { translate, useT } from "../../i18n";
import { useAddableRoles } from "../../utils/roleRules";

/**
 * Roles a user can add to their own account. The student profile is exclusive (never added,
 * and a student account adds nothing) — see utils/roleRules + backend ROLE_INCOMPATIBLE.
 */
const ADDABLE: { type: "parent" | "professeur"; key: "parent" | "professor" }[] = [
  { type: "parent", key: "parent" },
  { type: "professeur", key: "professor" },
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
}

/**
 * "Ajouter un profil" for the logged-in user — the in-app version of web's
 * SignUp.jsx "existing email" path: POST /utilisateurs with the account's own
 * email and the requested type adds that role to the SAME account.
 *  - parent: usable immediately (the session is refreshed so it shows up
 *    in the profile switcher);
 *  - professeur: identity documents are required, then the profile waits for
 *    admin validation (shown as "en attente" until then).
 */
const AddRoleSheet = ({ visible, onClose }: AddRoleSheetProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const authUser = useAuthStore((s) => s.user);
  const tokenRoles = useAuthStore((s) => s.roles);
  const currentRole = useAuthStore((s) => s.role);
  const login = useAuthStore((s) => s.login);

  const [type, setType] = useState<"parent" | "professeur" | null>(null);
  const [matricule, setMatricule] = useState("");
  const [files, setFiles] = useState<Partial<Record<DocField, PickedFile>>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) {
      setType(null);
      setMatricule("");
      setFiles({});
    }
  }, [visible]);

  const owned = new Set(
    [
      ...((authUser?.availableRoles as string[] | undefined) ?? tokenRoles),
      ...((authUser?.pendingRoles as string[] | null | undefined) ?? []),
    ].map(normalizeRoleKey)
  );
  const addable = useAddableRoles();
  const pendingKeys = new Set(((authUser?.pendingRoles as string[] | null | undefined) ?? []).map(normalizeRoleKey));
  const userId = (authUser?.userId as string | undefined) ?? "";
  const email = (authUser?.userEmail as string | undefined) ?? (authUser?.email as string | undefined) ?? "";

  const pickFile = async (field: DocField) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["image/*"], copyToCacheDirectory: true });
      if (!result.canceled && result.assets?.length) {
        const a = result.assets[0];
        setFiles((prev) => ({ ...prev, [field]: { uri: a.uri, name: a.name, mimeType: a.mimeType || "image/jpeg" } }));
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

  const handleSubmit = async () => {
    if (!type || !userId || !email) return;
    if (type === "professeur" && DOCS.some((d) => !files[d.field])) {
      Alert.alert(t("addRole.docsRequiredTitle"), t("addRole.docsRequiredMessage"));
      return;
    }
    setSubmitting(true);
    try {
      // The account's own name: POST /utilisateurs requires nom/prenom. The phone number and address
      // are NOT re-sent: the backend keeps the account's stored details when adding a role, and a phone
      // saved in an older format (e.g. "0123456789") made the call fail with "Invalid phone number format".
      const profile = await userService.getUserById(userId);
      const result = await authService.addRole({
        type,
        nom: String(profile.nom ?? ""),
        prenom: String(profile.prenom ?? ""),
        email,
      });

      if (type === "professeur") {
        const urls: Partial<Record<DocField, string>> = {};
        for (const doc of DOCS) {
          const f = files[doc.field] as PickedFile;
          const ext = f.name.split(".").pop() || "jpg";
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
      }

      await refreshRoles();
      onClose();
      if (result.inscriptionStatut === "ROLE_PENDING_VALIDATION" || type === "professeur") {
        Alert.alert(translate("auth.signup.rolePending.title"), translate("addRole.pendingMessage"));
      } else {
        Alert.alert(translate("auth.signup.roleAdded.title"), translate("addRole.addedMessage"));
      }
    } catch (err) {
      Alert.alert(translate("common.error"), err instanceof Error ? err.message : translate("auth.errors.addRoleFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const options = ADDABLE.filter((o) => addable.includes(o.key));
  const pendingOptions = ADDABLE.filter((o) => pendingKeys.has(o.key));

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t("roles.addProfile")}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>
          {t("addRole.subtitle", { email })}
        </Text>

        {options.length === 0 ? (
          <Text style={styles.empty}>
            {owned.has("student")
              ? t("addRole.studentExclusive")
              : pendingOptions.length > 0
                ? t("addRole.allOwnedPending")
                : t("addRole.allOwned")}
          </Text>
        ) : (
          <View style={styles.list}>
            {options.map((o) => {
              const cfg = roleDisplay(o.key);
              const selected = type === o.type;
              const tint = cfg?.color ?? colors.primary;
              return (
                <TouchableOpacity
                  key={o.type}
                  style={[styles.option, { borderColor: selected ? tint : colors.border, backgroundColor: `${tint}14` }]}
                  onPress={() => setType(o.type)}
                  activeOpacity={0.75}
                  disabled={submitting}
                >
                  <View style={[styles.optionIcon, { backgroundColor: tint }]}>
                    <FontAwesome5 name={cfg?.icon ?? "user"} size={16} color={colors.white} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, { color: tint }]}>{cfg?.label ?? o.type}</Text>
                    <Text style={styles.optionSub} numberOfLines={2}>
                      {o.type === "professeur" ? t("addRole.teacherHint") : cfg?.subtitle}
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

        <Button
          label={type === "professeur" ? t("addRole.sendRequest") : t("addRole.addThis")}
          icon="plus"
          onPress={handleSubmit}
          loading={submitting}
          disabled={!type}
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
  });

export default AddRoleSheet;
