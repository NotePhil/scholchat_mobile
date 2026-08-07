import { apiClient, extractErrorMessage } from './client';
import { ApiSuccess, RejectionMotif } from '../../types';

/** /motifsRejets — professor/user rejection-reason catalog (admin-managed). */
export const rejectionService = {
  getAll: async (): Promise<RejectionMotif[]> => {
    try {
      const { data } = await apiClient.get<RejectionMotif[]>('/motifsRejets');
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des motifs de rejet.'));
    }
  },

  getById: async (id: string): Promise<RejectionMotif> => {
    try {
      const { data } = await apiClient.get<RejectionMotif>(`/motifsRejets/${id}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement du motif de rejet.'));
    }
  },

  create: async (payload: Partial<RejectionMotif>): Promise<RejectionMotif> => {
    try {
      const { data } = await apiClient.post<RejectionMotif>('/motifsRejets', payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la création du motif de rejet.'));
    }
  },

  update: async (id: string, payload: Partial<RejectionMotif>): Promise<RejectionMotif> => {
    try {
      const { data } = await apiClient.patch<RejectionMotif>(`/motifsRejets/${id}`, payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la mise à jour du motif de rejet.'));
    }
  },

  remove: async (id: string): Promise<ApiSuccess> => {
    try {
      await apiClient.delete(`/motifsRejets/${id}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la suppression du motif de rejet.'));
    }
  },
};
