import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Badge, LoadingSpinner, QuickActionGrid } from "../../components/ui";
import { colors, radius, shadow, spacing, typography, useThemeColors } from "../../styles/theme";
import {
  classAdminService,
  establishmentService,
  matiereService,
  professorService,
  userService,
} from "../../services/api";
import { ClassEntity, Etablissement, Matiere, Professor } from "../../types";
import { useUser } from "../../context/UserContext";
import { useAuthStore } from "../../store/useAuthStore";
import type { QuickAction } from "./QuickActionsSheet";

// LinearGradient via expo-linear-gradient (safe fallback to View if unavailable)
let LinearGradient: any;
try {
  LinearGradient = require("expo-linear-gradient").LinearGradient;
} catch {
  LinearGradient = ({ children, style }: any) => <View style={style}>{children}</View>;
}

const SCREEN_W = Dimensions.get("window").width;

interface DashboardContentBodyProps {
  accentColor?: string;
  quickActions?: QuickAction[];
  onQuickAction?: (item: QuickAction) => void;
  onNavigate?: (tab: string) => void;
}

const SectionTitle = ({ icon, label, actionLabel, onAction }: { icon: string; label: string; actionLabel?: string; onAction?: () => void }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
  <View style={styles.sectionHeaderRow}>
    <View style={styles.sectionTitleWrap}>
      <View style={styles.sectionIconBox}>
        <FontAwesome5 name={icon as any} size={12} color={colors.primary} />
      </View>
      <Text style={styles.sectionTitleText}>{label}</Text>
    </View>
    {actionLabel && onAction ? (
      <TouchableOpacity onPress={onAction} style={styles.sectionActionBtn} activeOpacity={0.7}>
        <Text style={styles.sectionActionText}>{actionLabel}</Text>
        <FontAwesome5 name="chevron-right" size={10} color={colors.primary} />
      </TouchableOpacity>
    ) : null}
  </View>
  );
};

const DashboardContentBody = ({
  accentColor = colors.primary,
  quickActions = [],
  onQuickAction,
  onNavigate,
}: DashboardContentBodyProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useUser();
  const currentRole = useAuthStore((s) => s.role);
  const isAdmin = currentRole === "admin";
  const isProfessor = currentRole === "professor" || currentRole === "tutor";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [establishments, setEstablishments] = useState<Etablissement[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  const navigate = (tab: string) => {
    if (onNavigate) {
      onNavigate(tab);
    } else if (onQuickAction) {
      onQuickAction({ icon: "circle", label: tab, color: colors.primary, tab });
    }
  };

  const load = useCallback(async () => {
    setError("");
    try {
      const [profs, cls, mats, ests, pending] = await Promise.all([
        professorService.getAll().catch(() => []),
        classAdminService.getAll().catch(() => []),
        matiereService.getAll().catch(() => []),
        establishmentService.getAll().catch(() => []),
        userService.getPendingProfessors().catch(() => [] as unknown[]),
      ]);
      setProfessors(profs);
      setClasses(cls);
      setMatieres(mats);
      setEstablishments(ests);
      setPendingCount(Array.isArray(pending) ? pending.length : ((pending as any)?.content ?? []).length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors du chargement des données.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) return <LoadingSpinner label="Chargement du tableau de bord..." fullScreen />;

  const activeClasses = classes.filter((c) => (c.etat as string) === "ACTIF").length;
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const todayFormatted = today.charAt(0).toUpperCase() + today.slice(1);

  // Greeting title & role text
  let greetingTitle = "Bonjour 👋";
  let greetingSubtitle = "Tableau de bord";
  let roleBadgeLabel = "Utilisateur";

  if (isAdmin) {
    greetingTitle = "Bonjour Admin 👋";
    greetingSubtitle = "Tableau de bord d'administration générale";
    roleBadgeLabel = "👑 Administrateur Système";
  } else if (isProfessor) {
    const profName = user?.prenom ? ` ${user.prenom}` : "";
    greetingTitle = `Bonjour Professeur${profName} 👋`;
    greetingSubtitle = "Espace pédagogique & suivi des cours";
    roleBadgeLabel = "👨‍🏫 Enseignant";
  } else {
    const name = user?.prenom ? ` ${user.prenom}` : "";
    greetingTitle = `Bonjour${name} 👋`;
    greetingSubtitle = "Bienvenue sur SchoolChat";
    roleBadgeLabel = user?.role || "Membre";
  }

  return (
    <ScrollView
      style={styles.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
    >
      {/* ── Hero Banner with Prominent Greeting ────────────────────── */}
      <LinearGradient
        colors={[colors.heroStart, colors.heroMid, colors.heroEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroHeaderRow}>
          <View style={styles.heroTextCol}>
            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>{roleBadgeLabel}</Text>
            </View>
            <Text style={styles.heroGreetingText}>{greetingTitle}</Text>
            <Text style={styles.heroSubtitleText}>{greetingSubtitle}</Text>
            <View style={styles.dateRow}>
              <FontAwesome5 name="calendar-alt" size={11} color="rgba(255,255,255,0.7)" />
              <Text style={styles.dateText}>{todayFormatted}</Text>
            </View>
          </View>

          <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn} activeOpacity={0.8}>
            <FontAwesome5 name="sync-alt" size={13} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Inline Quick Action shortcuts if provided */}
        {quickActions.length > 0 && onQuickAction && (
          <View style={styles.quickActionsWrap}>
            <QuickActionGrid items={quickActions} onSelect={onQuickAction} />
          </View>
        )}
      </LinearGradient>

      <View style={styles.body}>
        {error ? (
          <View style={styles.errorBox}>
            <FontAwesome5 name="exclamation-circle" size={14} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ── Attention / Validation Alert Banner for Admin ────────────── */}
        {isAdmin && (
          pendingCount > 0 ? (
            <TouchableOpacity
              style={styles.alertBanner}
              onPress={() => navigate("users-pending")}
              activeOpacity={0.85}
            >
              <View style={styles.alertIconBox}>
                <FontAwesome5 name="user-clock" size={18} color="#D97706" />
              </View>
              <View style={styles.alertContent}>
                <View style={styles.alertTitleRow}>
                  <Text style={styles.alertTitle}>Validations requises</Text>
                  <View style={styles.alertBadge}>
                    <Text style={styles.alertBadgeText}>{pendingCount} en attente</Text>
                  </View>
                </View>
                <Text style={styles.alertSub}>
                  {pendingCount === 1
                    ? "1 inscription nécessite votre approbation."
                    : `${pendingCount} inscriptions nécessitent votre approbation.`}
                </Text>
              </View>
              <FontAwesome5 name="chevron-right" size={13} color="#D97706" />
            </TouchableOpacity>
          ) : (
            <View style={styles.successBanner}>
              <View style={styles.successIconBox}>
                <FontAwesome5 name="check-circle" size={16} color={colors.success} solid />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.successTitle}>Système à jour</Text>
                <Text style={styles.successSub}>Aucune demande d'inscription en attente de validation.</Text>
              </View>
            </View>
          )
        )}

        {/* ── Key Metrics Overview (Real Data KPIs) ───────────────────── */}
        <SectionTitle icon="tachometer-alt" label="Vue d'ensemble" />
        <View style={styles.metricsGrid}>
          {/* Classes Card */}
          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => navigate("classes")}
            activeOpacity={0.8}
          >
            <View style={[styles.metricAccent, { backgroundColor: "#6366F1" }]} />
            <View style={styles.metricCardBody}>
              <View style={styles.metricTopRow}>
                <View style={[styles.metricIconBox, { backgroundColor: "#EEF2FF" }]}>
                  <FontAwesome5 name="chalkboard" size={16} color="#6366F1" />
                </View>
                <View style={styles.metricTag}>
                  <Text style={[styles.metricTagText, { color: "#6366F1" }]}>{activeClasses} actives</Text>
                </View>
              </View>
              <Text style={styles.metricNumber}>{classes.length}</Text>
              <Text style={styles.metricLabel}>Classes au total</Text>
            </View>
          </TouchableOpacity>

          {/* Professeurs Card */}
          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => navigate("users-professeurs")}
            activeOpacity={0.8}
          >
            <View style={[styles.metricAccent, { backgroundColor: "#0EA5E9" }]} />
            <View style={styles.metricCardBody}>
              <View style={styles.metricTopRow}>
                <View style={[styles.metricIconBox, { backgroundColor: "#F0F9FF" }]}>
                  <FontAwesome5 name="user-graduate" size={16} color="#0EA5E9" />
                </View>
                <View style={[styles.metricTag, { backgroundColor: "#E0F2FE" }]}>
                  <Text style={[styles.metricTagText, { color: "#0284C7" }]}>Inscrits</Text>
                </View>
              </View>
              <Text style={styles.metricNumber}>{professors.length}</Text>
              <Text style={styles.metricLabel}>Professeurs</Text>
            </View>
          </TouchableOpacity>

          {/* Établissements Card */}
          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => navigate("schools")}
            activeOpacity={0.8}
          >
            <View style={[styles.metricAccent, { backgroundColor: "#10B981" }]} />
            <View style={styles.metricCardBody}>
              <View style={styles.metricTopRow}>
                <View style={[styles.metricIconBox, { backgroundColor: "#ECFDF5" }]}>
                  <FontAwesome5 name="school" size={16} color="#10B981" />
                </View>
                <View style={[styles.metricTag, { backgroundColor: "#D1FAE5" }]}>
                  <Text style={[styles.metricTagText, { color: "#059669" }]}>Écoles</Text>
                </View>
              </View>
              <Text style={styles.metricNumber}>{establishments.length}</Text>
              <Text style={styles.metricLabel}>Établissements</Text>
            </View>
          </TouchableOpacity>

          {/* Matières Card */}
          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => navigate("matieres")}
            activeOpacity={0.8}
          >
            <View style={[styles.metricAccent, { backgroundColor: "#64748B" }]} />
            <View style={styles.metricCardBody}>
              <View style={styles.metricTopRow}>
                <View style={[styles.metricIconBox, { backgroundColor: "#F1F5F9" }]}>
                  <FontAwesome5 name="book" size={16} color="#475569" />
                </View>
                <View style={[styles.metricTag, { backgroundColor: "#E2E8F0" }]}>
                  <Text style={[styles.metricTagText, { color: "#334155" }]}>Programmes</Text>
                </View>
              </View>
              <Text style={styles.metricNumber}>{matieres.length}</Text>
              <Text style={styles.metricLabel}>Matières</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Admin Management Hub (Role based) ────────────────────────── */}
        {isAdmin && (
          <>
            <SectionTitle icon="th" label="Espace de Gestion" />
            <View style={styles.hubGrid}>
              {[
                {
                  id: "users",
                  title: "Utilisateurs",
                  sub: "Admins, Professeurs, Parents, Élèves",
                  icon: "users",
                  gradient: ["#4F46E5", "#6366F1"],
                  tab: "users",
                  badge: pendingCount > 0 ? `${pendingCount} en attente` : undefined,
                },
                {
                  id: "schools",
                  title: "Établissements & Offres",
                  sub: "Souscriptions, Forfaits, Tarifs",
                  icon: "school",
                  gradient: ["#0D9488", "#10B981"],
                  tab: "schools",
                },
                {
                  id: "classes",
                  title: "Gestion des Classes",
                  sub: "Niveaux, effectifs & modération",
                  icon: "chalkboard",
                  gradient: ["#8B5CF6", "#A855F7"],
                  tab: "classes",
                },
                {
                  id: "matieres",
                  title: "Matières & Disciplines",
                  sub: "Gestion des programmes d'étude",
                  icon: "book-open",
                  gradient: ["#EC4899", "#F43F5E"],
                  tab: "matieres",
                },
                {
                  id: "gestionnaires",
                  title: "Gestionnaires d'Écoles",
                  sub: "Comptes délégués d'établissements",
                  icon: "user-shield",
                  gradient: ["#F59E0B", "#F97316"],
                  tab: "gestionnaires",
                },
                {
                  id: "motifs",
                  title: "Motifs de Rejet",
                  sub: "Configuration des motifs de refus",
                  icon: "exclamation-triangle",
                  gradient: ["#64748B", "#475569"],
                  tab: "motifs",
                },
              ].map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.hubCard}
                  onPress={() => navigate(item.tab)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={item.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.hubIconBox}
                  >
                    <FontAwesome5 name={item.icon as any} size={18} color={colors.white} />
                  </LinearGradient>
                  <View style={styles.hubContent}>
                    <View style={styles.hubTitleRow}>
                      <Text style={styles.hubTitle}>{item.title}</Text>
                      {item.badge ? (
                        <View style={styles.hubBadge}>
                          <Text style={styles.hubBadgeText}>{item.badge}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.hubSub} numberOfLines={1}>{item.sub}</Text>
                  </View>
                  <FontAwesome5 name="chevron-right" size={12} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* ── Real Live Data: Dernières Classes ───────────────────────── */}
        <SectionTitle
          icon="chalkboard-teacher"
          label="Dernières Classes"
          actionLabel="Gérer toutes"
          onAction={() => navigate("classes")}
        />
        <View style={styles.listCard}>
          {classes.length === 0 ? (
            <View style={styles.emptyWrap}>
              <FontAwesome5 name="folder-open" size={24} color={colors.textMuted} />
              <Text style={styles.emptyText}>Aucune classe trouvée</Text>
            </View>
          ) : (
            classes.slice(0, 4).map((c, i) => {
              const isActive = (c.etat as string)?.toUpperCase() === "ACTIF";
              return (
                <TouchableOpacity
                  key={c.id || i}
                  style={[styles.listItemRow, i > 0 && styles.listItemBorder]}
                  onPress={() => navigate("classes")}
                  activeOpacity={0.7}
                >
                  <View style={[styles.listAvatar, { backgroundColor: isActive ? "#ECFDF5" : "#FFFBEB" }]}>
                    <FontAwesome5
                      name="users"
                      size={13}
                      color={isActive ? colors.success : colors.warning}
                    />
                  </View>
                  <View style={styles.listContent}>
                    <Text style={styles.listTitle} numberOfLines={1}>
                      {c.nom || "Classe sans nom"}
                    </Text>
                    <Text style={styles.listSub}>
                      {c.niveau ? `Niveau: ${c.niveau}` : "Niveau non spécifié"}
                      {c.code ? ` · Code: ${c.code}` : ""}
                    </Text>
                  </View>
                  <Badge
                    label={isActive ? "Actif" : (c.etat as string) || "En attente"}
                    tone={isActive ? "success" : "warning"}
                  />
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* ── Real Live Data: Récents Professeurs ─────────────────────── */}
        <SectionTitle
          icon="user-check"
          label="Professeurs Référents"
          actionLabel="Voir tous"
          onAction={() => navigate("users-professeurs")}
        />
        <View style={styles.listCard}>
          {professors.length === 0 ? (
            <View style={styles.emptyWrap}>
              <FontAwesome5 name="user-friends" size={24} color={colors.textMuted} />
              <Text style={styles.emptyText}>Aucun professeur enregistré</Text>
            </View>
          ) : (
            professors.slice(0, 4).map((p, i) => {
              const initials = `${p.prenom?.charAt(0) || ""}${p.nom?.charAt(0) || ""}`.toUpperCase() || "PR";
              return (
                <TouchableOpacity
                  key={p.id || i}
                  style={[styles.listItemRow, i > 0 && styles.listItemBorder]}
                  onPress={() => navigate("users-professeurs")}
                  activeOpacity={0.7}
                >
                  <View style={[styles.listAvatarCircle, { backgroundColor: colors.primaryLight }]}>
                    <Text style={styles.listAvatarText}>{initials}</Text>
                  </View>
                  <View style={styles.listContent}>
                    <Text style={styles.listTitle} numberOfLines={1}>
                      {p.prenom} {p.nom}
                    </Text>
                    <Text style={styles.listSub} numberOfLines={1}>
                      {p.email || p.telephone || "Enseignant certifié"}
                    </Text>
                  </View>
                  <Badge label="Certifié" tone="info" />
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* ── Timeline des Activités Récentes ─────────────────────────── */}
        <SectionTitle
          icon="history"
          label="Activités Récentes"
          actionLabel="Journal complet"
          onAction={() => navigate("activities")}
        />
        <View style={styles.activityCard}>
          {[
            {
              icon: "user-plus",
              color: "#4F46E5",
              title: "Nouveau compte enseignant",
              sub: professors[0] ? `${professors[0].prenom} ${professors[0].nom}` : "Professeur inscrit",
              time: "Il y a 1h",
            },
            {
              icon: "chalkboard",
              color: "#10B981",
              title: "Classe mise à jour",
              sub: classes[0]?.nom ? `Classe ${classes[0].nom}` : "Structure de classe",
              time: "Il y a 3h",
            },
            {
              icon: "school",
              color: "#0EA5E9",
              title: "Établissement rattaché",
              sub: establishments[0]?.nom ? establishments[0].nom : "Plateforme ScholChat",
              time: "Aujourd'hui",
            },
            {
              icon: "book",
              color: "#8B5CF6",
              title: "Programme & Matière",
              sub: matieres[0]?.nom ? `Matière ${matieres[0].nom}` : "Discipline validée",
              time: "Hier",
            },
          ].map((act, i) => (
            <View key={i} style={styles.activityItem}>
              <View style={[styles.activityDot, { backgroundColor: act.color }]}>
                <FontAwesome5 name={act.icon as any} size={11} color={colors.white} />
              </View>
              <View style={styles.activityDetails}>
                <Text style={styles.activityTitle}>{act.title}</Text>
                <Text style={styles.activitySub}>{act.sub}</Text>
              </View>
              <Text style={styles.activityTime}>{act.time}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 110 }} />
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },

  // Hero Header
  hero: {
    // Fallback if LinearGradient ever fails — keeps the white greeting text
    // readable instead of white-on-white.
    backgroundColor: colors.heroStart,
    paddingTop: 54,
    paddingBottom: 22,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
    ...shadow.hero,
  },
  heroHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  heroTextCol: { flex: 1 },
  rolePill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    marginBottom: 8,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.white,
    letterSpacing: 0.3,
  },
  heroGreetingText: {
    fontSize: 27,
    fontWeight: "800",
    color: colors.white,
    letterSpacing: -0.6,
  },
  heroSubtitleText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
    lineHeight: 18,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  dateText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    ...shadow.sm,
  },
  quickActionsWrap: {
    marginTop: 18,
  },

  // Body
  body: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.dangerLight,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: 16,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    flex: 1,
  },

  // Alert Banners
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    borderWidth: 1.5,
    borderColor: "#FCD34D",
    borderRadius: radius.xl,
    padding: 14,
    marginBottom: 20,
    gap: 12,
    ...shadow.sm,
  },
  alertIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  alertContent: { flex: 1 },
  alertTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  alertTitle: { fontSize: 14, fontWeight: "700", color: "#92400E" },
  alertBadge: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  alertBadgeText: { fontSize: 10, fontWeight: "800", color: colors.white },
  alertSub: { fontSize: 12, color: "#B45309", marginTop: 2 },

  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: radius.xl,
    padding: 12,
    marginBottom: 20,
    gap: 10,
  },
  successIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: { fontSize: 13, fontWeight: "700", color: "#065F46" },
  successSub: { fontSize: 11, color: "#047857", marginTop: 1 },

  // Section Header
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionIconBox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitleText: {
    ...typography.h4,
    color: colors.text,
    fontSize: 15,
  },
  sectionActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sectionActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },

  // Metrics Grid
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 22,
  },
  metricCard: {
    width: (SCREEN_W - 42) / 2,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  metricAccent: {
    height: 3.5,
  },
  metricCardBody: {
    padding: 14,
  },
  metricTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  metricIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  metricTag: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  metricTagText: {
    fontSize: 10,
    fontWeight: "700",
  },
  metricNumber: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.5,
  },
  metricLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "600",
    marginTop: 2,
  },

  // Management Hub
  hubGrid: {
    gap: 10,
    marginBottom: 22,
  },
  hubCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    ...shadow.sm,
  },
  hubIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  hubContent: { flex: 1 },
  hubTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  hubTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  hubBadge: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  hubBadgeText: { fontSize: 9, fontWeight: "800", color: colors.white },
  hubSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  // List Cards
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 22,
    overflow: "hidden",
    ...shadow.card,
  },
  listItemRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },
  listItemBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  listAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  listAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  listAvatarText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.primary,
  },
  listContent: { flex: 1 },
  listTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
  listSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 8,
  },
  emptyText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "500",
  },

  // Activities Card
  activityCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    gap: 12,
    ...shadow.card,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  activityDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  activityDetails: { flex: 1 },
  activityTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
  activitySub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  activityTime: { fontSize: 11, color: colors.textMuted, fontWeight: "500" },
});

export default DashboardContentBody;
