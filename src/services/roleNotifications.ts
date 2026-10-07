import type { AppRole, LoginResponse } from '../types';
import type { NotificationItem } from '../store/useNotificationsStore';
import { authService } from './home/authService';
import { useUiStore } from '../store/useUiStore';

/**
 * Notifications about a profile request of the account (professor documents validated or
 * rejected, student class request approved…). Tapping one opens the profile ("Mes profils")
 * and re-issues the session so availableRoles / pendingRoles — hence the profile switcher —
 * reflect the new state right away.
 */
export const ROLE_NOTIFICATION_TYPES = new Set([
  'PROFESSOR_ROLE_VALIDATED',
  'PROFESSOR_ROLE_REJECTED',
  'PROFESSOR_ROLE_DOCUMENTS_REQUIRED',
  'PROFESSOR_VERIFICATION_VALIDATED',
  'PROFESSOR_VERIFICATION_REJECTED',
  'PROFESSOR_VERIFICATION_DOCUMENTS_REQUIRED',
  'STUDENT_ROLE_VALIDATED',
  'STUDENT_ROLE_APPROVED',
  'STUDENT_ROLE_REJECTED',
  'ROLE_VALIDATED',
  'ROLE_REJECTED',
  'ROLE_ADDED',
]);

export const isRoleNotification = (n: Pick<NotificationItem, 'type'>) =>
  ROLE_NOTIFICATION_TYPES.has((n.type ?? '').toUpperCase());

/** Session refresh after a profile was validated (non-fatal: the next login also picks it up). */
export const refreshRolesSilently = async (currentRole: AppRole, login: (s: LoginResponse) => void) => {
  if (currentRole === 'student') return; // switch-role is refused for a student session
  try {
    const session = await authService.refreshSession(currentRole);
    login(session);
  } catch {
    // ignore
  }
};

/** Returns true when the notification was a profile one (handled: profile tab requested). */
export const handleRoleNotification = (
  n: Pick<NotificationItem, 'type'>,
  currentRole: AppRole,
  login: (s: LoginResponse) => void
): boolean => {
  if (!isRoleNotification(n)) return false;
  useUiStore.getState().requestTab('settings');
  refreshRolesSilently(currentRole, login);
  return true;
};
