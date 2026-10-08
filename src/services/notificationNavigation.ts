import type { AppRole, LoginResponse } from '../types';
import type { NotificationItem } from '../store/useNotificationsStore';
import { useUiStore } from '../store/useUiStore';
import { useSelectedChildStore } from '../store/useSelectedChildStore';
import { getNotificationTarget, NotificationTarget } from './notificationRouting';
import { handleRoleNotification } from './roleNotifications';
import { isParentLimited, refreshParentAccess } from './parentAccess';
import { useAuthStore } from '../store/useAuthStore';

/** Route params of the "NotificationTarget" stack screen (resolves a target that needs a lookup first). */
export type NotificationTargetParams = Extract<NotificationTarget, { kind: 'devoir' }>;

interface OpenContext {
  role: AppRole;
  userId?: string | null;
  /** Root stack navigation (App / Notifications / CourseViewer / … are siblings). */
  navigation: { navigate: (name: string, params?: object) => void };
  login: (s: LoginResponse) => void;
}

/**
 * Opens what a tapped notification is about — the exact item, not just its tab. Shared by the
 * header dropdown (AppHeader) and the full NotificationsScreen.
 *
 * Items living inside a dashboard tab (a class, the professor's course or corrections, a
 * conversation, an activity) are requested through useUiStore (requestTab + request<Item>): the
 * role dashboard stays mounted under the stack, so the request is picked up whether or not the
 * target screen is already mounted; navigating to "App" reveals it (no-op from the header).
 * Full-screen items (course reader, live session, devoir) are pushed on the root stack.
 *
 * Returns false when the notification has no destination (the tap only marked it read).
 */
export const openNotification = (n: NotificationItem, ctx: OpenContext): boolean => {
  const { role, navigation } = ctx;
  const target = getNotificationTarget(n, role, ctx.userId);
  if (!target) return false;
  const ui = useUiStore.getState();
  const showDashboard = () => navigation.navigate('App');
  const isLearner = role === 'student' || role === 'parent';

  // Parent in limited mode (no approved child yet): only "Mes enfants" / the profile are reachable.
  if (isParentLimited(role, useAuthStore.getState().user) && target.kind !== 'children' && target.kind !== 'profile') {
    ui.requestTab('children');
    showDashboard();
    return true;
  }

  switch (target.kind) {
    case 'profile':
      handleRoleNotification(n, role, ctx.login);
      showDashboard();
      return true;
    case 'live':
      navigation.navigate('LiveSession', { coursId: target.coursId, isHost: false });
      return true;
    case 'class':
      ui.requestClass(target.classId, target.tab);
      ui.requestTab('classes');
      showDashboard();
      return true;
    case 'course':
      if (role === 'professor' || role === 'tutor') {
        ui.requestCourse(target.coursId);
        ui.requestTab('cours');
        showDashboard();
        return true;
      }
      if (role === 'parent') {
        // The parent reads the course with the selected child's progress, read-only.
        const childId = useSelectedChildStore.getState().selectedChildId;
        navigation.navigate(
          'CourseViewer',
          childId ? { coursId: target.coursId, learnerId: childId, readOnlyProgress: true } : { coursId: target.coursId, readOnlyProgress: true }
        );
        return true;
      }
      navigation.navigate('CourseViewer', isLearner ? { coursId: target.coursId } : { coursId: target.coursId, readOnlyProgress: true });
      return true;
    case 'devoir':
      navigation.navigate('NotificationTarget', target);
      return true;
    case 'correction':
      ui.requestCorrection(target.exerciseProgrammerId, target.studentId);
      ui.requestTab('exercises');
      showDashboard();
      return true;
    case 'conversation':
      ui.requestConversation({ partnerId: target.partnerId, messageId: target.messageId });
      ui.requestTab('messages');
      showDashboard();
      return true;
    case 'activity':
      ui.requestActivity(target.eventId);
      ui.requestTab('activities');
      showDashboard();
      return true;
    case 'children': {
      ui.requestTab('children');
      showDashboard();
      // Re-read the access (an approval unlocks the limited mode), then select the approved child:
      // the notification's actor when it is the child, else the child approved in that class.
      const { approved, childId, classId } = target;
      refreshParentAccess({ selectChildId: approved ? childId : undefined }).then(() => {
        if (!approved || !classId) return;
        const store = useSelectedChildStore.getState();
        if (childId && store.children.some((c) => c.id === childId)) return;
        const match = store.statuses?.find((st) =>
          st.classes.some((c) => c.classeId === classId && String(c.statut).toUpperCase() === 'APPROUVEE')
        );
        if (match && store.children.some((c) => c.id === match.enfantId)) store.setSelectedChildId(match.enfantId);
      });
      return true;
    }
    case 'tab':
      ui.requestTab(target.tab);
      showDashboard();
      return true;
    default:
      return false;
  }
};
