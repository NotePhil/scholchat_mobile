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
      const { data } = await apiClient.post<ParentUser>('/parents', payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la création du parent.'));
    }
  },

  update: async (id: string, payload: Partial<ParentUser>): Promise<ParentUser> => {
    try {
      const { data } = await apiClient.put<ParentUser>(`/parents/${id}`, payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la mise à jour du parent.'));
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
