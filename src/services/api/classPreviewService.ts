import { apiClient, extractErrorMessage, getErrorCode } from './client';
import { TranslationKey, localizedServerMessage, translate } from '../../i18n';

/** Who is joining: a parent (for a child) or a student (themself). */
export type ClassPreviewType = 'parent' | 'eleve';

/** GET /public/classes/apercu — public, read-only preview of a class from its activation code. */
export interface ClassPreview {
  classeId: string;
  nom: string;
  niveau?: string | null;
  etablissementNom?: string | null;
  /** True when adult students may join (otherwise reserved to minors, joined through a parent). */
  accesMajeur?: boolean | null;
  professeurNom?: string | null;
}

/** Error codes of the preview endpoint, with their translated message (English UI). */
const PREVIEW_ERROR_KEYS: Record<string, TranslationKey> = {
  CODE_CLASSE_INVALIDE: 'classPreview.errors.invalid',
  CLASSE_NON_ACTIVE: 'classPreview.errors.inactive',
  CLASSE_RESERVEE_MINEURS: 'classPreview.errors.minorsOnly',
  CODE_CLASSE_REQUIS: 'classPreview.errors.required',
  TROP_DE_TENTATIVES: 'classPreview.errors.tooMany',
};

export type ClassPreviewError = Error & { code?: string; status?: number };

/** Minimum code length before an automatic (debounced) lookup is attempted. */
export const CLASS_CODE_MIN_LENGTH = 4;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * Normalizes the preview body defensively: the contract is
 * {classeId, nom, niveau, etablissementNom|null, accesMajeur, professeurNom|null}, but a few
 * likely variants (id, etablissement.nom, professeur {prenom, nom}) are accepted too.
 */
const normalize = (raw: Record<string, any>): ClassPreview => {
  const prof = raw.professeur ?? raw.moderateur ?? raw.moderator;
  const profName =
    str(raw.professeurNom) ??
    (prof && typeof prof === 'object' ? str([prof.prenom, prof.nom].filter(Boolean).join(' ')) : str(prof));
  return {
    classeId: String(raw.classeId ?? raw.id ?? ''),
    nom: str(raw.nom) ?? str(raw.classeNom) ?? '',
    niveau: str(raw.niveau),
    etablissementNom: str(raw.etablissementNom) ?? str(raw.etablissement?.nom),
    accesMajeur: typeof raw.accesMajeur === 'boolean' ? raw.accesMajeur : null,
    professeurNom: profName,
  };
};

export const classPreviewService = {
  /**
   * Looks a class up from its activation code. Throws an Error carrying the backend `code`
   * (CODE_CLASSE_INVALIDE, CLASSE_NON_ACTIVE, CLASSE_RESERVEE_MINEURS, CODE_CLASSE_REQUIS,
   * TROP_DE_TENTATIVES) and the server message (translated in English when the code is known).
   */
  getPreview: async (code: string, type: ClassPreviewType): Promise<ClassPreview> => {
    try {
      const { data } = await apiClient.get('/public/classes/apercu', { params: { code: code.trim(), type } });
      if (!data || typeof data !== 'object') throw new Error(translate('classPreview.errors.invalid'));
      const preview = normalize(data as Record<string, any>);
      if (!preview.classeId && !preview.nom) throw new Error(translate('classPreview.errors.invalid'));
      return preview;
    } catch (error) {
      const code = getErrorCode(error);
      const status = (error as { response?: { status?: number } })?.response?.status;
      const fallbackKey: TranslationKey =
        status === 404 ? 'classPreview.errors.invalid' : status === 429 ? 'classPreview.errors.tooMany' : 'classPreview.errors.generic';
      const message = extractErrorMessage(error, translate(fallbackKey));
      const key = code ? PREVIEW_ERROR_KEYS[code] : status === 404 ? PREVIEW_ERROR_KEYS.CODE_CLASSE_INVALIDE : undefined;
      const err = new Error(localizedServerMessage(message, key)) as ClassPreviewError;
      err.code = code ?? (status === 404 ? 'CODE_CLASSE_INVALIDE' : status === 429 ? 'TROP_DE_TENTATIVES' : undefined);
      err.status = status;
      throw err;
    }
  },
};
