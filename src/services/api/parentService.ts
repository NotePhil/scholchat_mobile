import { apiClient, extractErrorMessage, getErrorCode } from './client';
import { ApiSuccess, ClassEntity, CoursProgramme, ParentUser, StudentProfile } from '../../types';
import { TranslationKey, localizedServerMessage, translate } from '../../i18n';

/** Status of one class request made for a child (GET /parents/{id}/enfants/statuts). */
export type ChildClassStatut = 'APPROUVEE' | 'EN_ATTENTE' | 'REJETEE';

export interface ChildClassStatus {
  classeId: string;
  classeNom?: string | null;
  statut: ChildClassStatut | string;
  motifRejet?: string | null;
  dateDemande?: string | null;
}

/** One child of the parent with the state of each of its class requests. */
export interface ChildStatus {
  enfantId: string;
  prenom?: string | null;
  nom?: string | null;
  niveau?: string | null;
  classes: ChildClassStatus[];
}

/** Error codes of a child inscription (sign-up child cards and POST /parents/{id}/enfants/inscription). */
export const CHILD_ERROR_KEYS: Record<string, TranslationKey> = {
  CODE_CLASSE_INVALIDE: 'classPreview.errors.invalid',
  CLASSE_NON_ACTIVE: 'classPreview.errors.inactive',
  CODE_CLASSE_REQUIS: 'classPreview.errors.required',
  ENFANT_INVALIDE: 'parentChildren.errors.invalidChild',
  ENFANT_DEJA_INSCRIT: 'parentChildren.errors.duplicate',
  ENFANT_EN_DOUBLE: 'parentChildren.errors.duplicate',
  DEMANDE_DEJA_EXISTANTE: 'parentChildren.errors.duplicate',
  DUPLICATE_RESOURCE: 'parentChildren.errors.duplicate',
  ENFANTS_REQUIS: 'parentChildren.errors.childrenRequired',
  TROP_DE_TENTATIVES: 'classPreview.errors.tooMany',
};

/** A class-code problem (to show under the code field) rather than a name / general one. */
export const isClassCodeError = (code?: string) => !!code && /CODE_CLASSE|CLASSE_/.test(code);

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Defensive normalization of a GET /parents/{id}/enfants/statuts row. */
const normalizeChildStatus = (raw: Record<string, any>): ChildStatus | null => {
  const id = raw?.enfantId ?? raw?.id ?? raw?.eleveId;
  if (id == null || id === '') return null;
  const classes = Array.isArray(raw.classes) ? raw.classes : Array.isArray(raw.demandes) ? raw.demandes : [];
  return {
    enfantId: String(id),
    prenom: str(raw.prenom),
    nom: str(raw.nom),
    niveau: str(raw.niveau),
    classes: classes
      .filter((c: any) => c && typeof c === 'object')
      .map((c: Record<string, any>) => ({
        classeId: String(c.classeId ?? c.id ?? ''),
        classeNom: str(c.classeNom) ?? str(c.nom),
        statut: String(c.statut ?? c.etat ?? 'EN_ATTENTE').toUpperCase(),
        motifRejet: str(c.motifRejet),
        dateDemande: str(c.dateDemande),
      })),
  };
};

/**
 * Parent CRUD + parent/child relationship data, ported from
 * scholchat_front's parentService.js and the parent parts of
 * ScholchatService.js.
 */
export const parentService = {
  getAllSummary: async (): Promise<ParentUser[]> => {
    try {
      const { data } = await apiClient.get<ParentUser[]>('/parents/summary');
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des parents.'));
    }
  },

  getById: async (id: string): Promise<ParentUser> => {
    try {
      const { data } = await apiClient.get<ParentUser>(`/parents/${id}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement du parent.'));
    }
  },

  create: async (payload: Partial<ParentUser>): Promise<ParentUser> => {
    try {
      // POST /parents (ParentsBusiness.posterParent) never assigns an id before
      // save and throws "Identifier ... must be manually assigned". /utilisateurs
      // with type: 'parent' routes through UtilisateursBusiness.posterUtilisateur
      // which performs ID generation and role assignment correctly, matching web.
      const body = {
        type: 'parent',
        nom: payload.nom?.trim(),
        prenom: payload.prenom?.trim(),
        email: payload.email?.trim().toLowerCase(),
        telephone: payload.telephone?.trim(),
        adresse: payload.adresse?.trim(),
        etat: payload.etat || 'ACTIVE',
        classes: payload.classes || [],
      };
      const { data } = await apiClient.post<ParentUser>('/utilisateurs', body);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la création du parent.'));
    }
  },

  update: async (id: string, payload: Partial<ParentUser>): Promise<ParentUser> => {
    const body = {
      type: 'parent',
      ...payload,
      email: payload.email ? payload.email.trim().toLowerCase() : undefined,
    };
    try {
      const { data } = await apiClient.put<ParentUser>(`/parents/${id}`, body);
      return data;
    } catch {
      try {
        const { data } = await apiClient.patch<ParentUser>(`/utilisateurs/${id}`, body);
        return data;
      } catch (patchErr) {
        throw new Error(extractErrorMessage(patchErr, 'Échec de la mise à jour du parent.'));
      }
    }
  },

  remove: async (id: string): Promise<ApiSuccess> => {
    try {
      await apiClient.delete(`/parents/${id}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la suppression du parent.'));
    }
  },

  getByProfessor: async (professorId: string): Promise<ParentUser[]> => {
    try {
      const { data } = await apiClient.get<ParentUser[]>(`/parents/professeur/${professorId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des parents.'));
    }
  },

  getChildren: async (parentId: string): Promise<StudentProfile[]> => {
    try {
      const { data } = await apiClient.get<StudentProfile[]>(`/parents/${parentId}/enfants`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des enfants.'));
    }
  },

  /**
   * Creates a child's student profile from a parent account — POST /profil-eleves, exactly
   * like web's AddChildModal.jsx (allowed for ROLE_PARENT; the server assigns the id and
   * neutralises sensitive fields). NOT /utilisateurs: with an email that already exists
   * that endpoint ADDS a role to the existing account instead of creating the child.
   */
  createChildProfile: async (payload: {
    nom: string;
    prenom: string;
    niveau: string;
    email?: string;
    telephone?: string;
  }): Promise<StudentProfile> => {
    const genId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
    try {
      const { data } = await apiClient.post<StudentProfile>('/profil-eleves', {
        id: genId,
        type: 'eleve',
        nom: payload.nom.trim(),
        prenom: payload.prenom.trim(),
        niveau: payload.niveau,
        email: payload.email?.trim() || null,
        telephone: payload.telephone?.trim() || null,
        etat: 'ACTIVE',
      });
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Erreur lors de la creation de l'eleve"));
    }
  },

  /** Links an existing student profile to a parent — the actual parent/child relationship (ParentsApi.ajouterEnfant). */
  addChild: async (parentId: string, eleveId: string): Promise<ApiSuccess> => {
    try {
      await apiClient.post(`/parents/${parentId}/enfants/${eleveId}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Erreur lors de l'association de l'enfant"));
    }
  },

  removeChild: async (parentId: string, eleveId: string): Promise<ApiSuccess> => {
    try {
      await apiClient.delete(`/parents/${parentId}/enfants/${eleveId}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec du retrait de l'enfant."));
    }
  },

  /**
   * GET /parents/{id}/enfants/statuts — every child of the parent with the state of each class
   * request (APPROUVEE / EN_ATTENTE / REJETEE + motifRejet). Allowed while the parent has no
   * approved child yet (limited mode).
   */
  getChildrenStatuses: async (parentId: string): Promise<ChildStatus[]> => {
    try {
      const { data } = await apiClient.get(`/parents/${parentId}/enfants/statuts`);
      const list = Array.isArray(data) ? data : [];
      return list.map((r) => normalizeChildStatus(r as Record<string, any>)).filter((r): r is ChildStatus => !!r);
    } catch (error) {
      throw new Error(extractErrorMessage(error, translate('parentChildren.loadError')));
    }
  },

  /**
   * POST /parents/{id}/enfants/inscription {prenom, nom, codeClasse} — creates the child and its
   * request for the class (the teacher approves it). Throws an Error carrying the backend `code`.
   */
  enrollChild: async (
    parentId: string,
    payload: { prenom: string; nom: string; codeClasse: string }
  ): Promise<Record<string, unknown>> => {
    try {
      const { data } = await apiClient.post(`/parents/${parentId}/enfants/inscription`, {
        prenom: payload.prenom.trim(),
        nom: payload.nom.trim(),
        codeClasse: payload.codeClasse.trim().toUpperCase(),
      });
      return (data ?? {}) as Record<string, unknown>;
    } catch (error) {
      const code = getErrorCode(error);
      const message = extractErrorMessage(error, translate('parentChildren.add.failed'));
      const err = new Error(localizedServerMessage(message, code ? CHILD_ERROR_KEYS[code] : undefined)) as Error & { code?: string };
      if (code) err.code = code;
      throw err;
    }
  },

  getChildClasses: async (childId: string): Promise<ClassEntity[]> => {
    try {
      const { data } = await apiClient.get<ClassEntity[]>(`/acceder/utilisateurs/${childId}/classes`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des classes.'));
    }
  },

  getChildScheduledCourses: async (childId: string): Promise<CoursProgramme[]> => {
    try {
      const { data } = await apiClient.get<CoursProgramme[]>(`/cours-programmes/by-participant/${childId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des cours programmés.'));
    }
  },
};
