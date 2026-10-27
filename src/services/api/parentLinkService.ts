import { apiClient, extractErrorMessage, getErrorCode } from './client';
import { translate } from '../../i18n';

export type ParentLinkEtat = 'EN_ATTENTE' | 'ACCEPTEE' | 'REFUSEE' | 'ANNULEE' | 'RETIREE';

/**
 * Parental follow-up of an adult student (own account). A parent's request is validated by one of the
 * student's professors (class managers) or the administration — never by the student.
 * The follow-up is PER CLASS: each request / follow concerns one class of the student.
 *  - managers: GET /classes/{id}/demandes-suivi (pending, that class), GET /classes/{id}/suivis-parentaux
 *    (accepted follows of that class), POST /demandes-suivi/{id}/approuver | refuser?motif=,
 *    DELETE /demandes-suivi/{id} (removes that class's follow; the parent link goes when no class remains)
 *  - parent: POST /demandes-suivi/{id}/annuler
 *  - student: GET /eleves/{id}/suivi-parental (read-only, one item per parent and class)
 */
export interface ParentLinkRequest {
  id: string;
  parentId?: string | null;
  parentPrenom?: string | null;
  parentNom?: string | null;
  parentEmail?: string | null;
  eleveId?: string | null;
  elevePrenom?: string | null;
  eleveNom?: string | null;
  eleveEmail?: string | null;
  classeId?: string | null;
  classeNom?: string | null;
  etat: ParentLinkEtat | string;
  dateDemande?: string | null;
  dateReponse?: string | null;
  /** Active link: date since which the parent follows the student. */
  depuis?: string | null;
  motif?: string | null;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

const normalize = (raw: Record<string, any>): ParentLinkRequest | null => {
  if (!raw || (raw.id == null && raw.parentId == null)) return null;
  return {
    id: String(raw.id ?? `${raw.parentId}-${raw.eleveId ?? ''}-${raw.classeId ?? ''}`),
    parentId: raw.parentId != null ? String(raw.parentId) : null,
    parentPrenom: str(raw.parentPrenom),
    parentNom: str(raw.parentNom),
    parentEmail: str(raw.parentEmail),
    eleveId: raw.eleveId != null ? String(raw.eleveId) : null,
    elevePrenom: str(raw.elevePrenom),
    eleveNom: str(raw.eleveNom),
    eleveEmail: str(raw.eleveEmail),
    classeId: raw.classeId != null ? String(raw.classeId) : null,
    classeNom: str(raw.classeNom),
    etat: String(raw.etat ?? 'EN_ATTENTE').toUpperCase(),
    dateDemande: str(raw.dateDemande),
    dateReponse: str(raw.dateReponse),
    depuis: str(raw.depuis),
    motif: str(raw.motif),
  };
};

const normalizeList = (data: unknown): ParentLinkRequest[] =>
  (Array.isArray(data) ? data : [])
    .map((r) => normalize(r as Record<string, any>))
    .filter((r): r is ParentLinkRequest => !!r);

export const parentLinkName = (r: ParentLinkRequest) =>
  `${r.parentPrenom ?? ''} ${r.parentNom ?? ''}`.trim() || r.parentEmail || translate('parentLinks.parentFallback');

export const parentLinkStudentName = (r: ParentLinkRequest) =>
  `${r.elevePrenom ?? ''} ${r.eleveNom ?? ''}`.trim() || r.eleveEmail || translate('parentLinks.studentFallback');

type ActionError = Error & { code?: string; status?: number };

const actionError = (error: unknown): ActionError => {
  const code = getErrorCode(error);
  const status = (error as { response?: { status?: number } })?.response?.status;
  const err = new Error(
    status === 409 || code === 'CONFLICT' || code === 'INVALID_STATE'
      ? translate('parentLinks.alreadyHandled')
      : extractErrorMessage(error, translate('parentLinks.actionFailed'))
  ) as ActionError;
  if (code) err.code = code;
  err.status = status;
  return err;
};

const post = async (path: string): Promise<ParentLinkRequest | null> => {
  try {
    const { data } = await apiClient.post(path);
    return data && typeof data === 'object' ? normalize(data as Record<string, any>) : null;
  } catch (error) {
    throw actionError(error);
  }
};

export const parentLinkService = {
  /** Student: parents who follow him (read-only). */
  followers: async (eleveId: string): Promise<ParentLinkRequest[]> => {
    try {
      const { data } = await apiClient.get(`/eleves/${eleveId}/suivi-parental`);
      return normalizeList(data);
    } catch (error) {
      throw new Error(extractErrorMessage(error, translate('parentLinks.loadError')));
    }
  },

  /** Class manager / admin: pending follow requests of the class's students. */
  classRequests: async (classeId: string): Promise<ParentLinkRequest[]> => {
    const { data } = await apiClient.get(`/classes/${classeId}/demandes-suivi`);
    return normalizeList(data);
  },

  /** Class manager / admin: active follow links of the class's adult students. */
  classFollows: async (classeId: string): Promise<ParentLinkRequest[]> => {
    const { data } = await apiClient.get(`/classes/${classeId}/suivis-parentaux`);
    return normalizeList(data);
  },

  approve: (demandeId: string) => post(`/demandes-suivi/${demandeId}/approuver`),

  refuse: (demandeId: string, motif?: string) => {
    const m = motif?.trim();
    return post(`/demandes-suivi/${demandeId}/refuser${m ? `?motif=${encodeURIComponent(m)}` : ''}`);
  },

  /** Parent: cancels his own pending request. */
  cancel: (demandeId: string) => post(`/demandes-suivi/${demandeId}/annuler`),

  /** Class manager / admin: removes one class's follow (parent and student are notified). */
  removeFollow: async (followId: string): Promise<void> => {
    try {
      await apiClient.delete(`/demandes-suivi/${followId}`);
    } catch (error) {
      throw actionError(error);
    }
  },
};
