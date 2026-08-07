import { apiClient, extractErrorMessage } from './client';
import { ApiSuccess, ClassEntity, RejectionMotif } from '../../types';

/**
 * Admin/moderation-oriented class endpoints not already covered by
 * classService.ts (which serves the Professor screens). Ported from
 * scholchat_front's ClassService.js + RejectionServiceClass.js.
 */
export const classAdminService = {
  getAll: async (): Promise<ClassEntity[]> => {
    try {
      const { data } = await apiClient.get<ClassEntity[]>('/classes');
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des classes.'));
    }
  },

  getByStatus: async (etat: string): Promise<ClassEntity[]> => {
    try {
      const { data } = await apiClient.get<ClassEntity[]>('/classes/by-status', { params: { etat } });
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des classes.'));
    }
  },

  getByCode: async (code: string): Promise<ClassEntity> => {
    try {
      const { data } = await apiClient.get<ClassEntity>(`/classes/by-code/${code}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Classe introuvable pour ce code.'));
    }
  },

  update: async (id: string, payload: Partial<ClassEntity>): Promise<ClassEntity> => {
    try {
      const { data } = await apiClient.put<ClassEntity>(`/classes/${id}`, payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la mise à jour de la classe.'));
    }
  },

  approve: async (id: string): Promise<ClassEntity> => {
    try {
      const { data } = await apiClient.patch<ClassEntity>(`/classes/${id}/approve`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de l'approbation de la classe."));
    }
  },

  reject: async (id: string, motif: string): Promise<ClassEntity> => {
    try {
      const { data } = await apiClient.patch<ClassEntity>(`/classes/${id}/reject`, undefined, {
        params: { motif },
      });
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du rejet de la classe.'));
    }
  },

  remove: async (id: string): Promise<ApiSuccess> => {
    try {
      await apiClient.delete(`/classes/${id}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la suppression de la classe.'));
    }
  },

  /** droitPublication: PROFESSEUR_UNIQUE | TOUS_LES_PROFESSEURS | MODERATEUR_SEULEMENT (DroitPublication enum, not a boolean). */
  updatePublicationRightsFlag: async (
    id: string,
    droitPublication: 'PROFESSEUR_UNIQUE' | 'TOUS_LES_PROFESSEURS' | 'MODERATEUR_SEULEMENT'
  ): Promise<ClassEntity> => {
    try {
      const { data } = await apiClient.patch<ClassEntity>(`/classes/${id}/publication-rights`, undefined, {
        params: { droitPublication },
      });
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la mise à jour des droits de publication.'));
    }
  },

  getActivationHistory: async (classId: string): Promise<Record<string, unknown>[]> => {
    try {
      const { data } = await apiClient.get(`/classes/${classId}/activation-history`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec du chargement de l'historique."));
    }
  },

  removeModerator: async (classId: string): Promise<ApiSuccess> => {
    try {
      await apiClient.delete(`/classes/${classId}/moderator`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du retrait du modérateur.'));
    }
  },

  // --- Class rejection reasons ---
  getRejectionMotifs: async (): Promise<RejectionMotif[]> => {
    try {
      const { data } = await apiClient.get<RejectionMotif[]>('/motifsRejetClasses');
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des motifs de rejet.'));
    }
  },

  createRejectionMotif: async (payload: Partial<RejectionMotif>): Promise<RejectionMotif> => {
    try {
      const { data } = await apiClient.post<RejectionMotif>('/motifsRejetClasses', payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la création du motif de rejet.'));
    }
  },

  deleteRejectionMotif: async (id: string): Promise<ApiSuccess> => {
    try {
      await apiClient.delete(`/motifsRejetClasses/${id}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la suppression du motif.'));
    }
  },

  getRejectionMotifByCode: async (code: string): Promise<RejectionMotif> => {
    try {
      const { data } = await apiClient.get<RejectionMotif>(`/motifsRejetClasses/code/${code}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Motif introuvable.'));
    }
  },

};
