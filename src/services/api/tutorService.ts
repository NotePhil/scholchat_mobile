import { apiClient, extractErrorMessage } from './client';
import { ApiSuccess, TutorUser } from '../../types';

/** repetiteurs (tutors) CRUD, ported from scholchat_front's userService.js. */
export const tutorService = {
  getAll: async (): Promise<TutorUser[]> => {
    try {
      const { data } = await apiClient.get<TutorUser[]>('/repetiteurs');
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des répétiteurs.'));
    }
  },

  getById: async (id: string): Promise<TutorUser> => {
    try {
      const { data } = await apiClient.get<TutorUser>(`/repetiteurs/${id}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement du répétiteur.'));
    }
  },

  create: async (payload: Partial<TutorUser>): Promise<TutorUser> => {
    try {
      const { data } = await apiClient.post<TutorUser>('/repetiteurs', payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la création du répétiteur.'));
    }
  },

  update: async (id: string, payload: Partial<TutorUser>): Promise<TutorUser> => {
    try {
      const { data } = await apiClient.put<TutorUser>(`/repetiteurs/${id}`, payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la mise à jour du répétiteur.'));
    }
  },

  remove: async (id: string): Promise<ApiSuccess> => {
    try {
      await apiClient.delete(`/repetiteurs/${id}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la suppression du répétiteur.'));
    }
  },
};
