import { apiClient, extractErrorMessage } from './client';
import { ApiSuccess, Matiere } from '../../types';

export const matiereService = {
  getAll: async (): Promise<Matiere[]> => {
    try {
      const { data } = await apiClient.get<Matiere[]>('/matieres');
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des matières.'));
    }
  },

  getByName: async (nom: string): Promise<Matiere> => {
    try {
      const { data } = await apiClient.get<Matiere>(`/matieres/${nom}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement de la matière.'));
    }
  },

  create: async (nom: string): Promise<Matiere> => {
    try {
      const { data } = await apiClient.post<Matiere>('/matieres', { nom });
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la création de la matière.'));
    }
  },

  update: async (id: string, nom: string): Promise<Matiere> => {
    try {
      const { data } = await apiClient.put<Matiere>(`/matieres/${id}`, { nom });
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la mise à jour de la matière.'));
    }
  },

  remove: async (id: string): Promise<ApiSuccess> => {
    try {
      await apiClient.delete(`/matieres/${id}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la suppression de la matière.'));
    }
  },
};
