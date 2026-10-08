import type { FontAwesome5 } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { AppRole } from '../types';
import type { NotificationItem } from '../store/useNotificationsStore';
import { currentDateLocale, parseServerDate } from '../utils/dates';
import { translate } from '../i18n';
import { ROLE_NOTIFICATION_TYPES } from './roleNotifications';

type IconName = ComponentProps<typeof FontAwesome5>['name'];

/**
 * Where a tapped notification should land (see services/notificationNavigation, which
 * performs it). Backend types (NotificationService.java) and what they carry:
 *  - MESSAGE_SENT            MESSAGE    messageId (older rows: null), actorId = sender → the conversation
 *  - ACCESS_REQUEST          CLASS      classeId — new request (moderators/admins, actorId = requester) or
 *                                       the requester's own sent/approved/rejected confirmation
 *  - ACTIVITY_CREATED        EVENT      eventId    (new activity)
 *                            COURSE     classeId   (LEGACY course scheduled rows)
 *  - COURSE_SCHEDULED        COURSE     coursId    (course scheduled in the recipient's classes)
 *  - NEW_COURSE              COURSE     coursId
 *  - LIVE_SESSION_STARTED    COURSE     coursId
 *  - ASSIGNMENT_GIVEN        EXERCISE   exerciseProgrammerId (devoir programmed)
 *                            ASSIGNMENT classeId   (LEGACY rows)
 *  - EXERCISE_CREATED        EXERCISE   exerciseId (admins)
 *  - DEVOIR_SOUMIS           EXERCISE   exerciseProgrammerId (professor: to correct, actorId = student;
 *                                       student: confirmation)
 *  - CORRECTION_DISPONIBLE   EXERCISE   exerciseProgrammerId (student: graded)
 *  - CLASS_VALIDATED         CLASS      classeId   (validated or rejected, professor)
 *  - CLASS_CREATED           CLASS      classeId   (admins / gestionnaire)
 *  - CLASSE_ADHESION_DEMANDE CLASS      classeId   (gestionnaire / professor)
 *  - ETABLISSEMENT_CREATED   ETABLISSEMENT id      (gestionnaire)
 *  - PROFESSOR_CREATED       PROFESSOR  professorId (admins: pending validation)
 *  - PROFESSOR_ROLE_* / STUDENT_ROLE_* / ROLE_* / PROFESSOR_VERIFICATION_* → profile ("Mes profils")
 *  - OFFRE_EXPIRATION_BIENTOT / OFFRE_EXPIREE / SUPPRESSION_IMMINENTE  CLASSE | ETABLISSEMENT id
 *  - CHILD_ACCESS_APPROVED / CHILD_ACCESS_REJECTED  CLASS classeId, actorId = the child (when sent)
 *                                       → parent's "Mes enfants" (child selected on approval)
 */
export type NotificationTarget =
  /** Profile decision: "Mes profils" + session roles refreshed (services/roleNotifications). */
  | { kind: 'profile' }
  | { kind: 'live'; coursId: string }
  /** A class: management ClassDetails (professor/admin/gestionnaire) or the learner class page. */
  | { kind: 'class'; classId: string; tab: string }
  /** A course: CourseViewer (learner / admin) or the professor's course detail. */
  | { kind: 'course'; coursId: string }
  /** A learner's devoir: attempt when not submitted yet, else the copy/result page. */
  | { kind: 'devoir'; exerciseProgrammerId: string; result?: boolean }
  /** Professor: corrections of that programmed exercise (studentId's copy expanded). */
  | { kind: 'correction'; exerciseProgrammerId: string; studentId?: string }
  | { kind: 'conversation'; partnerId?: string; messageId?: string }
  | { kind: 'activity'; eventId: string }
  /** Parent: a child's class request was decided → "Mes enfants" (child selected when approved). */
  | { kind: 'children'; approved: boolean; childId?: string; classId?: string }
  /** Just a dashboard tab (DashboardShell.renderBody key). */
  | { kind: 'tab'; tab: string };

/** Decision on a child's class request (parent). */
export const isChildAccessNotification = (type?: string | null) => /^CHILD_ACCESS_/i.test(type ?? '');

const isClassEntity = (entity: string) => entity === 'CLASS' || entity === 'CLASSE';

export const getNotificationTarget = (
  n: NotificationItem,
  role: AppRole,
  currentUserId?: string | null
): NotificationTarget | null => {
  const type = (n.type ?? '').toUpperCase();
  const entity = (n.relatedEntityType ?? '').toUpperCase();
  const id = n.relatedEntityId ? String(n.relatedEntityId) : '';
  const actorId = n.actorId ? String(n.actorId) : '';
  const isAdmin = role === 'admin';
  const isProf = role === 'professor' || role === 'tutor';
  const isLearner = role === 'student' || role === 'parent';
  const isGest = role === 'gestionnaire' || role === 'establishment';

  if (ROLE_NOTIFICATION_TYPES.has(type)) return { kind: 'profile' };

  const classTarget = (tab: string): NotificationTarget =>
    id && isClassEntity(entity) ? { kind: 'class', classId: id, tab } : { kind: 'tab', tab: 'classes' };
  const coursTab: NotificationTarget | null = isLearner
    ? { kind: 'tab', tab: 'courses' }
    : isProf
      ? { kind: 'tab', tab: 'cours' }
      : null;
  const course = (): NotificationTarget | null => {
    if (isGest) return null;
    return id ? { kind: 'course', coursId: id } : coursTab;
  };
  const exercisesTab: NotificationTarget | null = isLearner || isProf ? { kind: 'tab', tab: 'exercises' } : null;

  switch (type) {
    case 'CHILD_ACCESS_APPROVED':
    case 'CHILD_ACCESS_REJECTED':
      if (role !== 'parent') return id && isClassEntity(entity) ? classTarget('overview') : null;
      return {
        kind: 'children',
        approved: type === 'CHILD_ACCESS_APPROVED',
        childId: actorId || undefined,
        classId: id && isClassEntity(entity) ? id : undefined,
      };

    case 'MESSAGE_SENT':
    case 'NEW_MESSAGE':
      return { kind: 'conversation', partnerId: actorId || undefined, messageId: id || undefined };

    case 'ACCESS_REQUEST':
    case 'DEMANDE_ACCES':
      // Managers land on the requests; the requester (own confirmation: actor = himself, or the
      // moderator who decided) on the class itself.
      if (isProf || isAdmin || isGest) {
        const ownRequest = !!currentUserId && actorId === currentUserId;
        return classTarget(ownRequest || /approuv|rejet/i.test(n.title ?? '') ? 'overview' : 'access-requests');
      }
      return classTarget('overview');

    case 'CLASSE_ADHESION_DEMANDE':
      return classTarget('overview');

    case 'CLASS_VALIDATED':
    case 'CLASS_REJECTED':
    case 'CLASS_JOIN':
    case 'CLASS_CREATED':
      return classTarget('overview');

    case 'ETABLISSEMENT_CREATED':
      return isGest ? { kind: 'tab', tab: 'establishments' } : isAdmin ? { kind: 'tab', tab: 'schools' } : null;

    case 'ACTIVITY_CREATED':
    case 'NEW_ACTIVITY':
    case 'EVENT_UPDATED':
      // Legacy "course scheduled" rows carried the class id.
      if (entity === 'COURSE') return id ? (isLearner || isProf ? { kind: 'class', classId: id, tab: 'overview' } : null) : coursTab;
      return id && entity === 'EVENT' ? { kind: 'activity', eventId: id } : { kind: 'tab', tab: 'activities' };

    case 'NEW_COURSE':
    case 'COURSE_SCHEDULED':
    case 'COURS_PROGRAMME':
    case 'NOUVEAU_COURS':
      return course();

    case 'LIVE_SESSION_STARTED':
    case 'SESSION_STARTED':
      // Recipients are the session's participants (never the host who started it).
      return id ? { kind: 'live', coursId: id } : coursTab;

    case 'ASSIGNMENT_GIVEN':
    case 'EXERCISE_ASSIGNED':
    case 'NOUVEL_EXERCICE':
      if (entity === 'ASSIGNMENT' || isClassEntity(entity)) {
        // Legacy rows: the class id — the class page (its devoirs) for a learner.
        return id && isLearner ? { kind: 'class', classId: id, tab: 'overview' } : exercisesTab;
      }
      if (!id) return exercisesTab;
      return isLearner ? { kind: 'devoir', exerciseProgrammerId: id } : exercisesTab;

    case 'DEVOIR_SOUMIS':
      if (!id) return exercisesTab;
      if (isProf) return { kind: 'correction', exerciseProgrammerId: id, studentId: actorId || undefined };
      return isLearner ? { kind: 'devoir', exerciseProgrammerId: id, result: true } : null;

    case 'CORRECTION_DISPONIBLE':
      if (!id) return exercisesTab;
      return isLearner ? { kind: 'devoir', exerciseProgrammerId: id, result: true } : exercisesTab;

    case 'EXERCISE_CREATED':
      // Admins have no exercise screen on mobile; a professor gets his exercises.
      return isProf ? exercisesTab : null;

    case 'PROFESSOR_CREATED':
      return isAdmin ? { kind: 'tab', tab: 'users-pending' } : null;

    case 'OFFRE_EXPIRATION_BIENTOT':
    case 'OFFRE_EXPIREE':
    case 'SUPPRESSION_IMMINENTE':
      if (isAdmin) return { kind: 'tab', tab: 'offers' };
      if (entity === 'ETABLISSEMENT') return isGest ? { kind: 'tab', tab: 'establishments' } : null;
      // The class's overview carries its offer / contract (renewal) panel.
      return classTarget('overview');

    default:
      // Unknown type: fall back on the related entity kind, else stay put.
      if (entity === 'MESSAGE') return { kind: 'conversation', partnerId: actorId || undefined };
      if (isClassEntity(entity)) return classTarget('overview');
      if (entity === 'EVENT') return id ? { kind: 'activity', eventId: id } : { kind: 'tab', tab: 'activities' };
      if (entity === 'COURSE') return course();
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
    case 'CHILD_ACCESS_APPROVED':
      return { icon: 'child', color: '#10B981' };
    case 'CHILD_ACCESS_REJECTED':
      return { icon: 'child', color: '#EF4444' };
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
