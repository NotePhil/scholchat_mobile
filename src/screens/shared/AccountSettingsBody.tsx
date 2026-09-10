import React, { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Avatar, Button, Card, LoadingSpinner } from "../../components/ui";
import { colors, radius, shadow, spacing, typography, useThemeColors } from "../../styles/theme";
import { useAuthStore } from "../../store/useAuthStore";
import { userService } from "../../services/api";
import { authService } from "../../services/home/authService";
import { confirmLogout } from "../../utils/confirmLogout";

// LinearGradient with safe fallback
let LinearGradient: any;
try {
  LinearGradient = require("expo-linear-gradient").LinearGradient;
} catch {
  LinearGradient = ({ children, style }: any) => <View style={style}>{children}</View>;
}

interface AccountSettingsBodyProps {
  onLogout: () => void;
  roleLabel: string;
}

type Tab = "profile" | "security";

const PASSWORD_RULES: { label: string; test: (v: string) => boolean }[] = [
  { label: "8 caractères minimum", test: (v) => v.length >= 8 },
  { label: "Une lettre majuscule (A-Z)", test: (v) => /[A-Z]/.test(v) },
  { label: "Une lettre minuscule (a-z)", test: (v) => /[a-z]/.test(v) },
  { label: "Un chiffre (0-9)", test: (v) => /[0-9]/.test(v) },
  { label: "Un caractère spécial (!@#$%...)", test: (v) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(v) },
];

/**
 * One shared "Paramètres" screen for every role — modernized with hero header,
 * elevated profile card, sleek tab navigation, and crisp form styling.
 */
const AccountSettingsBody = ({ onLogout, roleLabel }: AccountSettingsBodyProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [tab, setTab] = useState<Tab>("profile");
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nom, setNom] = useState(user?.nom ?? "");
  const [prenom, setPrenom] = useState(user?.prenom ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [telephone, setTelephone] = useState(user?.telephone ?? "");
  const [adresse, setAdresse] = useState((user?.adresse as string) ?? "");

  useEffect(() => {
    setNom(user?.nom ?? "");
    setPrenom(user?.prenom ?? "");
    setEmail(user?.email ?? "");
    setTelephone(user?.telephone ?? "");
    setAdresse((user?.adresse as string) ?? "");
  }, [user]);

  const userId = user?.id;

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setLoadingProfile(false);
      return;
    }
    setLoadingProfile(true);
    userService
      .getUserById(String(userId))
      .then((fresh) => {
        if (cancelled || !fresh) return;
        const freshNom = (fresh as any).nom ?? "";
        const freshPrenom = (fresh as any).prenom ?? "";
        const freshEmail = (fresh as any).email ?? "";
        const freshTel = (fresh as any).telephone ?? "";
        const freshAdr = (fresh as any).adresse ?? "";
        setNom(freshNom);
        setPrenom(freshPrenom);
        setEmail(freshEmail);
        setTelephone(freshTel);
        setAdresse(freshAdr);
        updateUser({
          nom: freshNom || user?.nom,
          prenom: freshPrenom || user?.prenom,
          email: freshEmail || user?.email,
          telephone: freshTel || user?.telephone,
          adresse: freshAdr || (user?.adresse as string),
        });
      })
      .catch(() => {
        // Fall back gracefully to existing store values
      })
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const displayName = [prenom, nom].filter(Boolean).join(" ") || user?.username || "Utilisateur";

  const handleCancelEdit = () => {
    setNom(user?.nom ?? "");
    setPrenom(user?.prenom ?? "");
    setEmail(user?.email ?? "");
    setTelephone(user?.telephone ?? "");
    setAdresse((user?.adresse as string) ?? "");
    setEditMode(false);
  };

  const handleSaveProfile = async () => {
    if (!userId) {
      Alert.alert("Erreur", "Utilisateur non identifié.");
      return;
    }
    setSaving(true);
    try {
      await userService.updateUser(userId as string, {
        nom,
        prenom,
        email: email.toLowerCase(),
        telephone,
        adresse,
      });
      updateUser({ nom, prenom, email: email.toLowerCase(), telephone, adresse });
      setEditMode(false);
      Alert.alert("Succès", "Profil mis à jour avec succès.");
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la mise à jour du profil.");
    } finally {
      setSaving(false);
    }
  };

  const passwordChecks = PASSWORD_RULES.map((rule) => ({ ...rule, ok: rule.test(newPassword) }));
  const passwordValid = passwordChecks.every((c) => c.ok);
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs.");
      return;
    }
    if (!passwordsMatch) {
      Alert.alert("Erreur", "Les mots de passe ne correspondent pas.");
      return;
    }
    if (!passwordValid) {
      Alert.alert("Erreur", "Le nouveau mot de passe ne respecte pas les critères requis.");
      return;
    }
    setChangingPassword(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("Succès", "Mot de passe modifié avec succès.");
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la modification du mot de passe.");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = () => confirmLogout(onLogout);

  if (!user || loadingProfile) {
    return <LoadingSpinner label="Chargement du profil..." fullScreen />;
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Hero Header */}
      <LinearGradient
        colors={[colors.heroStart, colors.heroMid]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.pageHeader}
      >
        <Text style={styles.pageTitle}>Paramètres</Text>
        <Text style={styles.pageSubtitle}>Gérez vos informations de compte et sécurité</Text>
      </LinearGradient>

      {/* Profile Card */}
      <View style={styles.profileCardWrapper}>
        <View style={styles.profileCard}>
          <LinearGradient
            colors={["#4F46E5", "#06B6D4"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.profileTopAccent}
          />
          <View style={styles.profileContent}>
            <View style={styles.avatarWrap}>
              <Avatar name={displayName} size={76} />
              <View style={styles.onlineBadge} />
            </View>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileEmail}>{user.email}</Text>
            <View style={styles.roleBadge}>
              <FontAwesome5 name="shield-alt" size={10} color={colors.primary} />
              <Text style={styles.roleBadgeText}>{roleLabel}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === "profile" && styles.tabBtnActive]}
            onPress={() => setTab("profile")}
            activeOpacity={0.7}
          >
            <FontAwesome5 name="user" size={12} color={tab === "profile" ? colors.white : colors.textMuted} />
            <Text style={[styles.tabText, tab === "profile" && styles.tabTextActive]}>Mon Profil</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === "security" && styles.tabBtnActive]}
            onPress={() => setTab("security")}
            activeOpacity={0.7}
          >
            <FontAwesome5 name="lock" size={12} color={tab === "security" ? colors.white : colors.textMuted} />
            <Text style={[styles.tabText, tab === "security" && styles.tabTextActive]}>Sécurité</Text>
          </TouchableOpacity>
        </View>
      </View>

      {tab === "profile" ? (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <View style={styles.sectionIconBox}>
                <FontAwesome5 name="id-card" size={14} color={colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>Informations Personnelles</Text>
            </View>
            {!editMode ? (
              <TouchableOpacity onPress={() => setEditMode(true)} style={styles.editPill} activeOpacity={0.7}>
                <FontAwesome5 name="pen" size={11} color={colors.primary} />
                <Text style={styles.editPillText}>Modifier</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <Field label="Prénom" value={prenom} onChangeText={setPrenom} editable={editMode} icon="user" />
          <Field label="Nom" value={nom} onChangeText={setNom} editable={editMode} icon="signature" />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            editable={editMode}
            keyboardType="email-address"
            icon="envelope"
          />
          <Field
            label="Téléphone"
            value={telephone}
            onChangeText={setTelephone}
            editable={editMode}
            keyboardType="phone-pad"
            icon="phone"
          />
          <Field
            label="Adresse"
            value={adresse}
            onChangeText={setAdresse}
            editable={editMode}
            multiline
            icon="map-marker-alt"
          />

          {editMode && (
            <View style={styles.actionsRow}>
              <Button
                label="Annuler"
                variant="secondary"
                onPress={handleCancelEdit}
                style={{ flex: 1, marginRight: spacing.sm }}
              />
              <Button label="Enregistrer" onPress={handleSaveProfile} loading={saving} style={{ flex: 1 }} />
            </View>
          )}
        </View>
      ) : (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <View style={[styles.sectionIconBox, { backgroundColor: colors.warningLight }]}>
                <FontAwesome5 name="shield-alt" size={14} color={colors.warning} />
              </View>
              <Text style={styles.sectionTitle}>Modifier le Mot de Passe</Text>
            </View>
          </View>

          <Field
            label="Mot de passe actuel"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            editable
            secure
            icon="key"
          />
          <Field
            label="Nouveau mot de passe"
            value={newPassword}
            onChangeText={setNewPassword}
            editable
            secure
            icon="lock"
          />

          {newPassword.length > 0 && (
            <View style={styles.rulesBox}>
              <Text style={styles.rulesHeading}>Critères requis :</Text>
              {passwordChecks.map((c) => (
                <View key={c.label} style={styles.ruleRow}>
                  <FontAwesome5
                    name={c.ok ? "check-circle" : "circle"}
                    size={12}
                    color={c.ok ? colors.success : colors.textMuted}
                    solid={c.ok}
                  />
                  <Text style={[styles.ruleText, c.ok && { color: colors.success, fontWeight: "600" }]}>
                    {c.label}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Field
            label="Confirmer le nouveau mot de passe"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            editable
            secure
            icon="check-double"
          />

          {confirmPassword.length > 0 && !passwordsMatch && (
            <View style={styles.errorBanner}>
              <FontAwesome5 name="exclamation-circle" size={12} color={colors.danger} />
              <Text style={styles.errorBannerText}>Les mots de passe ne correspondent pas</Text>
            </View>
          )}

          <Button
            label="Mettre à jour le mot de passe"
            onPress={handleChangePassword}
            loading={changingPassword}
            disabled={!currentPassword || !passwordValid || !passwordsMatch}
            fullWidth
            style={{ marginTop: spacing.md }}
          />
        </View>
      )}

      {/* Logout Card */}
      <View style={styles.logoutWrapper}>
        <TouchableOpacity style={styles.logoutCard} onPress={handleLogout} activeOpacity={0.8}>
          <View style={styles.logoutLeft}>
            <View style={styles.logoutIconBox}>
              <FontAwesome5 name="sign-out-alt" size={16} color={colors.danger} />
            </View>
            <View>
              <Text style={styles.logoutText}>Déconnexion</Text>
              <Text style={styles.logoutSubtext}>Se déconnecter de votre session</Text>
            </View>
          </View>
          <FontAwesome5 name="chevron-right" size={13} color={colors.danger} />
        </TouchableOpacity>
      </View>

      <View style={{ height: 110 }} />
    </ScrollView>
  );
};

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  editable: boolean;
  keyboardType?: "email-address" | "phone-pad" | "default";
  multiline?: boolean;
  secure?: boolean;
  icon?: string;
}

const Field = ({ label, value, onChangeText, editable, keyboardType, multiline, secure, icon }: FieldProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
  <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View
      style={[
        styles.fieldInputWrapper,
        !editable && styles.fieldInputDisabled,
        multiline && styles.fieldInputWrapperMultiline,
      ]}
    >
      {icon ? <FontAwesome5 name={icon as any} size={13} color={colors.textMuted} style={styles.fieldIcon} /> : null}
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        keyboardType={keyboardType}
        multiline={multiline}
        secureTextEntry={secure}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  // Hero Header
  pageHeader: {
    // Fallback in case LinearGradient ever fails to render — without this,
    // the white pageTitle/pageSubtitle text below becomes invisible against
    // the page's light background instead of the intended dark gradient.
    backgroundColor: colors.heroStart,
    paddingTop: 52,
    paddingBottom: 24,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
    ...shadow.hero,
  },
  pageTitle: { fontSize: 26, fontWeight: "800", color: colors.white, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 4 },

  // Profile Card
  profileCardWrapper: { paddingHorizontal: 16, marginTop: -14 },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  profileTopAccent: { height: 4 },
  profileContent: { alignItems: "center", paddingVertical: spacing.lg, paddingHorizontal: spacing.md },
  avatarWrap: { position: "relative", marginBottom: 10 },
  onlineBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: colors.white,
  },
  profileName: { ...typography.h2, color: colors.text, fontSize: 18 },
  profileEmail: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  roleBadgeText: { fontSize: 11, fontWeight: "700", color: colors.primary },

  // Tab
  tabContainer: { paddingHorizontal: 16, marginTop: spacing.md, marginBottom: spacing.md },
  tabRow: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  tabBtnActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
  tabTextActive: { color: colors.white },

  // Sections
  sectionCard: {
    marginHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { ...typography.bodyBold, color: colors.text, fontSize: 15 },
  editPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
  },
  editPillText: { fontSize: 11, fontWeight: "700", color: colors.primary },

  // Form Fields
  fieldGroup: { marginBottom: spacing.sm },
  fieldLabel: { ...typography.captionBold, color: colors.textMuted, marginBottom: 5, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  fieldInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 12,
  },
  fieldInputWrapperMultiline: { alignItems: "flex-start", paddingTop: 8 },
  fieldIcon: { marginRight: 8, width: 16, textAlign: "center" },
  fieldInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.text,
  },
  fieldInputDisabled: {
    backgroundColor: colors.background,
    borderColor: colors.borderLight,
    opacity: 0.85,
  },
  fieldInputMultiline: { height: 60, textAlignVertical: "top" },
  actionsRow: { flexDirection: "row", marginTop: spacing.md },

  // Password Rules
  rulesBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  rulesHeading: { fontSize: 11, fontWeight: "700", color: colors.textMuted, marginBottom: 2 },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ruleText: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.dangerLight,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorBannerText: { color: colors.danger, fontSize: 11, fontWeight: "600" },

  // Logout Card
  logoutWrapper: { paddingHorizontal: 16, marginBottom: spacing.md },
  logoutCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.dangerLight,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
    ...shadow.sm,
  },
  logoutLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  logoutIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: { fontSize: 14, fontWeight: "700", color: colors.danger },
  logoutSubtext: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
});

export default AccountSettingsBody;
