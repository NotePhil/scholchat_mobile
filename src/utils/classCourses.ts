import { coursProgrammerService, coursService, learningService, programmeCoursId } from '../services/api';
import type { CoursResume } from '../services/api';
import { CoursProgramme, ExerciseProgramme } from '../types';
import { serverDateMs } from './dates';

/** Pseudo course id of the "Exercices généraux" group (programmed exercises without a course). */
export const GENERAL_COURSE_ID = '__general__';

export interface ClassCoursesResult {
  courses: CoursResume[];
  /** Programmed sessions of the class (CoursProgramme records), when they were fetched (fallback / learner page). */
  sessions: CoursProgramme[];
  /** True when the summary endpoint answered; false when built from the older endpoints. */
  fromSummary: boolean;
}

/** Title lookup for the fallback (course id → title). */
type TitleSource = (ids: string[]) => Promise<Record<string, string>>;

/** Titles through GET /cours/{id} (professor side). */
export const titlesById: TitleSource = async (ids) => {
  const out: Record<string, string> = {};
  await Promise.all(
    ids.map(async (id) => {
      const c = await coursService.getById(id).catch(() => null);
      if (c?.titre) out[id] = c.titre;
    })
  );
  return out;
};

/** Titles through GET /cours/accessibles/{userId} (learner side, one call). */
export const titlesFromAccessible =
  (userId: string): TitleSource =>
  async () => {
    const list = await coursService.getAccessible(userId).catch(() => []);
    const out: Record<string, string> = {};
    (list || []).forEach((c) => {
      if (c?.id && c.titre) out[String(c.id)] = c.titre;
    });
    return out;
  };

/**
 * Courses programmed in a class with their counts:
 * GET /classes/{id}/cours-programmes/resume, else (older backend) the class's
 * CoursProgramme records grouped by course (sessions, next session) + the
 * programmed exercises grouped by course (exercises / homework counts).
 * Throws only when nothing could be loaded.
 */
export const loadClassCourses = async (
  classeId: string,
  options: { titles?: TitleSource; programmes?: ExerciseProgramme[]; withSessions?: boolean } = {}
): Promise<ClassCoursesResult> => {
  const [summary, sessions] = await Promise.all([
    learningService.getClassCoursesSummary(classeId).catch(() => null),
    options.withSessions ? coursProgrammerService.getByClasse(classeId).catch(() => null) : Promise.resolve(null),
  ]);
  if (summary) return { courses: summary, sessions: sessions ?? [], fromSummary: true };

  const records = sessions ?? (await coursProgrammerService.getByClasse(classeId)); // throws → caller shows error/retry
  const byCourse = new Map<string, CoursProgramme[]>();
  (records || []).forEach((r) => {
    if (!r?.coursId) return;
    const k = String(r.coursId);
    byCourse.set(k, [...(byCourse.get(k) ?? []), r]);
  });
  const ids = Array.from(byCourse.keys());
  const titles = ids.length ? await (options.titles ?? titlesById)(ids).catch(() => ({} as Record<string, string>)) : {};
  const now = Date.now();
  const courses: CoursResume[] = ids.map((id) => {
    const recs = byCourse.get(id) ?? [];
    const upcoming = recs
      .map((r) => r.dateCoursPrevue)
      .filter((d): d is string => !!d && serverDateMs(d, NaN) >= now)
      .sort((a, b) => serverDateMs(a) - serverDateMs(b))[0];
    const progs = (options.programmes ?? []).filter((p) => programmeCoursId(p) === id);
    const first = recs[0] as Record<string, any>;
    return {
      coursId: id,
      titre: titles[id] || first?.coursTitre || first?.titre || first?.cours?.titre || first?.description || '',
      matiere: undefined,
      nbChapitres: 0,
      nbSessions: recs.length,
      prochaineSession: upcoming ?? null,
      nbExercices: progs.filter((p) => p.typeAssignation !== 'DEVOIR').length,
      nbDevoirs: progs.filter((p) => p.typeAssignation === 'DEVOIR').length,
    };
  });
  return { courses, sessions: records || [], fromSummary: false };
};
