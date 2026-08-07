import { apiClient, extractErrorMessage } from './client';
import { Gestionnaire } from '../../types';

/** /gestionnaires, ported from scholchat_front's GestionnaireService.js. */
export const gestionnaireService = {
  getAll: async (): Promise<Gestionnaire[]> => {
    try {
      const { data } = await apiClient.get<Gestionnaire[]>('/gestionnaires');
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des gestionnaires.'));
    }
  },

  getById: async (id: string): Promise<Gestionnaire> => {
    try {
      const { data } = await apiClient.get<Gestionnaire>(`/gestionnaires/${id}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement du gestionnaire.'));
    }
  },

  /** Gestionnaire accounts are created through /utilisateurs with type "gestionnaire". */
  create: async (payload: Record<string, unknown>): Promise<Record<string, unknown>> => {
    try {
      const { data } = await apiClient.post('/utilisateurs', { ...payload, type: 'gestionnaire' });
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la création du gestionnaire.'));
    }
  },
};
