import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Avatar, Button, Card, LoadingSpinner } from "../../components/ui";
import { colors, radius, spacing, typography } from "../../styles/theme";
import { useAuthStore } from "../../store/useAuthStore";
import { userService } from "../../services/api";
import { authService } from "../../services/home/authService";
import { confirmLogout } from "../../utils/confirmLogout";

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
 * One shared "Paramètres" screen for every role — matches web's SettingsContent.jsx,
 * which has zero role branching (same component for Admin/Professor/Parent/etc.,
 * only the data differs). Replaces the previous split where Admin got a bare
 * name+logout stub while other roles got inconsistent, partly-decorative screens.
 */
const AccountSettingsBody = ({ onLogout, roleLabel }: AccountSettingsBodyProps) => {
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

  /**
   * POST /auth/login's response (AuthResponse.java) never carries nom/prenom
   * (only a combined `username` string), and has no telephone/adresse at
   * all — there is no GET /auth/me on this backend either. So the cached
   * login-derived `user` is always missing those fields; the only real
   * source is GET /utilisateurs/{id}, fetched fresh here on mount.
   */
  useEffect(() => {
    const id = user?.userId ?? user?.id;
    if (!id) {
      setLoadingProfile(false);
      return;
    }
    let cancelled = false;
    setLoadingProfile(true);
    userService
      .getUserById(id as string)
      .then((full) => {
        if (cancelled) return;
        const patch = {
          nom: (full.nom as string) ?? user?.nom ?? "",
          prenom: (full.prenom as string) ?? user?.prenom ?? "",
          email: (full.email as string) ?? user?.email ?? "",
          telephone: (full.telephone as string) ?? "",
          adresse: (full.adresse as string) ?? "",
        };
        updateUser(patch);
        setNom(patch.nom);
        setPrenom(patch.prenom);
        setEmail(patch.email);
        setTelephone(patch.telephone);
        setAdresse(patch.adresse);
      })
      .catch(() => {
        // Keep whatever the cached session already has — the fields that
        // can't come from login (telephone/adresse) will just stay blank.
      })
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId, user?.id]);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const displayName = `${prenom} ${nom}`.trim() || user?.username || roleLabel;
  const userId = user?.userId ?? user?.id;

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
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Paramètres</Text>
      </View>

      <Card style={styles.profileCard}>
        <Avatar name={displayName} size={72} />
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.email}>{user.email}</Text>
        <Text style={styles.role}>{roleLabel}</Text>
      </Card>

      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tabBtn, tab === "profile" && styles.tabBtnActive]} onPress={() => setTab("profile")}>
          <FontAwesome5 name="user" size={13} color={tab === "profile" ? colors.white : colors.text} />
          <Text style={[styles.tabText, tab === "profile" && styles.tabTextActive]}>Mon Profil</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab === "security" && styles.tabBtnActive]} onPress={() => setTab("security")}>
          <FontAwesome5 name="lock" size={13} color={tab === "security" ? colors.white : colors.text} />
          <Text style={[styles.tabText, tab === "security" && styles.tabTextActive]}>Sécurité</Text>
        </TouchableOpacity>
      </View>

      {tab === "profile" ? (
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Informations Personnelles</Text>
            {!editMode && (
              <TouchableOpacity onPress={() => setEditMode(true)}>
                <FontAwesome5 name="edit" size={16} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          <Field label="Prénom" value={prenom} onChangeText={setPrenom} editable={editMode} />
          <Field label="Nom" value={nom} onChangeText={setNom} editable={editMode} />
          <Field label="Email" value={email} onChangeText={setEmail} editable={editMode} keyboardType="email-address" />
          <Field label="Téléphone" value={telephone} onChangeText={setTelephone} editable={editMode} keyboardType="phone-pad" />
          <Field label="Adresse" value={adresse} onChangeText={setAdresse} editable={editMode} multiline />

          {editMode && (
            <View style={styles.actionsRow}>
              <Button label="Annuler" variant="secondary" onPress={handleCancelEdit} style={{ flex: 1, marginRight: spacing.sm }} />
              <Button label="Enregistrer" onPress={handleSaveProfile} loading={saving} style={{ flex: 1 }} />
            </View>
          )}
        </Card>
      ) : (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Modifier le Mot de Passe</Text>
          <Field label="Mot de passe actuel" value={currentPassword} onChangeText={setCurrentPassword} editable secure />
          <Field label="Nouveau mot de passe" value={newPassword} onChangeText={setNewPassword} editable secure />
          {newPassword.length > 0 && (
            <View style={styles.rulesBox}>
              {passwordChecks.map((c) => (
                <View key={c.label} style={styles.ruleRow}>
                  <FontAwesome5 name={c.ok ? "check-circle" : "circle"} size={12} color={c.ok ? colors.success : colors.textMuted} solid={c.ok} />
                  <Text style={[styles.ruleText, c.ok && { color: colors.success }]}>{c.label}</Text>
                </View>
              ))}
            </View>
          )}
          <Field label="Confirmer le nouveau mot de passe" value={confirmPassword} onChangeText={setConfirmPassword} editable secure />
          {confirmPassword.length > 0 && !passwordsMatch && (
            <Text style={styles.errorText}>Les mots de passe ne correspondent pas</Text>
          )}
          <Button
            label="Modifier le Mot de Passe"
            onPress={handleChangePassword}
            loading={changingPassword}
            disabled={!currentPassword || !passwordValid || !passwordsMatch}
            fullWidth
            style={{ marginTop: spacing.md }}
          />
        </Card>
      )}

      <Card style={styles.section} padded={false}>
        <TouchableOpacity style={styles.settingItem} onPress={handleLogout}>
          <View style={styles.settingLeft}>
            <FontAwesome5 name="sign-out-alt" size={18} color={colors.danger} />
            <Text style={[styles.settingText, { color: colors.danger }]}>Déconnexion</Text>
          </View>
        </TouchableOpacity>
      </Card>

      <View style={{ height: 100 }} />
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
}

const Field = ({ label, value, onChangeText, editable, keyboardType, multiline, secure }: FieldProps) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={[styles.fieldInput, !editable && styles.fieldInputDisabled, multiline && styles.fieldInputMultiline]}
      value={value}
      onChangeText={onChangeText}
      editable={editable}
      keyboardType={keyboardType}
      multiline={multiline}
      secureTextEntry={secure}
      placeholderTextColor={colors.textMuted}
    />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, marginTop: 20, marginBottom: spacing.md },
  title: { ...typography.h1, color: colors.text },
  profileCard: { marginHorizontal: 16, alignItems: "center", marginBottom: spacing.md },
  name: { ...typography.h2, color: colors.text, marginTop: spacing.md },
  email: { ...typography.body, color: colors.textMuted, marginTop: 2 },
  role: { ...typography.caption, color: colors.primary, fontWeight: "700", marginTop: spacing.sm },
  tabRow: { flexDirection: "row", paddingHorizontal: 16, marginBottom: spacing.md, gap: spacing.sm },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.grayLight,
  },
  tabBtnActive: { backgroundColor: colors.primary },
  tabText: { ...typography.caption, color: colors.text, fontWeight: "600" },
  tabTextActive: { color: colors.white },
  section: { marginHorizontal: 16, marginBottom: spacing.lg },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.md },
  fieldGroup: { marginBottom: spacing.md },
  fieldLabel: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.xs, fontSize: 13 },
  fieldInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  fieldInputDisabled: { backgroundColor: colors.background, color: colors.textMuted },
  fieldInputMultiline: { height: 70, textAlignVertical: "top" },
  actionsRow: { flexDirection: "row", marginTop: spacing.sm },
  rulesBox: { marginTop: -spacing.sm, marginBottom: spacing.md, gap: 4 },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ruleText: { ...typography.caption, color: colors.textMuted },
  errorText: { ...typography.caption, color: colors.danger, marginTop: -spacing.sm, marginBottom: spacing.md },
  settingItem: { flexDirection: "row", alignItems: "center", padding: spacing.lg },
  settingLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  settingText: { ...typography.body, color: colors.text },
});

export default AccountSettingsBody;
