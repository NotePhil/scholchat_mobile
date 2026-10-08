import { apiClient, extractErrorMessage, getErrorCode } from './client';
import { ExerciseProgramme } from '../../types';
import { translate } from '../../i18n';

/**
 * Class → courses → exercises summaries, learner progression and class statistics.
 *
 * These endpoints are recent on the backend, so every response is normalized
 * defensively (missing arrays → [], non-numeric counters → 0 / null) and the
 * screens fall back to older endpoints when a call fails.
 */

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.replace(',', '.')) : NaN;
  return Number.isFinite(n) ? n : fallback;
};
const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = num(v, NaN);
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : typeof v === 'number' ? String(v) : undefined);
const arr = <T = any>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Error carrying the backend `code` (e.g. COURS_NON_PROGRAMME_DANS_CLASSE). */
export class ApiCodeError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const fail = (error: unknown, fallback: string): never => {
  const code = getErrorCode(error);
  const status = (error as { response?: { status?: number } })?.response?.status;
  const message =
    code === 'COURS_NON_PROGRAMME_DANS_CLASSE' ? translate('learning.errors.coursNotProgrammed') : extractErrorMessage(error, fallback);
  throw new ApiCodeError(message, code, status);
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CoursResume {
  coursId: string;
  titre: string;
  matiere?: string;
  nbChapitres: number;
  nbSessions: number;
  prochaineSession?: string | null;
  nbExercices: number;
  nbDevoirs: number;
}

export interface ClasseResume {
  classeId: string;
  nom?: string;
  niveau?: string;
  nbCours: number;
  nbDevoirsAFaire: number;
  nbDevoirsEnRetard: number;
  moyenne: number | null;
}

export interface CoursProgressionRow {
  coursId: string;
  titre: string;
  chapitresLus: number;
  chapitresTotal: number;
  pourcentage: number;
  exercicesFaits: number;
  exercicesTotal: number;
  moyenne: number | null;
  derniereActivite?: string | null;
}

export interface EleveProgression {
  global: {
    progressionCours: number;
    devoirsRendus: number;
    devoirsTotal: number;
    moyenne: number | null;
    dernierActivite?: string | null;
  };
  cours: CoursProgressionRow[];
  devoirsEnRetard: { exerciseProgrammerId?: string; titre?: string; coursTitre?: string | null; dateFin?: string | null; [k: string]: any }[];
}

export interface ExerciceStat {
  exerciseProgrammerId: string;
  titre: string;
  rendus: number;
  attendus: number;
  enAttenteCorrection: number;
  moyenne: number | null;
  min: number | null;
  max: number | null;
}

export interface CoursStat {
  coursId: string | null;
  titre: string;
  progressionMoyenne: number;
  exercices: ExerciceStat[];
}

export interface EleveStat {
  eleveId: string;
  nom?: string;
  prenom?: string;
  progressionMoyenne: number;
  devoirsRendus: number;
  devoirsTotal: number;
  moyenne: number | null;
  enRetard: number;
}

export interface ClasseStatistiques {
  effectif: number;
  cours: CoursStat[];
  eleves: EleveStat[];
}

/** A programmed exercise of a course, with the learner's status/note when `eleveId` was given. */
export type CoursExercice = ExerciseProgramme & {
  statut?: string | null;
  etatSoumission?: string | null;
  note?: string | number | null;
  rendus?: number;
  attendus?: number;
  enAttenteCorrection?: number;
  moyenne?: number | null;
};

// ─── Normalizers ─────────────────────────────────────────────────────────────

const toCoursResume = (r: any): CoursResume => ({
  coursId: String(r?.coursId ?? r?.id ?? ''),
  titre: str(r?.titre) ?? str(r?.coursTitre) ?? '',
  matiere: str(r?.matiere) ?? str(r?.matiereNom),
  nbChapitres: num(r?.nbChapitres),
  nbSessions: num(r?.nbSessions),
  prochaineSession: str(r?.prochaineSession) ?? null,
  nbExercices: num(r?.nbExercices),
  nbDevoirs: num(r?.nbDevoirs),
});

const toClasseResume = (r: any): ClasseResume => ({
  classeId: String(r?.classeId ?? r?.id ?? ''),
  nom: str(r?.nom),
  niveau: str(r?.niveau),
  nbCours: num(r?.nbCours),
  nbDevoirsAFaire: num(r?.nbDevoirsAFaire),
  nbDevoirsEnRetard: num(r?.nbDevoirsEnRetard),
  moyenne: numOrNull(r?.moyenne),
});

const toProgression = (d: any): EleveProgression => ({
  global: {
    progressionCours: num(d?.global?.progressionCours),
    devoirsRendus: num(d?.global?.devoirsRendus),
    devoirsTotal: num(d?.global?.devoirsTotal),
    moyenne: numOrNull(d?.global?.moyenne),
    dernierActivite: str(d?.global?.dernierActivite) ?? str(d?.global?.derniereActivite) ?? null,
  },
  cours: arr(d?.cours).map((c: any) => ({
    coursId: String(c?.coursId ?? ''),
    titre: str(c?.titre) ?? '',
    chapitresLus: num(c?.chapitresLus),
    chapitresTotal: num(c?.chapitresTotal),
    pourcentage: num(c?.pourcentage),
    exercicesFaits: num(c?.exercicesFaits),
    exercicesTotal: num(c?.exercicesTotal),
    moyenne: numOrNull(c?.moyenne),
    derniereActivite: str(c?.derniereActivite) ?? null,
  })),
  devoirsEnRetard: arr(d?.devoirsEnRetard),
});

const toStats = (d: any): ClasseStatistiques => ({
  effectif: num(d?.effectif),
  cours: arr(d?.cours).map((c: any) => ({
    coursId: c?.coursId != null ? String(c.coursId) : null,
    titre: str(c?.titre) ?? '',
    progressionMoyenne: num(c?.progressionMoyenne),
    exercices: arr(c?.exercices).map((e: any) => ({
      exerciseProgrammerId: String(e?.exerciseProgrammerId ?? e?.id ?? ''),
      titre: str(e?.titre) ?? str(e?.nom) ?? '',
      rendus: num(e?.rendus),
      attendus: num(e?.attendus),
      enAttenteCorrection: num(e?.enAttenteCorrection),
      moyenne: numOrNull(e?.moyenne),
      min: numOrNull(e?.min),
      max: numOrNull(e?.max),
    })),
  })),
  eleves: arr(d?.eleves).map((e: any) => ({
    eleveId: String(e?.eleveId ?? e?.id ?? ''),
    nom: str(e?.nom),
    prenom: str(e?.prenom),
    progressionMoyenne: num(e?.progressionMoyenne),
    devoirsRendus: num(e?.devoirsRendus),
    devoirsTotal: num(e?.devoirsTotal),
    moyenne: numOrNull(e?.moyenne),
    enRetard: num(e?.enRetard),
  })),
});

// ─── Service ─────────────────────────────────────────────────────────────────

export const learningService = {
  /** GET /classes/{classeId}/cours-programmes/resume — courses programmed in a class, with counts. */
  getClassCoursesSummary: async (classeId: string): Promise<CoursResume[]> => {
    try {
      const { data } = await apiClient.get(`/classes/${classeId}/cours-programmes/resume`);
      return arr(data).map(toCoursResume).filter((c) => c.coursId);
    } catch (error) {
      return fail(error, translate('learning.errors.courses'));
    }
  },

  /**
   * GET /classes/{classeId}/cours/{coursId}/exercices?eleveId= — programmed exercises of a course
   * (coursId null → "general": exercises without a course).
   */
  getCourseExercises: async (classeId: string, coursId: string | null, eleveId?: string): Promise<CoursExercice[]> => {
    try {
      const { data } = await apiClient.get(`/classes/${classeId}/cours/${coursId ?? 'general'}/exercices`, {
        params: eleveId ? { eleveId } : undefined,
      });
      // Items are keyed by exerciseProgrammerId / titre: map them onto the ExerciseProgramme shape.
      return arr<any>(data)
        .map(
          (e): CoursExercice => ({
            ...e,
            id: String(e?.exerciseProgrammerId ?? e?.id ?? ''),
            nom: e?.titre ?? e?.nom,
            note: e?.noteSur20 != null && (e?.note == null || e?.note === '') ? `${e.noteSur20}/20` : e?.note,
          })
        )
        .filter((e) => e.id);
    } catch (error) {
      return fail(error, translate('learning.errors.exercises'));
    }
  },

  /** GET /utilisateurs/{eleveId}/classes/resume — the learner's classes with course / homework counts. */
  getLearnerClassesSummary: async (eleveId: string): Promise<ClasseResume[]> => {
    try {
      const { data } = await apiClient.get(`/utilisateurs/${eleveId}/classes/resume`);
      return arr(data).map(toClasseResume).filter((c) => c.classeId);
    } catch (error) {
      return fail(error, translate('learning.errors.classes'));
    }
  },

  /** GET /eleves/{eleveId}/progression?classeId= */
  getProgression: async (eleveId: string, classeId?: string): Promise<EleveProgression> => {
    try {
      const { data } = await apiClient.get(`/eleves/${eleveId}/progression`, {
        params: classeId ? { classeId } : undefined,
      });
      return toProgression(data);
    } catch (error) {
      return fail(error, translate('learning.errors.progression'));
    }
  },

  /** GET /classes/{classeId}/statistiques */
  getClassStatistics: async (classeId: string): Promise<ClasseStatistiques> => {
    try {
      const { data } = await apiClient.get(`/classes/${classeId}/statistiques`);
      return toStats(data);
    } catch (error) {
      return fail(error, translate('learning.errors.statistics'));
    }
  },

  /** PATCH /exercises-programmer/{id}/cours — set (coursId) or clear (null = general exercise) the course. */
  setExerciseCourse: async (exerciseProgrammerId: string, coursId: string | null): Promise<ExerciseProgramme> => {
    try {
      const { data } = await apiClient.patch<ExerciseProgramme>(
        `/exercises-programmer/${exerciseProgrammerId}/cours`,
        { coursId: coursId || null }
      );
      return data;
    } catch (error) {
      return fail(error, translate('learning.errors.setCourse'));
    }
  },
};

/** Course id of a programmed exercise (new `coursId`, else the legacy `coursIds` / `coursLies`). */
export const programmeCoursId = (ep: Partial<ExerciseProgramme> | null | undefined): string | null => {
  if (!ep) return null;
  if (ep.coursId) return String(ep.coursId);
  // The backend now always sends coursId (null = general exercise). The legacy links are exercise-level
  // (shared by every programmation of the exercise), so they are only a fallback for older backends.
  if ('coursId' in ep) return null;
  if (Array.isArray(ep.coursIds) && ep.coursIds[0]) return String(ep.coursIds[0]);
  if (Array.isArray(ep.coursLies) && ep.coursLies[0]?.id) return String(ep.coursLies[0].id);
  return null;
};

/** Course title of a programmed exercise, or null for a general exercise. */
export const programmeCoursTitre = (ep: Partial<ExerciseProgramme> | null | undefined): string | null => {
  if (!ep) return null;
  if (ep.coursTitre) return String(ep.coursTitre);
  if ('coursId' in ep) return null;
  if (Array.isArray(ep.coursLies) && ep.coursLies[0]) return ep.coursLies[0].titre || ep.coursLies[0].nom || null;
  return null;
};

/** "14.5" / "—" for a /20 average. */
export const fmtNote = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? '—' : Number.isInteger(n) ? String(n) : (Math.round(n * 100) / 100).toString();

/** Clamp a percentage (0..100, as sent by the backend — 0.8 means 0.8 %, not 80 %) to 0..100. */
export const pct = (n: number | null | undefined) => {
  if (n == null || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
};
