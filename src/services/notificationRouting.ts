import type { FontAwesome5 } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { AppRole } from '../types';
import type { NotificationItem } from '../store/useNotificationsStore';
import { currentDateLocale, parseServerDate } from '../utils/dates';
import { translate } from '../i18n';

type IconName = ComponentProps<typeof FontAwesome5>['name'];

/**
 * Where a tapped notification should land, as a DashboardShell tab key for the
 * current role (see DashboardShell.renderBody). `null` = no sensible
 * destination: the tap only marks it read.
 *
 * Backend types (NotificationService.java) and what they carry:
 *  - MESSAGE_SENT            MESSAGE   (no id)
 *  - ACCESS_REQUEST          CLASS     classeId — new request (moderators/admins) or the
 *                                      student's own sent/approved/rejected confirmation
 *  - ACTIVITY_CREATED        EVENT     eventId    (new activity)
 *                            COURSE    classeId   (course scheduled — CoursProgrammerBusiness)
 *  - NEW_COURSE              COURSE    coursId
 *  - ASSIGNMENT_GIVEN        ASSIGNMENT classeId  (exercise/devoir programmed)
 *  - EXERCISE_CREATED        EXERCISE  exerciseId (admins)
 *  - DEVOIR_SOUMIS           EXERCISE  exerciseProgrammerId (professor: to correct; student: confirmation)
 *  - CORRECTION_DISPONIBLE   EXERCISE  exerciseProgrammerId (student: graded)
 *  - CLASS_VALIDATED         CLASS     classeId   (validated or rejected, professor)
 *  - CLASS_CREATED           CLASS     classeId   (admins / gestionnaire)
 *  - CLASSE_ADHESION_DEMANDE CLASS     classeId   (gestionnaire / professor)
 *  - ETABLISSEMENT_CREATED   ETABLISSEMENT id     (gestionnaire)
 *  - PROFESSOR_CREATED       PROFESSOR professorId (admins: pending validation)
 *  - PROFESSOR_ROLE_VALIDATED (and other profile decisions) → the user's own profile (settings)
 *  - OFFRE_EXPIRATION_BIENTOT / OFFRE_EXPIREE / SUPPRESSION_IMMINENTE  CLASSE | ETABLISSEMENT id
 */
/**
 * For a professor/tutor, class notifications can open the class itself in
 * DashboardClassesBody (via useUiStore.requestClass): access/adhesion
 * requests on the Demandes tab, anything else on the overview. Admins and
 * establishments use other class screens, so they only get the tab.
 */
export const getNotificationClassTarget = (
  n: NotificationItem,
  role: AppRole
): { classId: string; tab: string } | null => {
  if (role !== 'professor' && role !== 'tutor') return null;
  const type = (n.type ?? '').toUpperCase();
  const entity = (n.relatedEntityType ?? '').toUpperCase();
  const id = n.relatedEntityId;
  if (!id || (entity !== 'CLASS' && entity !== 'CLASSE')) return null;
  switch (type) {
    case 'ACCESS_REQUEST':
    case 'DEMANDE_ACCES':
    case 'CLASSE_ADHESION_DEMANDE':
      return { classId: String(id), tab: 'access-requests' };
    case 'CLASS_VALIDATED':
    case 'CLASS_REJECTED':
    case 'CLASS_CREATED':
    case 'CLASS_JOIN':
      return { classId: String(id), tab: 'overview' };
    default:
      return null;
  }
};

export const getNotificationTargetTab = (n: NotificationItem, role: AppRole): string | null => {
  const type = (n.type ?? '').toUpperCase();
  const entity = (n.relatedEntityType ?? '').toUpperCase();
  const isAdmin = role === 'admin';
  const isProf = role === 'professor' || role === 'tutor';
  const isLearner = role === 'student' || role === 'parent';
  const isGest = role === 'gestionnaire' || role === 'establishment';

  const coursTab = isLearner ? 'courses' : isProf ? 'cours' : null;
  const exercisesTab = isLearner || isProf ? 'exercises' : null;

  switch (type) {
    case 'MESSAGE_SENT':
    case 'NEW_MESSAGE':
      return 'messages';

    case 'ACCESS_REQUEST':
    case 'DEMANDE_ACCES':
    case 'CLASS_VALIDATED':
    case 'CLASS_REJECTED':
    case 'CLASS_JOIN':
    case 'CLASS_CREATED':
      return 'classes';

    case 'CLASSE_ADHESION_DEMANDE':
      return 'classes';

    case 'ETABLISSEMENT_CREATED':
      return isGest ? 'establishments' : isAdmin ? 'schools' : null;

    case 'ACTIVITY_CREATED':
    case 'NEW_ACTIVITY':
    case 'EVENT_UPDATED':
      if (entity === 'COURSE') return coursTab ?? 'activities';
      return 'activities';

    case 'NEW_COURSE':
    case 'COURSE_SCHEDULED':
    case 'COURS_PROGRAMME':
    case 'NOUVEAU_COURS':
    case 'LIVE_SESSION_STARTED':
    case 'SESSION_STARTED':
      return coursTab;

    case 'ASSIGNMENT_GIVEN':
    case 'EXERCISE_ASSIGNED':
    case 'DEVOIR_SOUMIS':
    case 'CORRECTION_DISPONIBLE':
    case 'NOUVEL_EXERCICE':
    case 'EXERCISE_CREATED':
      return exercisesTab;

    case 'PROFESSOR_CREATED':
      return isAdmin ? 'users-pending' : null;

    // A profile request of the account itself was decided (see services/roleNotifications):
    // the profile page shows each role with its status.
    case 'PROFESSOR_ROLE_VALIDATED':
    case 'PROFESSOR_ROLE_REJECTED':
    case 'PROFESSOR_ROLE_DOCUMENTS_REQUIRED':
    case 'PROFESSOR_VERIFICATION_VALIDATED':
    case 'PROFESSOR_VERIFICATION_REJECTED':
    case 'PROFESSOR_VERIFICATION_DOCUMENTS_REQUIRED':
    case 'STUDENT_ROLE_VALIDATED':
    case 'STUDENT_ROLE_APPROVED':
    case 'STUDENT_ROLE_REJECTED':
    case 'ROLE_VALIDATED':
    case 'ROLE_REJECTED':
    case 'ROLE_ADDED':
      return 'settings';

    case 'OFFRE_EXPIRATION_BIENTOT':
    case 'OFFRE_EXPIREE':
    case 'SUPPRESSION_IMMINENTE':
      if (entity === 'ETABLISSEMENT') return isGest ? 'establishments' : isAdmin ? 'offers' : null;
      return isAdmin ? 'offers' : 'classes';

    default:
      // Unknown type: fall back on the related entity kind, else stay put.
      if (entity === 'MESSAGE') return 'messages';
      if (entity === 'CLASS' || entity === 'CLASSE') return 'classes';
      if (entity === 'EVENT') return 'activities';
      if (entity === 'COURSE') return coursTab;
      if (entity === 'EXERCISE' || entity === 'ASSIGNMENT') return exercisesTab;
      return null;
  }
};

export const getNotificationIcon = (type?: string): { icon: IconName; color: string } => {
  switch ((type ?? '').toUpperCase()) {
    case 'MESSAGE_SENT':
    case 'NEW_MESSAGE':
      return { icon: 'envelope', color: '#0EA5E9' };
    case 'ACCESS_REQUEST':
    case 'DEMANDE_ACCES':
    case 'CLASSE_ADHESION_DEMANDE':
      return { icon: 'user-plus', color: '#3B82F6' };
    case 'CLASS_VALIDATED':
      return { icon: 'check-circle', color: '#10B981' };
    case 'CLASS_CREATED':
    case 'CLASS_JOIN':
      return { icon: 'chalkboard', color: '#0891B2' };
    case 'ACTIVITY_CREATED':
    case 'NEW_ACTIVITY':
    case 'EVENT_UPDATED':
      return { icon: 'calendar-alt', color: '#22C55E' };
    case 'NEW_COURSE':
    case 'COURSE_SCHEDULED':
      return { icon: 'book-open', color: '#6366F1' };
    case 'LIVE_SESSION_STARTED':
    case 'SESSION_STARTED':
      return { icon: 'video', color: '#EF4444' };
    case 'ASSIGNMENT_GIVEN':
    case 'EXERCISE_CREATED':
    case 'EXERCISE_ASSIGNED':
      return { icon: 'clipboard-list', color: '#F59E0B' };
    case 'DEVOIR_SOUMIS':
      return { icon: 'file-upload', color: '#8B5CF6' };
    case 'CORRECTION_DISPONIBLE':
      return { icon: 'star', color: '#10B981' };
    case 'PROFESSOR_CREATED':
      return { icon: 'user-clock', color: '#DC2626' };
    case 'PROFESSOR_VERIFICATION_VALIDATED':
    case 'PROFESSOR_ROLE_VALIDATED':
    case 'STUDENT_ROLE_VALIDATED':
    case 'STUDENT_ROLE_APPROVED':
    case 'ROLE_ADDED':
    case 'ROLE_VALIDATED':
      return { icon: 'user-check', color: '#10B981' };
    case 'PROFESSOR_VERIFICATION_REJECTED':
    case 'PROFESSOR_ROLE_REJECTED':
    case 'STUDENT_ROLE_REJECTED':
    case 'ROLE_REJECTED':
      return { icon: 'user-times', color: '#EF4444' };
    case 'PROFESSOR_VERIFICATION_DOCUMENTS_REQUIRED':
    case 'PROFESSOR_ROLE_DOCUMENTS_REQUIRED':
      return { icon: 'id-card', color: '#F59E0B' };
    case 'ETABLISSEMENT_CREATED':
      return { icon: 'school', color: '#0D9488' };
    case 'OFFRE_EXPIRATION_BIENTOT':
    case 'OFFRE_EXPIREE':
    case 'SUPPRESSION_IMMINENTE':
      return { icon: 'exclamation-triangle', color: '#F97316' };
    default:
      return { icon: 'bell', color: '#64748B' };
  }
};

/** "À l'instant" / "Il y a 5 min" / "Il y a 3 h" / "Il y a 2 j" / "12 oct." (or "Just now" / "5 min ago"… in English). */
export const formatNotificationDate = (dateString?: string): string => {
  const date = parseServerDate(dateString);
  if (!date) return '';
  const time = date.getTime();
  const diffMin = Math.floor((Date.now() - time) / 60000);
  if (diffMin < 1) return translate('time.justNow');
  if (diffMin < 60) return translate('time.minutesAgo', { count: diffMin });
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return translate('time.hoursAgo', { count: diffHour });
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return translate('time.daysAgo', { count: diffDay });
  return date.toLocaleDateString(currentDateLocale(), { day: 'numeric', month: 'short', year: diffDay > 300 ? 'numeric' : undefined });
};
