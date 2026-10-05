import React, { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, spacing, typography, useThemeColors } from "../../styles/theme";
import { accederService } from "../../services/api";
import { ClassEntity } from "../../types";
import { useT } from "../../i18n";
import { formatDate } from "../../utils/dates";

interface StudentJoinClassPageProps {
  /** Active classes already loaded by the list (web looks the code up in this same list). */
  allClasses: ClassEntity[];
  /** Logged-in user's id (login response `userId`) — the backend only accepts a request for oneself. */
  userId?: string;
  onBack: () => void;
  onRequested: (classe: ClassEntity) => void;
}

/**
 * "Rejoindre une classe" — port of web's StudentClassList.jsx join flow:
 *   step 1 (web "Rejoindre une classe" modal): exact activation-code match
 *          against the active classes list;
 *   step 2 (web ParentClassManagementModal, isRequestMode + isCodeReadOnly):
 *          class / establishment / moderator info, the locked code, then
 *          POST /acceder/demandes { utilisateurId, classeId, codeActivation, estParent: false }.
 */
const StudentJoinClassPage = ({ allClasses, userId, onBack, onRequested }: StudentJoinClassPageProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { t } = useT();

  const [code, setCode] = useState("");
  const [searchDone, setSearchDone] = useState(false);
  const [warning, setWarning] = useState("");
  const [found, setFound] = useState<ClassEntity | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [requestError, setRequestError] = useState("");

  const clearSearch = () => {
    setCode("");
    setSearchDone(false);
    setWarning("");
  };

  const handleSearch = () => {
    const c = code.trim();
    if (!c) {
      setWarning(t("studentClasses.codeRequired"));
      return;
    }
    setWarning("");
    const match = allClasses.find((cl) => cl.codeActivation === c) ?? null;
    setSearchDone(true);
    if (match) {
      setRequestError("");
      setFound(match);
    }
  };

  const handleSubmit = async () => {
    if (!found || !userId) return;
    setSubmitting(true);
    setRequestError("");
    try {
      await accederService.demanderAcces({
        utilisateurId: userId,
        classeId: found.id,
        codeActivation: code.trim(),
        estParent: false,
      });
      onRequested(found);
    } catch (e) {
      setRequestError(e instanceof Error && e.message ? e.message : t("studentClasses.requestError"));
    } finally {
      setSubmitting(false);
    }
  };

  const header = (title: string, subtitle: string, back: () => void) => (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={back} activeOpacity={0.7} accessibilityLabel={t("common.back")}>
        <FontAwesome5 name="arrow-left" size={14} color={colors.text} />
      </TouchableOpacity>
      <View style={styles.headerIcon}>
        <FontAwesome5 name="user-friends" size={15} color="#4f46e5" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.headerSub} numberOfLines={1}>{subtitle}</Text>
      </View>
    </View>
  );

  const infoRow = (icon: string, label: string, value?: string | number | null) => (
    <View style={styles.infoRow}>
      <FontAwesome5 name={icon} size={13} color={colors.primary} style={styles.infoIcon} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value === undefined || value === null || value === "" ? t("studentClasses.notSpecified") : String(value)}</Text>
      </View>
    </View>
  );

  // ── Step 2: access request ────────────────────────────────────────────────
  if (found) {
    const etab = found.etablissement;
    const mod = found.moderator;
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 150 }]}
        keyboardShouldPersistTaps="handled"
      >
        {header(t("studentClasses.requestTitle"), found.nom ?? "", () => {
          setFound(null);
          setSearchDone(false);
        })}

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <FontAwesome5 name="school" size={14} color={colors.primary} />
            <Text style={styles.sectionTitle}>{t("studentClasses.classInfo")}</Text>
          </View>
          {infoRow("school", t("studentClasses.name"), found.nom)}
          {infoRow("layer-group", t("studentClasses.level"), found.niveau)}
          {infoRow("calendar-alt", t("studentClasses.createdAt"), formatDate(found.dateCreation))}
          {infoRow("users", t("studentClasses.studentCount"), found.eleves?.length || 0)}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <FontAwesome5 name="university" size={14} color={colors.primary} />
            <Text style={styles.sectionTitle}>{t("studentClasses.establishment")}</Text>
          </View>
          {infoRow("school", t("studentClasses.name"), etab?.nom)}
          {infoRow("map-marker-alt", t("studentClasses.location"), etab ? [etab.localisation, etab.pays].filter(Boolean).join(", ") : null)}
          {infoRow("envelope", t("studentClasses.email"), etab?.email)}
          {infoRow("phone", t("studentClasses.phone"), etab?.telephone)}
        </View>

        {mod ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <FontAwesome5 name="user" size={14} color={colors.primary} />
              <Text style={styles.sectionTitle}>{t("studentClasses.moderator")}</Text>
            </View>
            <View style={styles.modRow}>
              <View style={styles.modAvatar}>
                <Text style={styles.modAvatarText}>
                  {(mod.nom || "").charAt(0)}
                  {(mod.prenom || "").charAt(0)}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={styles.modName}>{[mod.prenom, mod.nom].filter(Boolean).join(" ")}</Text>
                {mod.email ? (
                  <View style={styles.inline}>
                    <FontAwesome5 name="envelope" size={11} color={colors.textMuted} />
                    <Text style={styles.modMeta} numberOfLines={1}>{mod.email}</Text>
                  </View>
                ) : null}
                {mod.telephone ? (
                  <View style={styles.inline}>
                    <FontAwesome5 name="phone" size={11} color={colors.textMuted} />
                    <Text style={styles.modMeta}>{mod.telephone}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <FontAwesome5 name="user-plus" size={14} color={colors.primary} />
            <Text style={styles.sectionTitle}>{t("studentClasses.requestTitle")}</Text>
          </View>
          <Text style={styles.bodyText}>{t("studentClasses.requestIntro")}</Text>
          <Text style={styles.fieldLabel}>{t("studentClasses.activationCode")}</Text>
          <View style={[styles.lockedField, requestError ? { borderColor: colors.danger } : null]}>
            <Text style={styles.lockedText}>{code.trim()}</Text>
            <FontAwesome5 name="lock" size={13} color={colors.textMuted} />
          </View>
          <Text style={[styles.helper, requestError ? { color: colors.danger } : null]}>
            {requestError || t("studentClasses.codeAutoFilled")}
          </Text>
          <View style={styles.infoAlert}>
            <FontAwesome5 name="info-circle" size={13} color={colors.infoDark} />
            <Text style={styles.infoAlertText}>{t("studentClasses.codeAutoFilledInfo")}</Text>
          </View>
        </View>

        <View style={styles.footerRow}>
          <TouchableOpacity
            style={styles.outlineBtn}
            onPress={() => {
              setFound(null);
              setSearchDone(false);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.outlineBtnText}>{t("studentClasses.close")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, (submitting || !userId) && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting || !userId}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <FontAwesome5 name="user-plus" size={12} color="#FFFFFF" />
            )}
            <Text style={styles.primaryBtnText}>
              {submitting ? t("studentClasses.sending") : t("studentClasses.requestAccess")}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ── Step 1: code search ───────────────────────────────────────────────────
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 150 }]}
      keyboardShouldPersistTaps="handled"
    >
      {header(t("studentClasses.joinClass"), t("studentClasses.joinSubtitle"), onBack)}

      <View style={styles.section}>
        {/* Constant wrapper style — never toggled on focus (Android keyboard inset). */}
        <View style={styles.codeBox}>
          <FontAwesome5 name="lock" size={13} color={colors.textLight} />
          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={(v) => {
              setCode(v);
              setWarning("");
              if (!v) setSearchDone(false);
            }}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t("studentClasses.codePlaceholder")}
            placeholderTextColor={colors.textLight}
          />
          {code ? (
            <TouchableOpacity onPress={clearSearch} hitSlop={8}>
              <FontAwesome5 name="times" size={13} color={colors.textLight} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity style={[styles.primaryBtn, styles.searchBtn]} onPress={handleSearch} activeOpacity={0.85}>
          <FontAwesome5 name="search" size={12} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>{t("studentClasses.search")}</Text>
        </TouchableOpacity>

        {warning ? (
          <View style={[styles.alert, { backgroundColor: "rgba(217,119,6,0.10)", borderColor: "rgba(217,119,6,0.35)" }]}>
            <FontAwesome5 name="exclamation-triangle" size={13} color="#d97706" />
            <Text style={[styles.alertText, { color: "#d97706" }]}>{warning}</Text>
          </View>
        ) : searchDone ? (
          <View style={[styles.alert, { backgroundColor: "rgba(220,38,38,0.10)", borderColor: "rgba(220,38,38,0.35)" }]}>
            <FontAwesome5 name="times-circle" size={13} color="#dc2626" />
            <Text style={[styles.alertText, { color: "#dc2626" }]}>{t("studentClasses.notFound")}</Text>
          </View>
        ) : (
          <View style={styles.hintBox}>
            <FontAwesome5 name="lock" size={34} color={colors.textLight} style={{ opacity: 0.5 }} />
            <Text style={styles.hintText}>{t("studentClasses.codeHint")}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    content: { paddingHorizontal: 16, paddingTop: spacing.sm, gap: spacing.md },
    header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    headerIcon: {
      width: 34,
      height: 34,
      borderRadius: 8,
      backgroundColor: "rgba(79,70,229,0.14)",
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { ...typography.h4, color: colors.text, fontWeight: "700" },
    headerSub: { ...typography.caption, color: colors.textLight },
    section: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    sectionHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingBottom: spacing.sm,
      marginBottom: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sectionTitle: { ...typography.bodyBold, color: colors.text },
    infoRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
    infoIcon: { width: 18, marginTop: 3, textAlign: "center" },
    infoLabel: { ...typography.caption, color: colors.textMuted },
    infoValue: { ...typography.bodyBold, color: colors.text, fontWeight: "500" },
    modRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    modAvatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    modAvatarText: { color: "#FFFFFF", fontSize: 18, fontWeight: "600" },
    modName: { ...typography.bodyBold, color: colors.text },
    modMeta: { ...typography.caption, color: colors.textMuted, flexShrink: 1 },
    inline: { flexDirection: "row", alignItems: "center", gap: 6 },
    bodyText: { ...typography.body, color: colors.textMuted },
    fieldLabel: { ...typography.captionBold, color: colors.textMuted, marginTop: spacing.xs },
    lockedField: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    lockedText: { ...typography.bodyBold, color: colors.text, letterSpacing: 1 },
    helper: { ...typography.caption, color: colors.textMuted },
    infoAlert: {
      flexDirection: "row",
      gap: spacing.sm,
      alignItems: "flex-start",
      backgroundColor: "rgba(37,99,235,0.10)",
      borderRadius: radius.sm,
      padding: spacing.md,
      marginTop: spacing.xs,
    },
    infoAlertText: { ...typography.caption, color: colors.infoDark, flex: 1 },
    footerRow: { flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end" },
    outlineBtn: {
      paddingHorizontal: spacing.lg,
      paddingVertical: 10,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    outlineBtnText: { ...typography.bodyBold, color: colors.primary },
    primaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      backgroundColor: "#4f46e5",
      paddingHorizontal: spacing.lg,
      paddingVertical: 10,
      borderRadius: radius.sm,
    },
    primaryBtnText: { ...typography.bodyBold, color: "#FFFFFF" },
    searchBtn: { borderRadius: 10, paddingVertical: 12 },
    codeBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.background,
      paddingHorizontal: spacing.md,
    },
    codeInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 12 },
    alert: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      borderWidth: 1,
      borderRadius: radius.sm,
      padding: spacing.md,
      marginTop: spacing.xs,
    },
    alertText: { ...typography.caption, flex: 1, fontWeight: "600" },
    hintBox: { alignItems: "center", paddingTop: spacing.xl, paddingBottom: spacing.sm, gap: spacing.sm },
    hintText: { ...typography.caption, color: colors.textLight, textAlign: "center" },
  });

export default StudentJoinClassPage;
