import { exerciseProgrammerService, participationService } from '../services/api';
import { ClassEntity, ExerciseProgramme, Participation, Question, Reponse } from '../types';
import type { TranslationKey } from '../i18n';
import { serverDateMs } from './dates';

export interface DevoirItem {
  programme: ExerciseProgramme;
  participation: Participation | null;
  etat?: string;
  isSubmitted: boolean;
  isGraded: boolean;
  isPending: boolean;
  overdue: boolean;
}

/** Route params of the full-screen attempt page (RootNavigator "ExerciseAttempt"). */
export interface ExerciseAttemptParams {
  exerciseProgrammerId: string;
  exerciseId?: string;
  title?: string;
  description?: string;
  /** True when a participation record already exists (web: `existingParticipation`) → PUT instead of POST. */
  hasParticipation?: boolean;
  /** Parent answering for a minor child (no account of their own): the child's id + name. */
  learnerId?: string;
  learnerName?: string;
}

/** Route params of the read-only copy/result page (RootNavigator "ExerciseResult"). */
export interface ExerciseResultParams {
  exerciseProgrammerId: string;
  exerciseId?: string;
  title?: string;
  /** Whose copy: the student himself, or the parent's selected child. */
  userId: string;
  etat?: string;
  note?: string;
  appreciation?: string;
}

/** An attachment embedded in a question (QuestionReponseResponseDTO.medias), presigned URL included. */
export interface QuestionMedia {
  id?: string;
  fileName?: string;
  filePath?: string;
  contentType?: string;
  mediaType?: string;
  presignedUrl?: string | null;
}

export const questionMedias = (q: Question): QuestionMedia[] => (Array.isArray(q.medias) ? q.medias : []);

export const isImageMedia = (m: QuestionMedia) => m.mediaType === 'IMAGE' || (m.contentType ?? '').startsWith('image/');

/** SOUMIS / EN_ATTENTE_CORRECTION / CORRIGE / VALIDE — EN_COURS (opened, not sent) is still "to do". */
export const isSubmittedEtat = (etat?: string | null) =>
  etat === 'SOUMIS' || etat === 'EN_ATTENTE_CORRECTION' || etat === 'CORRIGE' || etat === 'VALIDE';
export const isGradedEtat = (etat?: string | null) => etat === 'CORRIGE' || etat === 'VALIDE';

/**
 * The student's (or a parent-viewed child's) homework list — mirrors web's
 * StudentDevoirsContent.jsx: for each of the user's classes, fetch that
 * class's programmed exercises, keep only `typeAssignation === "DEVOIR"`
 * ones (deduplicated, with an exerciseId), and attach the user's own
 * participation (keyed by exerciseProgrammerId) to compute status, overdue
 * flag and grade. Sorted like web: not yet submitted first, then by due date
 * ascending.
 */
export const loadDevoirs = async (userId: string, classes: ClassEntity[]): Promise<DevoirItem[]> => {
  const perClass = await Promise.all(
    classes.map((c) => exerciseProgrammerService.getByClasse(c.id).catch(() => [] as ExerciseProgramme[]))
  );
  const seen = new Set<string>();
  const devoirs: ExerciseProgramme[] = [];
  perClass.flat().forEach((ep) => {
    if (ep.typeAssignation !== 'DEVOIR' || seen.has(ep.id)) return;
    seen.add(ep.id);
    // Web skips records without exerciseId (questions can't be resolved).
    if (!ep.exerciseId) return;
    devoirs.push(ep);
  });

  const participations = await participationService.getByUser(userId).catch(() => [] as Participation[]);
  const byProgrammeId = new Map(participations.map((p) => [p.exerciseProgrammerId, p]));

  const items: DevoirItem[] = devoirs.map((programme) => {
    // Own participation: from /participations-exercises/utilisateur, else the one embedded in the programme (web's source).
    const participation =
      byProgrammeId.get(programme.id) ?? (programme.participations ?? []).find((p) => p.utilisateurId === userId) ?? null;
    const etat = participation?.etatSoumission;
    const isSubmitted = isSubmittedEtat(etat);
    const isGraded = isGradedEtat(etat);
    const isPending = etat === 'EN_ATTENTE_CORRECTION';
    const overdue = !isSubmitted && !!programme.dateFinExoEffectif && serverDateMs(programme.dateFinExoEffectif, NaN) < Date.now();
    return { programme, participation, etat, isSubmitted, isGraded, isPending, overdue };
  });

  return items.sort((a, b) => {
    if (a.isSubmitted !== b.isSubmitted) return a.isSubmitted ? 1 : -1;
    return serverDateMs(a.programme.dateFinExoEffectif, 0) - serverDateMs(b.programme.dateFinExoEffectif, 0);
  });
};

export const DEVOIR_STATUS_KEY: Record<string, TranslationKey> = {
  EN_COURS: 'devoirs.status.EN_COURS',
  SOUMIS: 'devoirs.status.SOUMIS',
  EN_ATTENTE_CORRECTION: 'devoirs.status.EN_ATTENTE_CORRECTION',
  CORRIGE: 'devoirs.status.CORRIGE',
  VALIDE: 'devoirs.status.VALIDE',
};

export const QUESTION_TYPE_KEY: Record<string, TranslationKey> = {
  QCM: 'devoirs.types.QCM',
  VRAI_FAUX: 'devoirs.types.VRAI_FAUX',
  REPONSE_COURTE: 'devoirs.types.REPONSE_COURTE',
  REPONSE_LONGUE: 'devoirs.types.REPONSE_LONGUE',
  DEVELOPPEMENT: 'devoirs.types.DEVELOPPEMENT',
  TROU: 'devoirs.types.TROU',
  ASSOCIATION: 'devoirs.types.ASSOCIATION',
  CLASSEMENT: 'devoirs.types.CLASSEMENT',
};

/** Choices in display order (web sorts by ordreAffichage). */
export const sortedChoices = (q: Question) =>
  [...(q.choixReponses ?? [])].sort((a, b) => (a.ordreAffichage ?? 0) - (b.ordreAffichage ?? 0));

/** "14", "14.5" — no trailing zeros. */
export const fmtPoints = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

/**
 * Points earned on one corrected question — same rule as the teacher's
 * grading screen: an explicit numeric note wins, otherwise full points for a
 * correct answer and 0 for an incorrect one; null while not corrected.
 */
export const questionEarned = (q: Question, r?: Reponse | null): number | null => {
  if (!r) return null;
  const max = q.points || 1;
  const raw = r.note != null ? String(r.note).trim() : '';
  if (raw) {
    const n = parseFloat(raw.split('/')[0].replace(',', '.'));
    if (!Number.isNaN(n)) return Math.min(n, max);
  }
  if (r.estCorrecte === true) return max;
  if (r.estCorrecte === false) return 0;
  return null;
};
