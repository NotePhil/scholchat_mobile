import { apiClient, extractErrorMessage } from './client';
import { ApiSuccess, Offre } from '../../types';

export const offerService = {
  list: async (cible?: 'CLASSE' | 'ETABLISSEMENT', toutes = false): Promise<Offre[]> => {
    try {
      const { data } = await apiClient.get<Offre[]>('/offres', { params: { cible, toutes } });
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des offres.'));
    }
  },

  getById: async (id: string): Promise<Offre> => {
    try {
      const { data } = await apiClient.get<Offre>(`/offres/${id}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec du chargement de l'offre."));
    }
  },

  create: async (payload: Partial<Offre>): Promise<Offre> => {
    try {
      const { data } = await apiClient.post<Offre>('/offres', payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de la création de l'offre."));
    }
  },

  update: async (id: string, payload: Partial<Offre>): Promise<Offre> => {
    try {
      const { data } = await apiClient.put<Offre>(`/offres/${id}`, payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de la mise à jour de l'offre."));
    }
  },

  deactivate: async (id: string): Promise<ApiSuccess> => {
    try {
      await apiClient.delete(`/offres/${id}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de la désactivation de l'offre."));
    }
  },
};
