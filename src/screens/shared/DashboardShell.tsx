import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import AppHeader from "./AppHeader";
import AccountSettingsBody from "./AccountSettingsBody";
import MobileFooterNav from "./MobileFooterNav";
import QuickActionsSheet, { QuickAction } from "./QuickActionsSheet";
import { useUiStore } from "../../store/useUiStore";
import { useAuthStore } from "../../store/useAuthStore";
import { colors } from "../../styles/theme";
import { AppRole } from "../../types";

// Shared across every role
import DashboardActivitiesBody from "../professeurs/components/DashboardActivitiesBody";
import DashboardMessagesBody from "../professeurs/components/messages/DashboardMessagesBody";

// Admin
import AdminDashboardBody from "../admin/components/AdminDashboardBody";
import AdminUsersBody from "../admin/components/AdminUsersBody";
import AdminClassesBody from "../admin/components/AdminClassesBody";
import AdminSchoolsBody from "../admin/components/AdminSchoolsBody";
import MotifsDeRejetBody from "../admin/components/MotifsDeRejetBody";

// Professor / Tutor
import DashboardMainBody from "../professeurs/components/DashboardMainBody";
import DashboardStatsBody from "../professeurs/components/DashboardStatsBody";
import DashboardUsersBody from "../professeurs/components/DashboardUsersBody";
import DashboardCoursBody, { Cours } from "../professeurs/components/cours/DashboardCoursBody";
import CreateCoursBody from "../professeurs/components/cours/CreateCoursBody";
import DashboardExercisesBody from "../professeurs/components/exercise/DashboardExercisesBody";
import DashboardClassesBody from "../professeurs/components/classes/DashboardClassesBody";
import MatieresBody from "../professeurs/components/MatieresBody";

// Parent
import ParentOverviewBody from "../parent/ParentOverviewBody";
import ParentChildrenBody from "../parent/ParentChildrenBody";
import ParentClassesBody from "../parent/ParentClassesBody";
import ParentCoursesBody from "../parent/ParentCoursesBody";
import ParentExercisesBody from "../parent/ParentExercisesBody";

// Student
import StudentOverviewBody from "../student/StudentOverviewBody";
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

// Mirrors scholchat_front's Sidebar.jsx admin menu: order, labels, and the
// Classes/Établissements dropdown grouping (Créer/Gérer sub-items each).
const ADMIN_QUICK_ACTIONS: QuickAction[] = [
  { icon: "th-large", label: "Tableau de Bord", color: "#6366F1", tab: "dashboard" },
  { icon: "tasks", label: "Activités", color: "#3B82F6", tab: "activities" },
  { icon: "users", label: "Gérer Utilisateur", color: "#7C3AED", tab: "users" },
  { icon: "graduation-cap", label: "Matières", color: "#A855F7", tab: "matieres" },
  { icon: "exclamation-circle", label: "Motifs de Rejet", color: "#F97316", tab: "motifs" },
  { icon: "chalkboard", label: "Classes", color: "#0891B2", submenu: "classes" },
  { icon: "school", label: "Établissements", color: "#0D9488", submenu: "establishments" },
  { icon: "clipboard-list", label: "Offres / Forfaits", color: "#DB2777", tab: "offers" },
  { icon: "envelope", label: "Messagerie", color: "#0EA5E9", tab: "messages" },
  { icon: "cog", label: "Paramètres", color: "#64748B", tab: "settings" },
];

const ADMIN_QUICK_ACTION_SUBMENUS: Record<string, QuickAction[]> = {
  classes: [
    { icon: "plus-circle", label: "Créer une Classe", color: "#10B981", tab: "create-class" },
    { icon: "chalkboard", label: "Gérer une Classe", color: "#0891B2", tab: "classes" },
  ],
  establishments: [
    { icon: "plus-circle", label: "Créer un Établissement", color: "#10B981", tab: "create-establishment" },
    { icon: "school", label: "Gérer un Établissement", color: "#0D9488", tab: "schools" },
  ],
};

const PROFESSOR_QUICK_ACTIONS: QuickAction[] = [
  { icon: "th-large", label: "Dashboard", color: "#6366F1", tab: "dashboard" },
  { icon: "tasks", label: "Activités", color: "#3B82F6", tab: "activities" },
  { icon: "book-open", label: "Cours", color: "#10B981", tab: "cours" },
  { icon: "graduation-cap", label: "Matières", color: "#A855F7", tab: "matieres" },
  { icon: "clipboard-list", label: "Exercices", color: "#F59E0B", tab: "exercises" },
  { icon: "users", label: "Utilisateurs", color: "#8B5CF6", tab: "users" },
  { icon: "door-open", label: "Classes", color: "#06B6D4", tab: "class" },
  { icon: "envelope", label: "Messagerie", color: "#0EA5E9", tab: "messages" },
  { icon: "cog", label: "Paramètres", color: "#64748B", tab: "settings" },
];

const PARENT_QUICK_ACTIONS: QuickAction[] = [
  { icon: "th-large", label: "Dashboard", color: "#6366F1", tab: "dashboard" },
  { icon: "tasks", label: "Activités", color: "#3B82F6", tab: "activities" },
  { icon: "clipboard-list", label: "Devoirs", color: "#F59E0B", tab: "exercises" },
  { icon: "chalkboard", label: "Classes", color: "#10B981", tab: "classes" },
  { icon: "book-open", label: "Mes Cours", color: "#8B5CF6", tab: "courses" },
  { icon: "child", label: "Enfants", color: "#A855F7", tab: "children" },
  { icon: "envelope", label: "Messagerie", color: "#0EA5E9", tab: "messages" },
  { icon: "cog", label: "Paramètres", color: "#64748B", tab: "settings" },
];

const STUDENT_QUICK_ACTIONS: QuickAction[] = [
  { icon: "th-large", label: "Dashboard", color: "#6366F1", tab: "dashboard" },
  { icon: "tasks", label: "Activités", color: "#3B82F6", tab: "activities" },
  { icon: "clipboard-list", label: "Devoirs", color: "#F59E0B", tab: "exercises" },
  { icon: "chalkboard", label: "Classes", color: "#10B981", tab: "classes" },
  { icon: "book-open", label: "Mes Cours", color: "#8B5CF6", tab: "courses" },
  { icon: "envelope", label: "Messagerie", color: "#0EA5E9", tab: "messages" },
  { icon: "cog", label: "Paramètres", color: "#64748B", tab: "settings" },
];

const ESTABLISHMENT_QUICK_ACTIONS: QuickAction[] = [
  { icon: "th-large", label: "Dashboard", color: "#6366F1", tab: "dashboard" },
  { icon: "tasks", label: "Activités", color: "#3B82F6", tab: "activities" },
  { icon: "school", label: "Écoles", color: "#0D9488", tab: "establishments" },
  { icon: "chalkboard", label: "Classes", color: "#10B981", tab: "classes" },
  { icon: "envelope", label: "Messagerie", color: "#0EA5E9", tab: "messages" },
  { icon: "cog", label: "Paramètres", color: "#64748B", tab: "settings" },
];

interface RoleConfig {
  roleLabel: string;
  accentColor: string;
  quickActions: QuickAction[];
  submenus?: Record<string, QuickAction[]>;
}

const ROLE_CONFIG: Partial<Record<AppRole, RoleConfig>> = {
  admin: { roleLabel: "Administrateur", accentColor: colors.danger, quickActions: ADMIN_QUICK_ACTIONS, submenus: ADMIN_QUICK_ACTION_SUBMENUS },
  professor: { roleLabel: "Professeur", accentColor: colors.primary, quickActions: PROFESSOR_QUICK_ACTIONS },
  tutor: { roleLabel: "Professeur", accentColor: colors.primary, quickActions: PROFESSOR_QUICK_ACTIONS },
  parent: { roleLabel: "Parent", accentColor: colors.warning, quickActions: PARENT_QUICK_ACTIONS },
  student: { roleLabel: "Élève", accentColor: colors.info, quickActions: STUDENT_QUICK_ACTIONS },
  establishment: { roleLabel: "Établissement", accentColor: colors.success, quickActions: ESTABLISHMENT_QUICK_ACTIONS },
  gestionnaire: { roleLabel: "Gestionnaire", accentColor: colors.success, quickActions: ESTABLISHMENT_QUICK_ACTIONS },
};

/**
 * Single shared dashboard shell for all 5 roles — mirrors scholchat_front's
 * Principal.jsx exactly: ONE component (header + body + footer nav + quick
 * actions), with role read from the auth store driving which tab→component
 * map, accent color, and quick-actions grid apply, instead of a separate
 * near-identical shell file per role.
 */
const DashboardShell = ({ onLogout }: DashboardShellProps) => {
  const role = useAuthStore((s) => s.role);
  // Lands on Activités first after login, per product requirement — every role.
  const [activeTab, setActiveTabState] = useState("activities");
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [coursViewMode, setCoursViewMode] = useState<"list" | "create">("list");
  const [editingCours, setEditingCours] = useState<Cours | null>(null);
  const pendingTab = useUiStore((s) => s.pendingTab);
  const clearPendingTab = useUiStore((s) => s.clearPendingTab);

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    if (tab !== "cours") {
      setCoursViewMode("list");
      setEditingCours(null);
    }
  };

  // Picks up a tab switch requested from outside this instance (e.g. tapping a
  // message notification on the separate stack-pushed NotificationsScreen).
  useEffect(() => {
    if (pendingTab) {
      setActiveTab(pendingTab);
      clearPendingTab();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTab, clearPendingTab]);

  const config: RoleConfig = ROLE_CONFIG[role] ?? (ROLE_CONFIG.professor as RoleConfig);

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
            return <AdminDashboardBody />;
          case "users":
            return <AdminUsersBody />;
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
            return <AdminDashboardBody />;
        }

      case "parent":
        switch (activeTab) {
          case "dashboard":
            return <ParentOverviewBody />;
          case "children":
            return <ParentChildrenBody />;
          case "classes":
            return <ParentClassesBody />;
          case "courses":
            return <ParentCoursesBody />;
          case "exercises":
            return <ParentExercisesBody />;
          case "activities":
            return <DashboardActivitiesBody />;
          case "messages":
            return <DashboardMessagesBody />;
          case "settings":
            return <AccountSettingsBody onLogout={onLogout} roleLabel={config.roleLabel} />;
          default:
            return <ParentOverviewBody />;
        }

      case "student":
        switch (activeTab) {
          case "dashboard":
            return <StudentOverviewBody />;
          case "classes":
            return <StudentClassesBody />;
          case "exercises":
            return <StudentExercisesBody />;
          case "courses":
            return <StudentCoursesBody />;
          case "activities":
            return <DashboardActivitiesBody />;
          case "messages":
            return <DashboardMessagesBody />;
          case "settings":
            return <AccountSettingsBody onLogout={onLogout} roleLabel={config.roleLabel} />;
          default:
            return <StudentOverviewBody />;
        }

      case "establishment":
      case "gestionnaire":
        switch (activeTab) {
          case "dashboard":
            return <EstablishmentOverviewBody />;
          case "establishments":
            return <EstablishmentListBody />;
          case "classes":
            return <EstablishmentClassesBody />;
          case "activities":
            return <DashboardActivitiesBody />;
          case "messages":
            return <DashboardMessagesBody />;
          case "settings":
            return <AccountSettingsBody onLogout={onLogout} roleLabel={config.roleLabel} />;
          default:
            return <EstablishmentOverviewBody />;
        }

      case "professor":
      case "tutor":
      default:
        switch (activeTab) {
          case "dashboard":
            return <DashboardMainBody onOpenMessages={() => setActiveTab("messages")} />;
          case "messages":
            return <DashboardMessagesBody onBack={() => setActiveTab("dashboard")} />;
          case "activities":
            return <DashboardActivitiesBody />;
          case "cours":
            return coursViewMode === "create" ? (
              <CreateCoursBody onBack={handleBackToCoursList} onCreateCours={handleCreateCours} editingCours={editingCours} />
            ) : (
              <DashboardCoursBody
                onNavigateToCreate={handleNavigateToCreateCours}
                onCreateCours={handleCreateCours}
                onEditCours={handleEditCours}
              />
            );
          case "exercises":
            return <DashboardExercisesBody />;
          case "class":
            return <DashboardClassesBody />;
          case "settings":
            return <AccountSettingsBody onLogout={onLogout} roleLabel={config.roleLabel} />;
          case "stats":
            return <DashboardStatsBody />;
          case "users":
            return <DashboardUsersBody />;
          case "matieres":
            return <MatieresBody />;
          default:
            return <DashboardMainBody onOpenMessages={() => setActiveTab("messages")} />;
        }
    }
  };

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});

export default DashboardShell;
