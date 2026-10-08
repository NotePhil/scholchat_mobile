import { learningService, participationService } from '../services/api';
import type { ClasseStatistiques, ExerciceStat } from '../services/api';
import { ExerciseProgramme, Participation } from '../types';
import { isGradedEtat, isSubmittedEtat } from './devoirs';

/** "14", "14,5", "14/20" → 14 / 14.5 (null when not a number). */
export const parseNote = (raw: unknown): number | null => {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const n = parseFloat(s.split('/')[0].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/** Rendus / à corriger / moyenne / min / max of one programmed exercise, from its participations. */
export const statFromParticipations = (ep: ExerciseProgramme, parts: Participation[], attendus: number): ExerciceStat => {
  const submitted = parts.filter((p) => isSubmittedEtat(p.etatSoumission));
  const notes = submitted.filter((p) => isGradedEtat(p.etatSoumission)).map((p) => parseNote(p.note)).filter((n): n is number => n != null);
  return {
    exerciseProgrammerId: ep.id,
    titre: ep.nom || '',
    rendus: submitted.length,
    attendus,
    enAttenteCorrection: submitted.filter((p) => p.etatSoumission === 'EN_ATTENTE_CORRECTION' || p.etatSoumission === 'SOUMIS').length,
    moyenne: notes.length ? notes.reduce((a, b) => a + b, 0) / notes.length : null,
    min: notes.length ? Math.min(...notes) : null,
    max: notes.length ? Math.max(...notes) : null,
  };
};

export interface ExerciseStatsResult {
  /** Learners expected (class size) when known. */
  effectif: number | null;
  byId: Record<string, ExerciceStat>;
  /** The full statistics payload when GET /classes/{id}/statistiques answered. */
  stats: ClasseStatistiques | null;
}

/**
 * Per programmed exercise counters of a class: GET /classes/{id}/statistiques,
 * else (older backend) computed from each programme's participations.
 * `effectifFallback` = number of learners known by the caller.
 */
export const loadExerciseStats = async (
  classeId: string,
  programmes: ExerciseProgramme[],
  effectifFallback: number | null = null
): Promise<ExerciseStatsResult> => {
  const stats = await learningService.getClassStatistics(classeId).catch(() => null);
  if (stats) {
    const byId: Record<string, ExerciceStat> = {};
    stats.cours.forEach((c) =>
      c.exercices.forEach((e) => {
        byId[e.exerciseProgrammerId] = e;
      })
    );
    return { effectif: stats.effectif || effectifFallback, byId, stats };
  }
  const attendus = effectifFallback ?? 0;
  const byId: Record<string, ExerciceStat> = {};
  await Promise.all(
    programmes.map(async (ep) => {
      // Inline counters of the course endpoint win; else the participations of the programme.
      if (typeof ep.rendus === 'number') {
        byId[ep.id] = {
          exerciseProgrammerId: ep.id,
          titre: ep.nom || '',
          rendus: ep.rendus,
          attendus: typeof ep.attendus === 'number' ? ep.attendus : attendus,
          enAttenteCorrection: typeof ep.enAttenteCorrection === 'number' ? ep.enAttenteCorrection : 0,
          moyenne: typeof ep.moyenne === 'number' ? ep.moyenne : null,
          min: null,
          max: null,
        };
        return;
      }
      const parts = await participationService.getByExerciseProgramme(ep.id).catch(() => ep.participations ?? null);
      if (parts) byId[ep.id] = statFromParticipations(ep, parts, attendus);
    })
  );
  return { effectif: effectifFallback, byId, stats: null };
};
