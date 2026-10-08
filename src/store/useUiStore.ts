import { create } from 'zustand';

export type AppLanguage = 'fr' | 'en';
export type AppTheme = 'light' | 'dark';

interface UiState {
  theme: AppTheme;
  language: AppLanguage;
  /** Which bottom-tab/section is active in the current role navigator. */
  activeSection: string;
  setTheme: (theme: AppTheme) => void;
  setLanguage: (language: AppLanguage) => void;
  setActiveSection: (section: string) => void;
  /**
   * A tab switch requested from OUTSIDE the current dashboard instance (e.g.
   * tapping a message notification while on the separate stack-pushed
   * NotificationsScreen). Each role Dashboard is a local-state tab switcher,
   * not a set of navigable routes, so there's no `navigation.navigate(tab)`
   * to call from elsewhere — this flag is the bridge: the still-mounted
   * Dashboard underneath picks it up in a focus effect and clears it.
   */
  pendingTab: string | null;
  requestTab: (tab: string) => void;
  clearPendingTab: () => void;
  /**
   * A specific class (and ClassDetails tab) to open once the classes screen
   * mounts — set alongside requestTab("classes") from a notification tap.
   */
  pendingClass: { classId: string; tab: string } | null;
  requestClass: (classId: string, tab: string) => void;
  clearPendingClass: () => void;
  /**
   * "Rejoindre une classe" requested from outside the classes screen (dashboard CTA): the
   * student / parent classes screen opens its join flow on mount and clears the flag.
   */
  pendingJoinClass: boolean;
  requestJoinClass: () => void;
  clearPendingJoinClass: () => void;
  /**
   * Deep links from a notification tap (services/notificationNavigation), each picked up by the
   * screen that owns the item once it is mounted (set alongside requestTab):
   *  - pendingCourse: the professor's course detail (DashboardCoursBody)
   *  - pendingCorrection: corrections of a programmed exercise (DashboardExercisesBody)
   *  - pendingConversation: a messages thread (DashboardMessagesBody)
   *  - pendingActivity: an activity of the feed (DashboardActivitiesBody)
   */
  pendingCourse: string | null;
  requestCourse: (coursId: string) => void;
  clearPendingCourse: () => void;
  pendingCorrection: { exerciseProgrammerId: string; studentId?: string } | null;
  requestCorrection: (exerciseProgrammerId: string, studentId?: string) => void;
  clearPendingCorrection: () => void;
  pendingConversation: { partnerId?: string; messageId?: string } | null;
  requestConversation: (target: { partnerId?: string; messageId?: string }) => void;
  clearPendingConversation: () => void;
  pendingActivity: string | null;
  requestActivity: (eventId: string) => void;
  clearPendingActivity: () => void;
  /**
   * "Programmer un cours" shortcut (e.g. from an exercise form whose class has no programmed course):
   * DashboardCoursBody opens the course programming form, with this class pre-selected ("" = none).
   * Set alongside requestTab("cours").
   */
  pendingScheduleCourse: string | null;
  requestScheduleCourse: (classeId?: string) => void;
  clearPendingScheduleCourse: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  theme: 'light',
  language: 'fr',
  activeSection: 'dashboard',
  pendingTab: null,
  pendingClass: null,
  pendingJoinClass: false,
  pendingCourse: null,
  pendingCorrection: null,
  pendingConversation: null,
  pendingActivity: null,
  pendingScheduleCourse: null,
  setTheme: (theme) => set({ theme }),
  setLanguage: (language) => set({ language }),
  setActiveSection: (activeSection) => set({ activeSection }),
  requestTab: (pendingTab) => set({ pendingTab }),
  clearPendingTab: () => set({ pendingTab: null }),
  requestClass: (classId, tab) => set({ pendingClass: { classId, tab } }),
  clearPendingClass: () => set({ pendingClass: null }),
  requestJoinClass: () => set({ pendingJoinClass: true }),
  clearPendingJoinClass: () => set({ pendingJoinClass: false }),
  requestCourse: (pendingCourse) => set({ pendingCourse }),
  clearPendingCourse: () => set({ pendingCourse: null }),
  requestCorrection: (exerciseProgrammerId, studentId) => set({ pendingCorrection: { exerciseProgrammerId, studentId } }),
  clearPendingCorrection: () => set({ pendingCorrection: null }),
  requestConversation: (pendingConversation) => set({ pendingConversation }),
  clearPendingConversation: () => set({ pendingConversation: null }),
  requestActivity: (pendingActivity) => set({ pendingActivity }),
  clearPendingActivity: () => set({ pendingActivity: null }),
  requestScheduleCourse: (classeId) => set({ pendingScheduleCourse: classeId ?? '' }),
  clearPendingScheduleCourse: () => set({ pendingScheduleCourse: null }),
}));
