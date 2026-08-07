import { apiClient, extractErrorMessage } from './client';
import { AccessRequest, ApiSuccess, ClassEntity, ClassUser } from '../../types';

/**
 * Class access-request workflow, ported from scholchat_front's
 * accederService.js. classService.ts already covers the subset the
 * Professor screens use (getClassAccessRequests/approve/reject/getClassUsers);
 * this is the full surface for Admin/class-management-depth screens.
 */
export const accederService = {
  demanderAcces: async (params: {
    utilisateurId: string;
    classeId: string;
    codeActivation: string;
    estParent?: boolean;
    eleveAssocieId?: string;
  }): Promise<ApiSuccess> => {
    try {
      await apiClient.post('/acceder/demandes', undefined, { params });
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de la demande d'accès."));
    }
  },

  getRequestsForClass: async (classeId: string): Promise<AccessRequest[]> => {
    try {
      const { data } = await apiClient.get<AccessRequest[]>(`/acceder/classes/${classeId}/demandes`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec du chargement des demandes d'accès."));
    }
  },

  getRequestsForModerator: async (moderatorId: string): Promise<AccessRequest[]> => {
    try {
      const { data } = await apiClient.get<AccessRequest[]>(`/acceder/moderator/${moderatorId}/demandes`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des demandes.'));
    }
  },

  approveRequest: async (demandeId: string): Promise<ApiSuccess> => {
    try {
      await apiClient.post(`/acceder/demandes/${demandeId}/approve`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de l'approbation de la demande."));
    }
  },

  rejectRequest: async (demandeId: string, motifRejet: string): Promise<ApiSuccess> => {
    try {
      await apiClient.post(`/acceder/demandes/${demandeId}/reject`, undefined, { params: { motifRejet } });
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du rejet de la demande.'));
    }
  },

  removeAccess: async (utilisateurId: string, classeId: string): Promise<ApiSuccess> => {
    try {
      await apiClient.delete(`/acceder/${utilisateurId}/${classeId}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec du retrait de l'accès."));
    }
  },

  getUsersWithAccess: async (classeId: string): Promise<ClassUser[]> => {
    try {
      const { data } = await apiClient.get<ClassUser[]>(`/acceder/classes/${classeId}/utilisateurs`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des membres.'));
    }
  },

  getUsersWithAccessForClasses: async (classeIds: string[]): Promise<ClassUser[]> => {
    try {
      const { data } = await apiClient.get<ClassUser[]>('/acceder/classes/utilisateurs', {
        params: { classeIds: classeIds.join(',') },
      });
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des membres.'));
    }
  },

  getAccessibleClasses: async (userId: string): Promise<ClassEntity[]> => {
    try {
      const { data } = await apiClient.get<ClassEntity[]>(`/acceder/utilisateurs/${userId}/classes`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des classes.'));
    }
  },
};
