import { apiClient, extractErrorMessage } from './client';
import { ApiSuccess, ClassEntity, CoursProgramme, ParentUser, StudentProfile } from '../../types';

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

  /** Links an existing student profile to a parent — the actual parent/child relationship (ParentsApi.ajouterEnfant). */
  addChild: async (parentId: string, eleveId: string): Promise<ApiSuccess> => {
    try {
      await apiClient.post(`/parents/${parentId}/enfants/${eleveId}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec du rattachement de l'enfant."));
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
