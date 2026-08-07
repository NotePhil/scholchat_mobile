import { apiClient, extractErrorMessage } from './client';
import { ApiSuccess, Etablissement, Gestionnaire } from '../../types';

export const establishmentService = {
  getAll: async (): Promise<Etablissement[]> => {
    try {
      const { data } = await apiClient.get<Etablissement[]>('/etablissements');
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des établissements.'));
    }
  },

  getById: async (id: string): Promise<Etablissement> => {
    try {
      const { data } = await apiClient.get<Etablissement>(`/etablissements/${id}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec du chargement de l'établissement."));
    }
  },

  getByGestionnaire: async (gestionnaireId: string): Promise<Etablissement[]> => {
    try {
      const { data } = await apiClient.get<Etablissement[]>(`/etablissements/gestionnaire/${gestionnaireId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des établissements.'));
    }
  },

  getGestionnaire: async (establishmentId: string): Promise<Gestionnaire> => {
    try {
      const { data } = await apiClient.get<Gestionnaire>(`/etablissements/${establishmentId}/gestionnaire`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement du gestionnaire.'));
    }
  },

  create: async (payload: Partial<Etablissement>): Promise<Etablissement> => {
    try {
      const { data } = await apiClient.post<Etablissement>('/etablissements', payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de la création de l'établissement."));
    }
  },

  update: async (id: string, payload: Partial<Etablissement>): Promise<Etablissement> => {
    try {
      const { data } = await apiClient.put<Etablissement>(`/etablissements/${id}`, payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de la mise à jour de l'établissement."));
    }
  },

  remove: async (id: string): Promise<ApiSuccess> => {
    try {
      await apiClient.delete(`/etablissements/${id}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de la suppression de l'établissement."));
    }
  },

  /** Emailed-link class approval/rejection — no login required, reached via ClassApprovalScreen/ClassRejectionScreen. */
  approveClass: async (classeId: string, etablissementId: string): Promise<ApiSuccess> => {
    try {
      await apiClient.post(`/etablissements/approve-class/${classeId}/${etablissementId}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Erreur lors de la validation de la classe.'));
    }
  },

  rejectClass: async (classeId: string, etablissementId: string): Promise<ApiSuccess> => {
    try {
      await apiClient.post(`/etablissements/reject-class/${classeId}/${etablissementId}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Erreur lors du rejet de la classe.'));
    }
  },
};
