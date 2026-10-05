import React, { useCallback, useEffect, useMemo, useState } from "react";
import { formatDate as formatServerDate } from "../../utils/dates";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FontAwesome5 } from "@expo/vector-icons";
import { Avatar } from "../../components/ui";
import { useAuthStore } from "../../store/useAuthStore";
import { useThemeStore } from "../../store/useThemeStore";
import { userService, mediaService } from "../../services/api";
import { authService } from "../../services/home/authService";
import { confirmLogout } from "../../utils/confirmLogout";
import { toRelativePath } from "../../components/common/DocumentPreview";
import MyProfilesCard from "./MyProfilesCard";
import ProfessorDocumentsSection from "./ProfessorDocumentsSection";
import LanguageSwitch from "../../components/common/LanguageSwitch";
import { TranslationKey, translate, useT } from "../../i18n";

// LinearGradient with safe fallback
let LinearGradient: any;
try {
  LinearGradient = require("expo-linear-gradient").LinearGradient;
} catch {
  LinearGradient = ({ children, style, colors: c }: any) => (
    <View style={[style, { backgroundColor: c?.[0] }]}>{children}</View>
  );
}

// Web's default colour scheme gradient (from-blue-500 to-blue-600)
const GRADIENT = ["#3B82F6", "#2563EB"];
const SECURITY_GRADIENT = ["#EF4444", "#F97316"];
const APPEARANCE_GRADIENT = ["#8B5CF6", "#EC4899"];

// Web's Tailwind gray palette, light vs dark (same as MatieresBody)
const makePalette = (isDark: boolean) => ({
  isDark,
  page: isDark ? "#111827" : "#F9FAFB",
  card: isDark ? "#1F2937" : "#FFFFFF",
  section: isDark ? "rgba(31,41,55,0.6)" : "#F9FAFB",
  border: isDark ? "#374151" : "#E5E7EB",
  divider: isDark ? "#374151" : "#F3F4F6",
  text: isDark ? "#FFFFFF" : "#111827",
  sub: isDark ? "#D1D5DB" : "#4B5563",
  muted: isDark ? "#9CA3AF" : "#6B7280",
  input: isDark ? "#374151" : "#FFFFFF",
  readOnly: isDark ? "#1F2937" : "#F3F4F6",
  primary: "#3B82F6",
  primarySoft: isDark ? "rgba(59,130,246,0.18)" : "#DBEAFE",
  primaryText: isDark ? "#93C5FD" : "#1E40AF",
});
type Palette = ReturnType<typeof makePalette>;

type Tab = "profile" | "security" | "appearance";
type Message = { text: string; type: "" | "success" | "error" };

// Mirrors the backend's AuthBusiness.validatePasswordStrength (change-password)
const PASSWORD_RULES: { label: TranslationKey; test: (v: string) => boolean }[] = [
  { label: "settings.passwordRules.length", test: (v) => v.length >= 8 },
  { label: "settings.passwordRules.uppercase", test: (v) => /[A-Z]/.test(v) },
  { label: "settings.passwordRules.lowercase", test: (v) => /[a-z]/.test(v) },
  { label: "settings.passwordRules.digit", test: (v) => /[0-9]/.test(v) },
  { label: "settings.passwordRules.special", test: (v) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(v) },
];

// EtatUtilisateur (backend enum) → badge
const ETAT_BADGES: Record<string, { label: TranslationKey; fg: string; bg: string; bgDark: string; fgDark: string }> = {
  ACTIVE: { label: "settings.etat.ACTIVE", fg: "#166534", bg: "#DCFCE7", fgDark: "#86EFAC", bgDark: "rgba(22,101,52,0.35)" },
  AWAITING_VALIDATION: { label: "settings.etat.AWAITING_VALIDATION", fg: "#92400E", bg: "#FEF3C7", fgDark: "#FCD34D", bgDark: "rgba(146,64,14,0.35)" },
  PENDING: { label: "settings.etat.PENDING", fg: "#92400E", bg: "#FEF3C7", fgDark: "#FCD34D", bgDark: "rgba(146,64,14,0.35)" },
  INACTIVE: { label: "settings.etat.INACTIVE", fg: "#374151", bg: "#E5E7EB", fgDark: "#D1D5DB", bgDark: "rgba(75,85,99,0.5)" },
  REJECTED: { label: "settings.etat.REJECTED", fg: "#991B1B", bg: "#FEE2E2", fgDark: "#FCA5A5", bgDark: "rgba(153,27,27,0.35)" },
  SUSPECT: { label: "settings.etat.SIGNALE", fg: "#991B1B", bg: "#FEE2E2", fgDark: "#FCA5A5", bgDark: "rgba(153,27,27,0.35)" },
  SIGNALE: { label: "settings.etat.SIGNALE", fg: "#991B1B", bg: "#FEE2E2", fgDark: "#FCA5A5", bgDark: "rgba(153,27,27,0.35)" },
};

const formatDate = (value?: string) => {
  if (!value) return "";
  return formatServerDate(value, { year: "numeric", month: "long", day: "numeric" });
};

const isValidPhone = (v: string) => {
  const digits = v.replace(/\D/g, "");
  return /^\+?[0-9\s\-().]+$/.test(v) && digits.length >= 8 && digits.length <= 15;
};

interface Profile {
  type: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  adresse: string;
  etat: string;
  creationDate: string;
  matriculeProfesseur: string;
  niveau: string;
  selfieUrl: string;
  cniUrlRecto: string;
  cniUrlVerso: string;
  statutVerification: string;
  motifRejetVerification: string;
}

const toProfile = (raw: Record<string, any>): Profile => ({
  type: raw.type ?? "",
  nom: raw.nom ?? "",
  prenom: raw.prenom ?? "",
  email: raw.email ?? "",
  telephone: raw.telephone ?? "",
  adresse: raw.adresse ?? "",
  etat: raw.etat ?? "",
  creationDate: raw.creationDate ?? "",
  matriculeProfesseur: raw.matriculeProfesseur ?? "",
  niveau: raw.niveau ?? "",
  selfieUrl: raw.selfieUrl ?? raw.fullPicUrl ?? "",
  cniUrlRecto: raw.cniUrlRecto ?? "",
  cniUrlVerso: raw.cniUrlVerso ?? "",
  statutVerification: raw.statutVerification ?? "",
  motifRejetVerification: raw.motifRejetVerification ?? "",
});

interface AccountSettingsBodyProps {
  onLogout: () => void;
  roleLabel: string;
}

/**
 * Shared "Paramètres" screen for every role — mobile port of web's
 * SettingsContent.jsx: header card, profile card, Mon Profil / Sécurité /
 * Apparence tabs. Profile data is loaded from GET /utilisateurs/{id} and saved
 * through PATCH /utilisateurs/{id}; password via POST /auth/change-password.
 */
const AccountSettingsBody = ({ onLogout, roleLabel }: AccountSettingsBodyProps) => {
  const insets = useSafeAreaInsets();
  const isDark = useThemeStore((s) => s.mode === "dark");
  const toggleTheme = useThemeStore((s) => s.toggleMode);
  const p = useMemo(() => makePalette(isDark), [isDark]);
  const styles = useMemo(() => createStyles(p), [p]);
  const { t } = useT();

  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const role = useAuthStore((s) => s.role);
  const isProfessor = role === "professor" || role === "tutor";

  // Backend AuthResponse carries `userId` (not `id`) and no nom/prenom/email —
  // those come from GET /utilisateurs/{id} below.
  const userId = (user?.id ?? user?.userId) as string | undefined;

  const [tab, setTab] = useState<Tab>("profile");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);

  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ prenom: "", nom: "", telephone: "", adresse: "" });
  const [message, setMessage] = useState<Message>({ text: "", type: "" });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [pwMessage, setPwMessage] = useState<Message>({ text: "", type: "" });

  const applyProfile = useCallback(
    (fresh: Profile) => {
      setProfile(fresh);
      setForm({ prenom: fresh.prenom, nom: fresh.nom, telephone: fresh.telephone, adresse: fresh.adresse });
      const fullName = [fresh.prenom, fresh.nom].filter(Boolean).join(" ");
      // Keeps AppHeader (reads user.username first) and the persisted session in sync.
      updateUser({
        ...(fullName ? { username: fullName } : {}),
        nom: fresh.nom,
        prenom: fresh.prenom,
        email: fresh.email || user?.email || user?.userEmail,
        telephone: fresh.telephone,
        adresse: fresh.adresse,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateUser]
  );

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setLoadError(translate("settings.errors.noUser"));
      return;
    }
    try {
      const raw = await userService.getUserById(String(userId));
      applyProfile(toProfile(raw as Record<string, any>));
      setLoadError("");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : translate("settings.errors.loadFailed"));
    }
  }, [userId, applyProfile]);

  useEffect(() => {
    setLoading(true);
    loadProfile().finally(() => setLoading(false));
  }, [loadProfile]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  // Resolves the stored selfie path into a real loadable URL (same as DocumentPreview).
  const selfieUrl = profile?.selfieUrl ?? "";
  useEffect(() => {
    if (!selfieUrl) {
      setPhotoUri(undefined);
      return;
    }
    let cancelled = false;
    mediaService
      .getDownloadUrlByPath(toRelativePath(selfieUrl))
      .then((resolved) => {
        if (!cancelled && resolved) setPhotoUri(resolved);
      })
      .catch(() => {
        // Falls back to initials
      });
    return () => {
      cancelled = true;
    };
  }, [selfieUrl]);

  const email = profile?.email || user?.email || user?.userEmail || "";
  const displayName =
    [profile?.prenom, profile?.nom].filter(Boolean).join(" ") || user?.username || t("roles.unknown");
  const etatDef = profile?.etat ? ETAT_BADGES[profile.etat] : undefined;
  const etatBadge = etatDef ? { ...etatDef, label: t(etatDef.label) } : undefined;
  const memberSince = formatDate(profile?.creationDate);
  const isStudent = profile?.type === "eleve";

  const startEdit = () => {
    setMessage({ text: "", type: "" });
    setEditMode(true);
  };

  const cancelEdit = () => {
    if (profile) {
      setForm({ prenom: profile.prenom, nom: profile.nom, telephone: profile.telephone, adresse: profile.adresse });
    }
    setMessage({ text: "", type: "" });
    setEditMode(false);
  };

  const handleSaveProfile = async () => {
    if (!userId) {
      setMessage({ text: t("settings.errors.noUserShort"), type: "error" });
      return;
    }
    const prenom = form.prenom.trim();
    const nom = form.nom.trim();
    const telephone = form.telephone.trim();
    const adresse = form.adresse.trim();
    if (!prenom || !nom) {
      setMessage({ text: t("settings.errors.nameRequired"), type: "error" });
      return;
    }
    if (telephone && !isValidPhone(telephone)) {
      setMessage({ text: t("auth.signup.errors.phone"), type: "error" });
      return;
    }
    setSaving(true);
    setMessage({ text: "", type: "" });
    try {
      // `type` is required by the backend's @JsonTypeInfo discriminator (400
      // "missing type id" otherwise). "utilisateur" keeps the update to the
      // common fields only. Email is the login identity (JWT subject), so it
      // is not editable here. Blank values are ignored by the backend.
      const updated = await userService.updateUser(userId, {
        type: "utilisateur",
        prenom,
        nom,
        ...(telephone ? { telephone } : {}),
        ...(adresse ? { adresse } : {}),
      });
      applyProfile(toProfile(updated as Record<string, any>));
      setEditMode(false);
      setMessage({ text: t("settings.profileUpdated"), type: "success" });
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : t("settings.errors.updateFailed"),
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const passwordChecks = PASSWORD_RULES.map((rule) => ({ ...rule, ok: rule.test(newPassword) }));
  const passwordValid = passwordChecks.every((c) => c.ok);
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const canSubmitPassword = !!currentPassword && passwordValid && passwordsMatch && !changingPassword;

  const handleChangePassword = async () => {
    if (!canSubmitPassword) return;
    setChangingPassword(true);
    setPwMessage({ text: "", type: "" });
    try {
      await authService.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwMessage({ text: t("settings.passwordChanged"), type: "success" });
    } catch (err) {
      setPwMessage({
        text: err instanceof Error ? err.message : t("auth.errors.changePasswordFailed"),
        type: "error",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const switchTab = (next: Tab) => {
    setTab(next);
    setMessage({ text: "", type: "" });
    setPwMessage({ text: "", type: "" });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerFill]}>
        <ActivityIndicator size="large" color={p.primary} />
        <Text style={styles.loadingText}>{t("settings.loading")}</Text>
      </View>
    );
  }

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "profile", label: t("settings.tabs.profile"), icon: "user" },
    { id: "security", label: t("settings.tabs.security"), icon: "lock" },
    { id: "appearance", label: t("settings.tabs.appearance"), icon: "palette" },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 150 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={p.primary} />}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={[styles.card, styles.header]}>
          <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerIcon}>
            <FontAwesome5 name="cog" size={18} color="#FFFFFF" />
          </LinearGradient>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title}>{t("settings.title")}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {t("settings.subtitle")}
            </Text>
          </View>
        </View>

        {loadError ? (
          <MessageBanner p={p} styles={styles} message={{ text: loadError, type: "error" }} />
        ) : null}

        {/* ── Profile card ───────────────────────────────────────── */}
        <View style={[styles.card, styles.profileCard]}>
          <Avatar name={displayName} uri={photoUri} size={64} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.profileName} numberOfLines={1}>
              {displayName}
            </Text>
            {email ? (
              <Text style={styles.profileEmail} numberOfLines={1}>
                {email}
              </Text>
            ) : null}
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: p.primarySoft }]}>
                <FontAwesome5 name="shield-alt" size={9} color={p.primaryText} />
                <Text style={[styles.badgeText, { color: p.primaryText }]}>{roleLabel}</Text>
              </View>
              {etatBadge ? (
                <View style={[styles.badge, { backgroundColor: isDark ? etatBadge.bgDark : etatBadge.bg }]}>
                  <Text style={[styles.badgeText, { color: isDark ? etatBadge.fgDark : etatBadge.fg }]}>
                    {etatBadge.label}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* ── Tabs ───────────────────────────────────────────────── */}
        <View style={[styles.card, styles.tabRow]}>
          {TABS.map((item) => {
            const active = tab === item.id;
            const content = (
              <>
                <FontAwesome5 name={item.icon} size={12} color={active ? "#FFFFFF" : p.sub} />
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label}</Text>
              </>
            );
            return (
              <TouchableOpacity key={item.id} style={{ flex: 1 }} onPress={() => switchTab(item.id)} activeOpacity={0.8}>
                {active ? (
                  <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tabBtn}>
                    {content}
                  </LinearGradient>
                ) : (
                  <View style={styles.tabBtn}>{content}</View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Profile tab ────────────────────────────────────────── */}
        {tab === "profile" ? (
          <>
            {message.text ? <MessageBanner p={p} styles={styles} message={message} /> : null}

            <SectionCard
              p={p}
              styles={styles}
              icon="user"
              title={t("settings.personalInfo")}
              right={
                !editMode ? (
                  <TouchableOpacity onPress={startEdit} style={styles.editPill} activeOpacity={0.75} disabled={!profile}>
                    <FontAwesome5 name="pen" size={10} color={p.primaryText} />
                    <Text style={styles.editPillText}>{t("common.edit")}</Text>
                  </TouchableOpacity>
                ) : null
              }
            >
              <Field p={p} styles={styles} label={t("settings.firstName")} icon="user" value={form.prenom} editable={editMode}
                onChangeText={(v) => setForm((f) => ({ ...f, prenom: v }))} placeholder={t("settings.firstNamePlaceholder")} />
              <Field p={p} styles={styles} label={t("settings.lastName")} icon="signature" value={form.nom} editable={editMode}
                onChangeText={(v) => setForm((f) => ({ ...f, nom: v }))} placeholder={t("settings.lastNamePlaceholder")} />
              <Field p={p} styles={styles} label={t("settings.email")} icon="envelope" value={email} editable={false}
                hint={editMode ? t("settings.emailHint") : undefined} />
            </SectionCard>

            <SectionCard p={p} styles={styles} icon="phone" title={t("settings.contactInfo")}>
              <Field p={p} styles={styles} label={t("auth.common.phone")} icon="phone" value={form.telephone} editable={editMode}
                keyboardType="phone-pad" onChangeText={(v) => setForm((f) => ({ ...f, telephone: v }))}
                placeholder="6XXXXXXXX" />
              <Field p={p} styles={styles} label={t("settings.address")} icon="map-marker-alt" value={form.adresse} editable={editMode}
                multiline onChangeText={(v) => setForm((f) => ({ ...f, adresse: v }))}
                placeholder={t("settings.addressPlaceholder")} />
            </SectionCard>

            {editMode ? (
              <View style={styles.actionsRow}>
                <TouchableOpacity style={[styles.secondaryBtn, { flex: 1 }]} onPress={cancelEdit} disabled={saving} activeOpacity={0.8}>
                  <Text style={styles.secondaryBtnText}>{t("common.cancel")}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1.4 }} onPress={handleSaveProfile} disabled={saving} activeOpacity={0.85}>
                  <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={[styles.primaryBtn, saving && { opacity: 0.6 }]}>
                    {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <FontAwesome5 name="save" size={13} color="#FFFFFF" />}
                    <Text style={styles.primaryBtnText}>{saving ? t("common.saving") : t("common.save")}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : null}

            <SectionCard p={p} styles={styles} icon="id-card" title={t("settings.accountDetails")}>
              <InfoRow p={p} styles={styles} label={t("settings.role")} value={roleLabel} />
              {etatBadge ? <InfoRow p={p} styles={styles} label={t("settings.status")} value={etatBadge.label} /> : null}
              {memberSince ? <InfoRow p={p} styles={styles} label={t("settings.memberSince")} value={memberSince} /> : null}
              {isProfessor ? (
                <InfoRow p={p} styles={styles} label={t("settings.matricule")} value={profile?.matriculeProfesseur || t("settings.notProvided")} />
              ) : null}
              {isProfessor && profile?.statutVerification ? (
                <InfoRow p={p} styles={styles} label={t("settings.docsSection.verificationStatus")}
                  value={t(`profVerification.statuses.${profile.statutVerification}` as TranslationKey)} />
              ) : null}
              {isStudent ? <InfoRow p={p} styles={styles} label={t("addRole.level")} value={profile?.niveau || t("settings.notProvided")} /> : null}
            </SectionCard>

            {/* Multi-role: profiles of this account, switch / add a profile */}
            {role !== "admin" ? <MyProfilesCard /> : null}

            {isProfessor ? (
              <SectionCard p={p} styles={styles} icon="id-badge" title={t("settings.documents")}>
                {profile && userId ? (
                  <ProfessorDocumentsSection
                    userId={String(userId)}
                    docs={{ cniUrlRecto: profile.cniUrlRecto, cniUrlVerso: profile.cniUrlVerso, selfieUrl: profile.selfieUrl }}
                    statut={profile.statutVerification}
                    motifRejet={profile.motifRejetVerification || null}
                    onUpdated={loadProfile}
                  />
                ) : (
                  <Text style={styles.emptyText}>{t("settings.noDocuments")}</Text>
                )}
              </SectionCard>
            ) : null}
          </>
        ) : null}

        {/* ── Security tab ───────────────────────────────────────── */}
        {tab === "security" ? (
          <>
            <BannerCard p={p} styles={styles} gradient={SECURITY_GRADIENT} icon="shield-alt"
              title={t("settings.securityTitle")} subtitle={t("settings.securitySubtitle")} />

            <SectionCard p={p} styles={styles} icon="lock" title={t("settings.securityStatus")}>
              <StatusRow styles={styles} label={t("auth.common.password")} tone="success" icon="check-circle" />
              <StatusRow
                styles={styles}
                label={profile?.etat === "ACTIVE" ? t("settings.accountActivated") : etatBadge?.label ?? t("settings.unknownStatus")}
                tone={profile?.etat === "ACTIVE" ? "success" : "warning"}
                icon={profile?.etat === "ACTIVE" ? "check-circle" : "exclamation-circle"}
              />
              <StatusRow styles={styles} label={t("settings.secureConnection")} tone="info" icon="shield-alt" />
            </SectionCard>

            <SectionCard p={p} styles={styles} icon="key" title={t("settings.changePassword")}>
              <Field p={p} styles={styles} label={t("settings.currentPassword")} icon="key" value={currentPassword}
                onChangeText={setCurrentPassword} editable secure placeholder={t("settings.currentPasswordPlaceholder")} />
              <Field p={p} styles={styles} label={t("auth.reset.title")} icon="lock" value={newPassword}
                onChangeText={setNewPassword} editable secure placeholder={t("settings.newPasswordPlaceholder")} />

              {newPassword.length > 0 ? (
                <View style={styles.rulesBox}>
                  {passwordChecks.map((c) => (
                    <View key={c.label} style={styles.ruleRow}>
                      <FontAwesome5 name={c.ok ? "check-circle" : "circle"} size={12}
                        color={c.ok ? "#16A34A" : p.muted} solid={c.ok} />
                      <Text style={[styles.ruleText, c.ok && { color: "#16A34A" }]}>{t(c.label)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <Field p={p} styles={styles} label={t("settings.confirmNewPassword")} icon="check-double"
                value={confirmPassword} onChangeText={setConfirmPassword} editable secure
                placeholder={t("settings.confirmNewPasswordPlaceholder")}
                error={confirmPassword.length > 0 && !passwordsMatch ? t("auth.common.passwordMismatch") : undefined} />

              <TouchableOpacity onPress={handleChangePassword} disabled={!canSubmitPassword} activeOpacity={0.85}
                style={{ marginTop: 4 }}>
                <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={[styles.primaryBtn, !canSubmitPassword && { opacity: 0.5 }]}>
                  {changingPassword ? <ActivityIndicator size="small" color="#FFFFFF" /> : <FontAwesome5 name="lock" size={13} color="#FFFFFF" />}
                  <Text style={styles.primaryBtnText}>
                    {changingPassword ? t("settings.changingPassword") : t("settings.changePassword")}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              {pwMessage.text ? (
                <View style={{ marginTop: 12 }}>
                  <MessageBanner p={p} styles={styles} message={pwMessage} />
                </View>
              ) : null}
            </SectionCard>
          </>
        ) : null}

        {/* ── Appearance tab ─────────────────────────────────────── */}
        {tab === "appearance" ? (
          <>
            <BannerCard p={p} styles={styles} gradient={APPEARANCE_GRADIENT} icon="palette"
              title={t("settings.appearanceTitle")} subtitle={t("settings.appearanceSubtitle")} />
            <SectionCard p={p} styles={styles} icon={isDark ? "moon" : "sun"} title={t("settings.displayMode")}>
              <View style={[styles.themeRow, isDark && styles.themeRowActive]}>
                <View style={[styles.themeIcon, { backgroundColor: isDark ? "#2563EB" : "#EAB308" }]}>
                  <FontAwesome5 name={isDark ? "moon" : "sun"} size={16} color="#FFFFFF" solid />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.themeTitle}>{isDark ? t("settings.darkMode") : t("settings.lightMode")}</Text>
                  <Text style={styles.themeSub}>
                    {isDark ? t("settings.darkModeHint") : t("settings.lightModeHint")}
                  </Text>
                </View>
                <Switch
                  value={isDark}
                  onValueChange={() => toggleTheme()}
                  trackColor={{ false: "#D1D5DB", true: "#2563EB" }}
                  thumbColor="#FFFFFF"
                  accessibilityLabel={t("settings.displayMode")}
                />
              </View>
            </SectionCard>
            <SectionCard p={p} styles={styles} icon="globe" title={t("language.label")}>
              <View style={styles.themeRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.themeTitle}>{t("language.current")}</Text>
                  <Text style={styles.themeSub}>{t("language.hint")}</Text>
                </View>
                <LanguageSwitch showIcon={false} />
              </View>
            </SectionCard>
          </>
        ) : null}

        {/* ── Logout ─────────────────────────────────────────────── */}
        <TouchableOpacity style={styles.logoutCard} onPress={() => confirmLogout(onLogout)} activeOpacity={0.8}>
          <View style={styles.logoutIconBox}>
            <FontAwesome5 name="sign-out-alt" size={15} color="#EF4444" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.logoutText}>{t("logout.title")}</Text>
            <Text style={styles.logoutSubtext}>{t("settings.logoutSubtitle")}</Text>
          </View>
          <FontAwesome5 name="chevron-right" size={12} color="#EF4444" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

type Styles = ReturnType<typeof createStyles>;

const MessageBanner = ({ p, styles, message }: { p: Palette; styles: Styles; message: Message }) => {
  const ok = message.type === "success";
  return (
    <View style={[styles.message, ok ? styles.messageSuccess : styles.messageError]}>
      <FontAwesome5 name={ok ? "check-circle" : "exclamation-circle"} size={14}
        color={ok ? (p.isDark ? "#86EFAC" : "#15803D") : p.isDark ? "#FCA5A5" : "#B91C1C"} />
      <Text style={[styles.messageText, { color: ok ? (p.isDark ? "#86EFAC" : "#15803D") : p.isDark ? "#FCA5A5" : "#B91C1C" }]}>
        {message.text}
      </Text>
    </View>
  );
};

const SectionCard = ({
  p,
  styles,
  icon,
  title,
  right,
  children,
}: {
  p: Palette;
  styles: Styles;
  icon: string;
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <View style={[styles.card, styles.section]}>
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        <FontAwesome5 name={icon} size={14} color={p.text} />
        <Text style={styles.sectionTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {right}
    </View>
    {children}
  </View>
);

const BannerCard = ({
  styles,
  gradient,
  icon,
  title,
  subtitle,
}: {
  p: Palette;
  styles: Styles;
  gradient: string[];
  icon: string;
  title: string;
  subtitle: string;
}) => (
  <View style={[styles.card, styles.banner]}>
    <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerIcon}>
      <FontAwesome5 name={icon} size={17} color="#FFFFFF" />
    </LinearGradient>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={styles.bannerTitle}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  </View>
);

const InfoRow = ({ styles, label, value }: { p: Palette; styles: Styles; label: string; value: string }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue} numberOfLines={2}>
      {value}
    </Text>
  </View>
);

const STATUS_TONES = {
  success: { bg: "#DCFCE7", fg: "#166534", icon: "#16A34A" },
  warning: { bg: "#FEF3C7", fg: "#92400E", icon: "#D97706" },
  info: { bg: "#DBEAFE", fg: "#1E40AF", icon: "#2563EB" },
};

const StatusRow = ({
  styles,
  label,
  tone,
  icon,
}: {
  styles: Styles;
  label: string;
  tone: keyof typeof STATUS_TONES;
  icon: string;
}) => {
  const tones = STATUS_TONES[tone];
  return (
    <View style={[styles.statusRow, { backgroundColor: tones.bg }]}>
      <Text style={[styles.statusText, { color: tones.fg }]}>{label}</Text>
      <FontAwesome5 name={icon} size={15} color={tones.icon} solid />
    </View>
  );
};

interface FieldProps {
  p: Palette;
  styles: Styles;
  label: string;
  value: string;
  onChangeText?: (v: string) => void;
  editable: boolean;
  keyboardType?: "email-address" | "phone-pad" | "default";
  multiline?: boolean;
  secure?: boolean;
  icon?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
}

const Field = ({
  p,
  styles,
  label,
  value,
  onChangeText,
  editable,
  keyboardType,
  multiline,
  secure,
  icon,
  placeholder,
  hint,
  error,
}: FieldProps) => {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View
        style={[
          styles.fieldBox,
          editable ? styles.fieldBoxEditable : styles.fieldBoxReadOnly,
          multiline && styles.fieldBoxMultiline,
          !!error && { borderColor: "#FCA5A5" },
        ]}
      >
        {icon ? (
          <FontAwesome5 name={icon} size={13} color={p.muted} style={[styles.fieldIcon, multiline && { marginTop: 2 }]} />
        ) : null}
        {editable ? (
          <TextInput
            style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
            value={value}
            onChangeText={onChangeText}
            keyboardType={keyboardType}
            multiline={multiline}
            secureTextEntry={secure && !visible}
            autoCapitalize={secure ? "none" : "sentences"}
            autoCorrect={!secure}
            placeholder={placeholder}
            placeholderTextColor={p.muted}
          />
        ) : (
          // Read-only values render as plain Text: a disabled TextInput's value
          // sometimes fails to paint on Android.
          <Text style={[styles.fieldInput, styles.fieldReadOnlyText, !value && { color: p.muted }]}
            numberOfLines={multiline ? 4 : 1}>
            {value || translate("settings.notProvided")}
          </Text>
        )}
        {secure ? (
          <TouchableOpacity onPress={() => setVisible((v) => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <FontAwesome5 name={visible ? "eye-slash" : "eye"} size={14} color={p.muted} />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
};

const createStyles = (p: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: p.page },
    centerFill: { alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
    loadingText: { fontSize: 14, color: p.text },
    scrollContent: { paddingHorizontal: 12, paddingTop: 12, gap: 16 },

    card: {
      backgroundColor: p.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: p.border,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },

    // Header
    header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
    headerIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    title: { fontSize: 18, fontWeight: "800", color: p.text, lineHeight: 22 },
    subtitle: { fontSize: 12, color: p.sub },

    // Profile card
    profileCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
    profileName: { fontSize: 17, fontWeight: "800", color: p.text },
    profileEmail: { fontSize: 13, color: p.sub, marginTop: 2 },
    badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 999,
    },
    badgeText: { fontSize: 11, fontWeight: "700" },

    // Tabs
    tabRow: { flexDirection: "row", padding: 4, gap: 4 },
    tabBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 9,
      borderRadius: 12,
    },
    tabText: { fontSize: 12, fontWeight: "600", color: p.sub },
    tabTextActive: { color: "#FFFFFF" },

    // Message
    message: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
    messageSuccess: {
      backgroundColor: p.isDark ? "rgba(22,101,52,0.25)" : "#F0FDF4",
      borderColor: p.isDark ? "rgba(134,239,172,0.35)" : "#BBF7D0",
    },
    messageError: {
      backgroundColor: p.isDark ? "rgba(153,27,27,0.25)" : "#FEF2F2",
      borderColor: p.isDark ? "rgba(252,165,165,0.35)" : "#FECACA",
    },
    messageText: { flex: 1, fontSize: 13, fontWeight: "500" },

    // Sections
    section: { padding: 16 },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 14,
    },
    sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: p.text, flexShrink: 1 },
    editPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: p.primarySoft,
    },
    editPillText: { fontSize: 12, fontWeight: "700", color: p.primaryText },

    banner: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
    bannerTitle: { fontSize: 16, fontWeight: "800", color: p.text },

    // Fields
    fieldGroup: { marginBottom: 12 },
    fieldLabel: { fontSize: 13, fontWeight: "600", color: p.text, marginBottom: 6 },
    fieldBox: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1.5,
      borderRadius: 12,
      paddingHorizontal: 12,
      minHeight: 46,
    },
    fieldBoxEditable: { backgroundColor: p.input, borderColor: p.isDark ? "#4B5563" : "#BFDBFE" },
    fieldBoxReadOnly: { backgroundColor: p.readOnly, borderColor: p.border },
    fieldBoxMultiline: { alignItems: "flex-start", paddingTop: 12 },
    fieldIcon: { marginRight: 10, width: 16, textAlign: "center" },
    fieldInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: p.text },
    fieldInputMultiline: { minHeight: 70, paddingTop: 0, textAlignVertical: "top" },
    fieldReadOnlyText: { fontWeight: "500", paddingTop: 0 },
    fieldError: { marginTop: 5, fontSize: 12, color: "#EF4444", fontWeight: "500" },
    fieldHint: { marginTop: 5, fontSize: 11, color: p.muted },

    actionsRow: { flexDirection: "row", gap: 10 },
    primaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 13,
      borderRadius: 12,
    },
    primaryBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
    secondaryBtn: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 13,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.card,
    },
    secondaryBtnText: { color: p.text, fontWeight: "600", fontSize: 14 },

    // Account details
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: p.divider,
    },
    infoLabel: { fontSize: 13, color: p.sub },
    infoValue: { fontSize: 13, fontWeight: "600", color: p.text, flexShrink: 1, textAlign: "right" },
    emptyText: { fontSize: 13, color: p.muted },

    // Security
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 12,
      borderRadius: 12,
      marginBottom: 8,
    },
    statusText: { fontSize: 13, fontWeight: "600" },
    rulesBox: {
      backgroundColor: p.readOnly,
      borderRadius: 12,
      padding: 10,
      marginTop: -4,
      marginBottom: 12,
      gap: 5,
    },
    ruleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    ruleText: { fontSize: 12, color: p.sub },

    // Appearance
    themeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: p.border,
    },
    themeRowActive: { borderColor: "#3B82F6", backgroundColor: "rgba(30,58,138,0.2)" },
    themeIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    themeTitle: { fontSize: 14, fontWeight: "700", color: p.text },
    themeSub: { fontSize: 12, color: p.sub, marginTop: 2 },

    // Logout
    logoutCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: p.isDark ? "rgba(153,27,27,0.2)" : "#FEF2F2",
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: p.isDark ? "rgba(252,165,165,0.3)" : "#FECACA",
    },
    logoutIconBox: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(239, 68, 68, 0.15)",
      alignItems: "center",
      justifyContent: "center",
    },
    logoutText: { fontSize: 14, fontWeight: "700", color: "#EF4444" },
    logoutSubtext: { fontSize: 12, color: p.sub, marginTop: 1 },
  });

export default AccountSettingsBody;
