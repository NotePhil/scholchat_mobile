import { coursService, learningService } from '../services/api';
import type { CoursResume, EleveProgression } from '../services/api';
import { ClassEntity } from '../types';
import { loadDevoirs } from './devoirs';
import { parseNote } from './classStats';
import { serverDateMs } from './dates';

/** "16/20" → 16 ; "7/10" → 14 ; "15" → 15 (already on 20). */
export const markOn20 = (note?: string | number | null) => {
  if (note == null || note === '') return null;
  const [a, b] = String(note).replace(',', '.').split('/');
  const earned = parseFloat(a);
  const max = b !== undefined ? parseFloat(b) : 20;
  if (Number.isNaN(earned) || !max) return null;
  return (earned / max) * 20;
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/**
 * Learner progression in one class: GET /eleves/{id}/progression?classeId=,
 * else rebuilt from the older endpoints (per-course chapter progression +
 * the class's programmed exercises and the learner's participations).
 */
export const loadClassProgression = async (
  learnerId: string,
  classe: ClassEntity,
  courses: CoursResume[]
): Promise<EleveProgression> => {
  try {
    return await learningService.getProgression(learnerId, classe.id);
  } catch {
    // Older backend → fallback below.
  }
  const [items, progress] = await Promise.all([
    loadDevoirs(learnerId, [classe], { includeExercises: true }),
    Promise.all(
      courses.map((c) =>
        coursService
          .getProgression(c.coursId, learnerId)
          .then((p) => ({ id: c.coursId, p: p as { chapitresCompletes?: number; totalChapitres?: number; pourcentage?: number } }))
          .catch(() => ({ id: c.coursId, p: null }))
      )
    ),
  ]);
  const byCourse = new Map(progress.map((x) => [x.id, x.p]));
  const notesOf = (list: typeof items) =>
    list.filter((d) => d.isGraded).map((d) => markOn20(d.participation?.note ?? null) ?? parseNote(d.participation?.note)).filter((n): n is number => n != null);
  const lastActivity = (list: typeof items) =>
    list
      .map((d) => d.participation?.dateSoumission || d.participation?.dateFin || d.participation?.dateDebut)
      .filter((x): x is string => !!x)
      .sort((a, b) => serverDateMs(b) - serverDateMs(a))[0] ?? null;

  const cours = courses.map((c) => {
    const p = byCourse.get(c.coursId);
    const its = items.filter((d) => d.coursId === c.coursId);
    return {
      coursId: c.coursId,
      titre: c.titre,
      chapitresLus: p?.chapitresCompletes ?? 0,
      chapitresTotal: p?.totalChapitres ?? c.nbChapitres ?? 0,
      pourcentage: Math.round(p?.pourcentage ?? 0),
      exercicesFaits: its.filter((d) => d.isSubmitted).length,
      exercicesTotal: its.length,
      moyenne: avg(notesOf(its)),
      derniereActivite: lastActivity(its),
    };
  });
  const devoirs = items.filter((d) => d.programme.typeAssignation === 'DEVOIR');
  return {
    global: {
      progressionCours: cours.length ? Math.round(cours.reduce((s, c) => s + c.pourcentage, 0) / cours.length) : 0,
      devoirsRendus: devoirs.filter((d) => d.isSubmitted).length,
      devoirsTotal: devoirs.length,
      moyenne: avg(notesOf(items)),
      dernierActivite: lastActivity(items),
    },
    cours,
    devoirsEnRetard: items
      .filter((d) => d.overdue)
      .map((d) => ({
        exerciseProgrammerId: d.programme.id,
        titre: d.programme.nom,
        coursTitre: d.coursTitre,
        dateFin: d.programme.dateFinExoEffectif ?? null,
      })),
  };
};
