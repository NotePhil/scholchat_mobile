import { apiClient, extractErrorMessage } from './client';
import { AdminUser, ApiSuccess } from '../../types';

/**
 * Generic /utilisateurs endpoints, ported from scholchat_front's
 * userService.js + the user-account parts of ScholchatService.js /
 * RejectionService.js (pending-professor validation).
 */
export const userService = {
  getAdmins: async (): Promise<AdminUser[]> => {
    try {
      const { data } = await apiClient.get<AdminUser[]>('/utilisateurs/admins');
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des administrateurs.'));
    }
  },

  getAllUsers: async (): Promise<Record<string, unknown>[]> => {
    try {
      const { data } = await apiClient.get('/utilisateurs');
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des utilisateurs.'));
    }
  },

  getUserById: async (id: string): Promise<Record<string, unknown>> => {
    try {
      const { data } = await apiClient.get(`/utilisateurs/${id}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec du chargement de l'utilisateur."));
    }
  },

  createUser: async (payload: Record<string, unknown>): Promise<Record<string, unknown>> => {
    if (!payload.type) {
      throw new Error("createUser() requires an explicit 'type' (the backend uses it to decide which role to grant).");
    }
    try {
      const body: Record<string, unknown> = {
        ...payload,
        nom: typeof payload.nom === 'string' ? payload.nom.trim() : payload.nom,
        prenom: typeof payload.prenom === 'string' ? payload.prenom.trim() : payload.prenom,
        email: typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : payload.email,
        telephone: typeof payload.telephone === 'string' ? payload.telephone.trim() : payload.telephone,
        adresse: typeof payload.adresse === 'string' ? payload.adresse.trim() : payload.adresse,
        etat: payload.etat || 'ACTIVE',
      };
      const { data } = await apiClient.post('/utilisateurs', body);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de la création de l'utilisateur."));
    }
  },

  updateUser: async (id: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> => {
    try {
      const body: Record<string, unknown> = {
        ...payload,
        email: typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : payload.email,
      };
      const { data } = await apiClient.patch(`/utilisateurs/${id}`, body);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de la mise à jour de l'utilisateur."));
    }
  },

  replaceUser: async (id: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> => {
    try {
      // /utilisateurs/{id} only exposes PATCH on backend — fallback cleanly if PUT is attempted
      const body: Record<string, unknown> = {
        ...payload,
        email: typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : payload.email,
      };
      const { data } = await apiClient.patch(`/utilisateurs/${id}`, body);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de la mise à jour de l'utilisateur."));
    }
  },

  deleteUser: async (id: string): Promise<ApiSuccess> => {
    try {
      await apiClient.delete(`/utilisateurs/${id}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de la suppression de l'utilisateur."));
    }
  },

  resendActivationEmail: async (email: string): Promise<ApiSuccess> => {
    try {
      await apiClient.post('/utilisateurs/regenerate-activation', undefined, { params: { email } });
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de l'envoi de l'email d'activation."));
    }
  },

  getPendingProfessors: async (page = 0, limit = 20): Promise<Record<string, unknown>> => {
    try {
      const { data } = await apiClient.get('/utilisateurs/professors/pending', { params: { page, limit } });
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des professeurs en attente.'));
    }
  },

  validateProfessor: async (id: string): Promise<Record<string, unknown>> => {
    try {
      const { data } = await apiClient.post(`/utilisateurs/professors/${id}/validate`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la validation du professeur.'));
    }
  },

  rejectProfessor: async (
    id: string,
    codeErreur: string,
    motifSupplementaire?: string
  ): Promise<Record<string, unknown>> => {
    try {
      const { data } = await apiClient.post(`/utilisateurs/professeurs/${id}/rejet`, undefined, {
        params: { codeErreur, motifSupplementaire },
      });
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du rejet du professeur.'));
    }
  },
};
