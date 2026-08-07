import { apiClient, extractErrorMessage } from './client';
import { ApiSuccess } from '../../types';

/**
 * Public (no-login) parent class-access flow reached via an emailed
 * link/token. Verified against ParentAccessApi.java — mounted at
 * /parent-access (NOT /acceder, a different controller), and the request
 * body matches ParentAccessRequestDto exactly (elevesIds for existing/major
 * students, elevesNoms/elevesEmails for new/minor students to be created).
 */
export interface ParentAccessRequest {
  token: string;
  parentId?: string;
  classeId: string;
  elevesIds?: string[];
  elevesNoms?: string[];
  elevesEmails?: string[];
}

export const parentAccessService = {
  validateTokenAndGetClassInfo: async (token: string, classId: string): Promise<Record<string, unknown>> => {
    try {
      const { data } = await apiClient.get('/parent-access/infos-classe', { params: { token, classId } });
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Lien invalide ou expiré.'));
    }
  },

  submitAccessRequest: async (payload: ParentAccessRequest): Promise<ApiSuccess> => {
    try {
      await apiClient.post('/parent-access/demande', payload);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de l'envoi de la demande."));
    }
  },
};
