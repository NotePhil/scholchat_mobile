import { exerciseProgrammerService, participationService } from '../services/api';
import { ClassEntity, ExerciseProgramme, Participation } from '../types';

export interface DevoirItem {
  programme: ExerciseProgramme;
  participation: Participation | null;
  etat?: string;
  isSubmitted: boolean;
  isGraded: boolean;
  isPending: boolean;
  overdue: boolean;
}

/**
 * The student's (or a parent-viewed child's) homework list — mirrors web's
 * StudentDevoirsContent.jsx: for each of the user's classes, fetch that
 * class's programmed exercises and keep only `typeAssignation === "DEVOIR"`
 * ones, then cross-reference the user's own participations (keyed by
 * exerciseProgrammerId, NOT by name — matching by name silently collides
 * when two devoirs share a title) to compute submission status, overdue
 * flag, and grade.
 */
export const loadDevoirs = async (userId: string, classes: ClassEntity[]): Promise<DevoirItem[]> => {
  const perClass = await Promise.all(
    classes.map((c) => exerciseProgrammerService.getByClasse(c.id).catch(() => []))
  );
  const seen = new Set<string>();
  const devoirs: ExerciseProgramme[] = [];
  perClass.flat().forEach((ep) => {
    if (ep.typeAssignation === 'DEVOIR' && !seen.has(ep.id)) {
      seen.add(ep.id);
      devoirs.push(ep);
    }
  });

  const participations = await participationService.getByUser(userId).catch(() => []);
  const byProgrammeId = new Map(participations.map((p) => [p.exerciseProgrammerId, p]));

  const items: DevoirItem[] = devoirs.map((programme) => {
    const participation = byProgrammeId.get(programme.id) ?? null;
    const etat = participation?.etatSoumission;
    const isSubmitted = !!etat;
    const isGraded = etat === 'CORRIGE' || etat === 'VALIDE';
    const isPending = etat === 'EN_ATTENTE_CORRECTION';
    const overdue = !isSubmitted && !!programme.dateFinExoEffectif && new Date(programme.dateFinExoEffectif) < new Date();
    return { programme, participation, etat, isSubmitted, isGraded, isPending, overdue };
  });

  return items.sort((a, b) => {
    const rank = (d: DevoirItem) => (!d.isSubmitted ? 0 : d.isPending ? 1 : 2);
    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    const da = a.programme.dateExoPrevue ? new Date(a.programme.dateExoPrevue).getTime() : 0;
    const db = b.programme.dateExoPrevue ? new Date(b.programme.dateExoPrevue).getTime() : 0;
    return db - da;
  });
};

export const DEVOIR_STATUS_LABEL: Record<string, string> = {
  EN_COURS: 'En cours',
  SOUMIS: 'Soumis',
  EN_ATTENTE_CORRECTION: 'En attente',
  CORRIGE: 'Corrigé',
  VALIDE: 'Validé',
};
