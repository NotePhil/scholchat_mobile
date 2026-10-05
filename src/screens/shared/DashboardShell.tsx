import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import AppHeader from "./AppHeader";
import AccountSettingsBody from "./AccountSettingsBody";
import MobileFooterNav from "./MobileFooterNav";
import QuickActionsSheet, { QuickAction } from "./QuickActionsSheet";
import { useUiStore } from "../../store/useUiStore";
import { useAuthStore } from "../../store/useAuthStore";
import { colors, useThemeColors } from "../../styles/theme";
import { AppRole } from "../../types";
import { TFunction, TranslationKey, useT } from "../../i18n";
import ProfessorVerificationStatusScreen from "../professeurs/ProfessorVerificationStatusScreen";

// Shared across every role
import DashboardActivitiesBody from "../professeurs/components/DashboardActivitiesBody";
import DashboardMessagesBody from "../professeurs/components/messages/DashboardMessagesBody";
import DashboardContentBody from "./DashboardContentBody";
import StudentParentStatsBody from "./StudentParentStatsBody";

import AdminUsersBody from "../admin/components/AdminUsersBody";
import AdminClassesBody from "../admin/components/AdminClassesBody";
import AdminSchoolsBody from "../admin/components/AdminSchoolsBody";
import MotifsDeRejetBody from "../admin/components/MotifsDeRejetBody";
import GestionnairesBody from "../admin/components/GestionnairesBody";

// Professor / Tutor
import DashboardUsersBody from "../professeurs/components/DashboardUsersBody";
import DashboardCoursBody, { Cours } from "../professeurs/components/cours/DashboardCoursBody";
import CreateCoursBody from "../professeurs/components/cours/CreateCoursBody";
import DashboardExercisesBody from "../professeurs/components/exercise/DashboardExercisesBody";
import DashboardClassesBody from "../professeurs/components/classes/DashboardClassesBody";
import MatieresBody from "../professeurs/components/MatieresBody";

// Parent
import ParentChildrenBody from "../parent/ParentChildrenBody";
import ParentClassesBody from "../parent/ParentClassesBody";
import ParentCoursesBody from "../parent/ParentCoursesBody";
import ParentExercisesBody from "../parent/ParentExercisesBody";

// Student
import StudentClassesBody from "../student/StudentClassesBody";
import StudentExercisesBody from "../student/StudentExercisesBody";
import StudentCoursesBody from "../student/StudentCoursesBody";

// Establishment / Gestionnaire
import EstablishmentOverviewBody from "../establishment/EstablishmentOverviewBody";
import EstablishmentListBody from "../establishment/EstablishmentListBody";
import EstablishmentClassesBody from "../establishment/EstablishmentClassesBody";

interface DashboardShellProps {
  onLogout: () => void;
}

/** Quick action whose label is a translation key (localized at render time). */
type QuickActionDef = Omit<QuickAction, "label"> & { label: TranslationKey };

const localizeActions = (t: TFunction, items: QuickActionDef[]): QuickAction[] =>
  items.map((item) => ({ ...item, label: t(item.label) }));

// Mirrors scholchat_front's Sidebar.jsx admin menu: order, labels, and the
// Classes/Établissements dropdown grouping (Créer/Gérer sub-items each).
const ADMIN_QUICK_ACTIONS: QuickActionDef[] = [
  { icon: "home", label: "menu.home", color: "#6366F1", tab: "dashboard" },
  { icon: "heartbeat", label: "menu.activities", color: "#3B82F6", tab: "activities" },
  { icon: "users", label: "menu.manageUsers", color: "#7C3AED", submenu: "users" },
  { icon: "user-tie", label: "menu.gestionnaires", color: "#0D9488", tab: "gestionnaires" },
  { icon: "graduation-cap", label: "menu.subjects", color: "#A855F7", tab: "matieres" },
  { icon: "exclamation-circle", label: "menu.rejectionReasons", color: "#F97316", tab: "motifs" },
  { icon: "chalkboard", label: "menu.classes", color: "#0891B2", submenu: "classes" },
  { icon: "school", label: "menu.establishments", color: "#0D9488", submenu: "establishments" },
  { icon: "clipboard-list", label: "menu.offers", color: "#DB2777", tab: "offers" },
  { icon: "envelope", label: "menu.messaging", color: "#0EA5E9", tab: "messages" },
  { icon: "cog", label: "menu.settings", color: "#64748B", tab: "settings" },
];

const ADMIN_QUICK_ACTION_SUBMENUS: Record<string, QuickActionDef[]> = {
  users: [
    { icon: "user-shield", label: "menu.admin", color: "#7C3AED", tab: "users-admins" },
    { icon: "chalkboard-teacher", label: "menu.professors", color: "#3B82F6", tab: "users-professeurs" },
    { icon: "user-friends", label: "menu.parents", color: "#F59E0B", tab: "users-parents" },
    { icon: "user-graduate", label: "menu.students", color: "#10B981", tab: "users-eleves" },
    { icon: "user", label: "menu.others", color: "#6B7280", tab: "users-autres" },
    { icon: "building", label: "menu.gestionnaires", color: "#0D9488", tab: "users-gestionnaires" },
    { icon: "user-clock", label: "menu.pending", color: "#DC2626", tab: "users-pending" },
  ],
  classes: [
    { icon: "plus-circle", label: "menu.createClass", color: "#10B981", tab: "create-class" },
    { icon: "chalkboard", label: "menu.manageClass", color: "#0891B2", tab: "classes" },
  ],
  establishments: [
    { icon: "plus-circle", label: "menu.createEstablishment", color: "#10B981", tab: "create-establishment" },
    { icon: "school", label: "menu.manageEstablishment", color: "#0D9488", tab: "schools" },
  ],
};

const PROFESSOR_QUICK_ACTIONS: QuickActionDef[] = [
  { icon: "home", label: "menu.home", color: "#6366F1", tab: "dashboard" },
  { icon: "heartbeat", label: "menu.activities", color: "#3B82F6", tab: "activities" },
  { icon: "book-open", label: "menu.courses", color: "#10B981", tab: "cours" },
  { icon: "graduation-cap", label: "menu.subjects", color: "#A855F7", tab: "matieres" },
  { icon: "clipboard-list", label: "menu.exercises", color: "#F59E0B", tab: "exercises" },
  { icon: "users", label: "menu.users", color: "#8B5CF6", tab: "users" },
  { icon: "door-open", label: "menu.classes", color: "#06B6D4", tab: "class" },
  { icon: "envelope", label: "menu.messaging", color: "#0EA5E9", tab: "messages" },
  { icon: "cog", label: "menu.settings", color: "#64748B", tab: "settings" },
];

const PARENT_QUICK_ACTIONS: QuickActionDef[] = [
  { icon: "home", label: "menu.home", color: "#6366F1", tab: "dashboard" },
  { icon: "heartbeat", label: "menu.activities", color: "#3B82F6", tab: "activities" },
  { icon: "clipboard-list", label: "menu.homework", color: "#F59E0B", tab: "exercises" },
  { icon: "chalkboard", label: "menu.classes", color: "#10B981", tab: "classes" },
  { icon: "book-open", label: "menu.myCourses", color: "#8B5CF6", tab: "courses" },
  { icon: "child", label: "menu.children", color: "#A855F7", tab: "children" },
  { icon: "envelope", label: "menu.messaging", color: "#0EA5E9", tab: "messages" },
  { icon: "cog", label: "menu.settings", color: "#64748B", tab: "settings" },
];

const STUDENT_QUICK_ACTIONS: QuickActionDef[] = [
  { icon: "home", label: "menu.home", color: "#6366F1", tab: "dashboard" },
  { icon: "heartbeat", label: "menu.activities", color: "#3B82F6", tab: "activities" },
  { icon: "clipboard-list", label: "menu.homework", color: "#F59E0B", tab: "exercises" },
  { icon: "chalkboard", label: "menu.classes", color: "#10B981", tab: "classes" },
  { icon: "book-open", label: "menu.myCourses", color: "#8B5CF6", tab: "courses" },
  { icon: "envelope", label: "menu.messaging", color: "#0EA5E9", tab: "messages" },
  { icon: "cog", label: "menu.settings", color: "#64748B", tab: "settings" },
];

const ESTABLISHMENT_QUICK_ACTIONS: QuickActionDef[] = [
  { icon: "home", label: "menu.home", color: "#6366F1", tab: "dashboard" },
  { icon: "heartbeat", label: "menu.activities", color: "#3B82F6", tab: "activities" },
  { icon: "school", label: "menu.schools", color: "#0D9488", tab: "establishments" },
  { icon: "chalkboard", label: "menu.classes", color: "#10B981", tab: "classes" },
  { icon: "envelope", label: "menu.messaging", color: "#0EA5E9", tab: "messages" },
  { icon: "cog", label: "menu.settings", color: "#64748B", tab: "settings" },
];

// Mirrors scholchat_front's Sidebar.jsx gestionnaire branch (and MobileBottomNav's
// "Écoles"/"Classes" entries): Tableau de bord, Activités, Établissements (list —
// creating/deleting an établissement is admin-only), Classes ▸ (Créer / Gérer),
// Messagerie, Paramètres.
const GESTIONNAIRE_QUICK_ACTIONS: QuickActionDef[] = [
  { icon: "home", label: "menu.home", color: "#6366F1", tab: "dashboard" },
  { icon: "heartbeat", label: "menu.activities", color: "#3B82F6", tab: "activities" },
  { icon: "school", label: "menu.establishments", color: "#0D9488", tab: "manage-establishment" },
  { icon: "chalkboard", label: "menu.classes", color: "#10B981", submenu: "classes" },
  { icon: "envelope", label: "menu.messaging", color: "#0EA5E9", tab: "messages" },
  { icon: "cog", label: "menu.settings", color: "#64748B", tab: "settings" },
];

const GESTIONNAIRE_QUICK_ACTION_SUBMENUS: Record<string, QuickActionDef[]> = {
  classes: [
    { icon: "plus-circle", label: "menu.createClass", color: "#10B981", tab: "create-class" },
    { icon: "chalkboard", label: "menu.manageClass", color: "#0891B2", tab: "manage-class" },
  ],
};

// Fallback for a token whose role we don't recognise (AppRole "unknown", e.g. a
// bare ROLE_USER). Mirrors web Sidebar's catch-all branch minus admin-only
// items: such a user must never inherit the professor's creation/management
// screens just because the professor branch used to be the `default`.
const BASIC_QUICK_ACTIONS: QuickActionDef[] = [
  { icon: "heartbeat", label: "menu.activities", color: "#3B82F6", tab: "activities" },
  { icon: "envelope", label: "menu.messaging", color: "#0EA5E9", tab: "messages" },
  { icon: "cog", label: "menu.settings", color: "#64748B", tab: "settings" },
];

interface RoleConfigDef {
  accentColor: string;
  quickActions: QuickActionDef[];
  submenus?: Record<string, QuickActionDef[]>;
}

interface RoleConfig {
  roleLabel: string;
  accentColor: string;
  quickActions: QuickAction[];
  submenus?: Record<string, QuickAction[]>;
}

const ROLE_CONFIG: Partial<Record<AppRole, RoleConfigDef>> = {
  admin: { accentColor: colors.danger, quickActions: ADMIN_QUICK_ACTIONS, submenus: ADMIN_QUICK_ACTION_SUBMENUS },
  professor: { accentColor: colors.primary, quickActions: PROFESSOR_QUICK_ACTIONS },
  tutor: { accentColor: colors.primary, quickActions: PROFESSOR_QUICK_ACTIONS },
  parent: { accentColor: colors.warning, quickActions: PARENT_QUICK_ACTIONS },
  student: { accentColor: colors.info, quickActions: STUDENT_QUICK_ACTIONS },
  establishment: { accentColor: colors.success, quickActions: ESTABLISHMENT_QUICK_ACTIONS },
  gestionnaire: { accentColor: colors.success, quickActions: GESTIONNAIRE_QUICK_ACTIONS, submenus: GESTIONNAIRE_QUICK_ACTION_SUBMENUS },
  unknown: { accentColor: colors.primary, quickActions: BASIC_QUICK_ACTIONS },
};

/**
 * Single shared dashboard shell for all 5 roles — mirrors scholchat_front's
 * Principal.jsx exactly: ONE component (header + body + footer nav + quick
 * actions), with role read from the auth store driving which tab→component
 * map, accent color, and quick-actions grid apply, instead of a separate
 * near-identical shell file per role.
 */
const DashboardShell = ({ onLogout }: DashboardShellProps) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const role = useAuthStore((s) => s.role);
  const user = useAuthStore((s) => s.user);
  const { t } = useT();
  // Mirrors web's post-login redirect (Login.jsx → `/…Dashboard/activities`): every
  // role lands on Activités first, not the home dashboard tab.
  const [activeTab, setActiveTabState] = useState("activities");
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [coursViewMode, setCoursViewMode] = useState<"list" | "create">("list");
  const [editingCours, setEditingCours] = useState<Cours | null>(null);
  const pendingTab = useUiStore((s) => s.pendingTab);
  const clearPendingTab = useUiStore((s) => s.clearPendingTab);

  // Professor profile not validated by the admin (documents missing, under review or
  // rejected): no professor dashboard at all — the server refuses every professor action
  // anyway (403 PROFIL_PROFESSEUR_NON_VALIDE). An unknown status (legacy session, or reset by
  // the API interceptor after such a 403) also gates: the status screen re-reads it first.
  // Répétiteurs (tutor) have no document validation.
  const professorNotValidated = role === "professor" && user?.professeurStatutVerification !== "VALIDE";

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    if (tab !== "cours") {
      setCoursViewMode("list");
      setEditingCours(null);
    }
  };

  // Handles a tap on the home screen's inline QuickActionGrid — same
  // branching QuickActionsSheet does internally, centralized here since this
  // is also where `showQuickActions` already lives.
  const handleQuickAction = (item: QuickAction) => {
    if (item.submenu) {
      setShowQuickActions(true);
    } else if (item.tab) {
      setActiveTab(item.tab);
    }
  };

  // Switching role (RoleSelectorSheet → auth switch-role) swaps the whole
  // tab→screen map; a tab that belonged to the previous role (e.g. the
  // professor's "users") must not linger, so land on Activités like a fresh
  // login. Declared before the pendingTab effect so an explicit request wins.
  const previousRole = useRef(role);
  useEffect(() => {
    if (previousRole.current === role) return;
    previousRole.current = role;
    setActiveTab("activities");
    setShowQuickActions(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // Picks up a tab switch requested from outside this instance (e.g. tapping a
  // message notification on the separate stack-pushed NotificationsScreen).
  useEffect(() => {
    if (pendingTab) {
      setActiveTab(pendingTab);
      clearPendingTab();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTab, clearPendingTab]);

  const config: RoleConfig = useMemo(() => {
    const def = ROLE_CONFIG[role] ?? (ROLE_CONFIG.unknown as RoleConfigDef);
    return {
      roleLabel: t(`roles.${role}`),
      accentColor: def.accentColor,
      quickActions: localizeActions(t, def.quickActions),
      submenus: def.submenus
        ? Object.fromEntries(Object.entries(def.submenus).map(([key, items]) => [key, localizeActions(t, items)]))
        : undefined,
    };
  }, [role, t]);
  // Drop the self-referencing "Accueil" tile from the inline home-screen
  // grid — it still makes sense in the full QuickActionsSheet (jump home
  // from anywhere), but is redundant while already on the home screen.
  const homeQuickActions = config.quickActions.filter((a) => a.tab !== "dashboard");

  const handleNavigateToCreateCours = () => {
    setEditingCours(null);
    setCoursViewMode("create");
  };
  const handleEditCours = (cours: Cours) => {
    setEditingCours(cours);
    setCoursViewMode("create");
  };
  const handleBackToCoursList = () => {
    setEditingCours(null);
    setCoursViewMode("list");
  };
  const handleCreateCours = () => {
    setEditingCours(null);
    setCoursViewMode("list");
  };

  const renderBody = () => {
    switch (role) {
      case "admin":
        switch (activeTab) {
          case "dashboard":
            return <DashboardContentBody accentColor={config.accentColor} quickActions={homeQuickActions} onQuickAction={handleQuickAction} onNavigate={setActiveTab} />;
          case "users":
            return <AdminUsersBody />;
          case "users-admins":
            return <AdminUsersBody initialTab="admins" />;
          case "users-professeurs":
            return <AdminUsersBody initialTab="professeurs" />;
          case "users-parents":
            return <AdminUsersBody initialTab="parents" />;
          case "users-eleves":
            return <AdminUsersBody initialTab="eleves" />;
          case "users-autres":
            return <AdminUsersBody initialTab="autres" />;
          case "users-gestionnaires":
            return <AdminUsersBody initialTab="gestionnaires" />;
          case "users-pending":
            return <AdminUsersBody initialTab="pending" />;
          case "gestionnaires":
            return <GestionnairesBody />;
          case "create-gestionnaire":
            return <GestionnairesBody autoCreate />;
          case "classes":
            return <AdminClassesBody />;
          case "create-class":
            return <AdminClassesBody autoCreate />;
          case "matieres":
            return <MatieresBody />;
          case "schools":
            return <AdminSchoolsBody initialSegment="etablissements" />;
          case "create-establishment":
            return <AdminSchoolsBody initialSegment="etablissements" autoCreate />;
          case "motifs":
            return <MotifsDeRejetBody />;
          case "offers":
            return <AdminSchoolsBody initialSegment="offres" />;
          case "activities":
            return <DashboardActivitiesBody />;
          case "messages":
            return <DashboardMessagesBody />;
          case "settings":
            return <AccountSettingsBody onLogout={onLogout} roleLabel={config.roleLabel} />;
          default:
            return <DashboardContentBody accentColor={config.accentColor} quickActions={homeQuickActions} onQuickAction={handleQuickAction} onNavigate={setActiveTab} />;
        }

      case "parent":
        switch (activeTab) {
          case "dashboard":
            return (
              <StudentParentStatsBody
                userRole="parent"
                onNavigate={setActiveTab}
                accentColor={config.accentColor}
                quickActions={homeQuickActions}
                onQuickAction={handleQuickAction}
              />
            );
          case "children":
          case "my-children":
            return <ParentChildrenBody />;
          case "classes":
          case "class":
            return <ParentClassesBody />;
          case "courses":
          case "cours":
            return <ParentCoursesBody />;
          case "exercises":
          case "devoirs":
          case "manage-exercises":
            return <ParentExercisesBody />;
          case "activities":
            return <DashboardActivitiesBody />;
          case "messages":
            return <DashboardMessagesBody />;
          case "settings":
            return <AccountSettingsBody onLogout={onLogout} roleLabel={config.roleLabel} />;
          default:
            return (
              <StudentParentStatsBody
                userRole="parent"
                onNavigate={setActiveTab}
                accentColor={config.accentColor}
                quickActions={homeQuickActions}
                onQuickAction={handleQuickAction}
              />
            );
        }

      case "student":
        switch (activeTab) {
          case "dashboard":
            return (
              <StudentParentStatsBody
                userRole="student"
                onNavigate={setActiveTab}
                accentColor={config.accentColor}
                quickActions={homeQuickActions}
                onQuickAction={handleQuickAction}
              />
            );
          case "classes":
          case "class":
            return <StudentClassesBody />;
          case "exercises":
          case "devoirs":
          case "manage-exercises":
            return <StudentExercisesBody />;
          case "courses":
          case "cours":
            return <StudentCoursesBody />;
          case "activities":
            return <DashboardActivitiesBody />;
          case "messages":
            return <DashboardMessagesBody />;
          case "settings":
            return <AccountSettingsBody onLogout={onLogout} roleLabel={config.roleLabel} />;
          default:
            return (
              <StudentParentStatsBody
                userRole="student"
                onNavigate={setActiveTab}
                accentColor={config.accentColor}
                quickActions={homeQuickActions}
                onQuickAction={handleQuickAction}
              />
            );
        }

      case "establishment":
      case "gestionnaire":
        switch (activeTab) {
          case "dashboard":
            return (
              <EstablishmentOverviewBody
                onNavigate={setActiveTab}
                accentColor={config.accentColor}
                quickActions={homeQuickActions}
                onQuickAction={handleQuickAction}
              />
            );
          // Tab names match web Principal.jsx's gestionnaire ROLE_TABS; the short
          // "establishments"/"classes" ids stay as aliases (notification routing).
          // "create-establishment" is admin-only: a stale/deep-linked tab just shows the list.
          case "establishments":
          case "manage-establishment":
          case "create-establishment":
            return <EstablishmentListBody key="manage-establishment" />;
          case "classes":
          case "manage-class":
            return <EstablishmentClassesBody key="manage-class" />;
          case "create-class":
            return <EstablishmentClassesBody key="create-class" autoCreate />;
          case "matieres":
            return <MatieresBody />;
          case "activities":
            return <DashboardActivitiesBody />;
          case "messages":
            return <DashboardMessagesBody />;
          case "settings":
            return <AccountSettingsBody onLogout={onLogout} roleLabel={config.roleLabel} />;
          default:
            return (
              <EstablishmentOverviewBody
                onNavigate={setActiveTab}
                accentColor={config.accentColor}
                quickActions={homeQuickActions}
                onQuickAction={handleQuickAction}
              />
            );
        }

      case "professor":
      case "tutor":
        switch (activeTab) {
          case "dashboard":
            return <DashboardContentBody accentColor={config.accentColor} quickActions={homeQuickActions} onQuickAction={handleQuickAction} onNavigate={setActiveTab} />;
          case "messages":
            return <DashboardMessagesBody onBack={() => setActiveTab("dashboard")} />;
          case "activities":
            return <DashboardActivitiesBody />;
          case "cours":
          case "courses":
            return coursViewMode === "create" ? (
              <CreateCoursBody onBack={handleBackToCoursList} onCreateCours={handleCreateCours} editingCours={editingCours} />
            ) : (
              <DashboardCoursBody
                onNavigateToCreate={handleNavigateToCreateCours}
                onEditCours={handleEditCours}
              />
            );
          case "exercises":
          case "manage-exercises":
          case "devoirs":
            return <DashboardExercisesBody />;
          case "class":
          case "classes":
          case "manage-class":
            return <DashboardClassesBody />;
          case "create-class":
            return <DashboardClassesBody key="create-class" autoCreate />;
          case "settings":
            return <AccountSettingsBody onLogout={onLogout} roleLabel={config.roleLabel} />;
          case "users":
            return <DashboardUsersBody />;
          case "matieres":
            return <MatieresBody />;
          default:
            return <DashboardContentBody accentColor={config.accentColor} quickActions={homeQuickActions} onQuickAction={handleQuickAction} onNavigate={setActiveTab} />;
        }

      default:
        // Unrecognised role: shared, role-neutral screens only.
        switch (activeTab) {
          case "messages":
            return <DashboardMessagesBody />;
          case "settings":
            return <AccountSettingsBody onLogout={onLogout} roleLabel={config.roleLabel} />;
          default:
            return <DashboardActivitiesBody />;
        }
    }
  };

  if (professorNotValidated) {
    return <ProfessorVerificationStatusScreen onLogout={onLogout} />;
  }

  return (
    <View style={styles.container}>
      <AppHeader
        roleLabel={config.roleLabel}
        accentColor={config.accentColor}
        onLogout={onLogout}
        onNavigateToProfile={() => setActiveTab("settings")}
      />
      {renderBody()}
      <MobileFooterNav
        activeTab={activeTab}
        onTabPress={setActiveTab}
        onOpenQuickActions={() => setShowQuickActions(true)}
        quickActionsOpen={showQuickActions}
        accentColor={config.accentColor}
      />
      <QuickActionsSheet
        visible={showQuickActions}
        onClose={() => setShowQuickActions(false)}
        onSelectTab={setActiveTab}
        onLogout={onLogout}
        items={config.quickActions}
        submenus={config.submenus}
        accentColor={config.accentColor}
      />
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});

export default DashboardShell;
