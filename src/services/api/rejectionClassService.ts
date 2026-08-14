import { apiClient, extractErrorMessage } from './client';
import { ApiSuccess, RejectionMotif } from '../../types';

/**
 * /motifsRejetClasses — class-rejection-reason catalog. Unlike /motifsRejets
 * (professor motifs), the backend has no PUT/PATCH here (MotifsRejetClasseApi
 * only exposes POST/GET/DELETE/GET-by-code) — matching web's
 * RejectionServiceClass.js, which has no updateClassRejectionMotif method.
 */
export const rejectionClassService = {
  getAll: async (): Promise<RejectionMotif[]> => {
    try {
      const { data } = await apiClient.get<RejectionMotif[]>('/motifsRejetClasses');
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des motifs de rejet de classe.'));
    }
  },

  getByCode: async (code: string): Promise<RejectionMotif> => {
    try {
      const { data } = await apiClient.get<RejectionMotif>(`/motifsRejetClasses/code/${code}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement du motif de rejet.'));
    }
  },

  create: async (payload: Partial<RejectionMotif>): Promise<RejectionMotif> => {
    try {
      const { data } = await apiClient.post<RejectionMotif>('/motifsRejetClasses', payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la création du motif de rejet.'));
    }
  },

  remove: async (id: string): Promise<ApiSuccess> => {
    try {
      await apiClient.delete(`/motifsRejetClasses/${id}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la suppression du motif de rejet.'));
    }
  },
};
