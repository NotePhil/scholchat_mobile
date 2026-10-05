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

  /**
   * Same two calls as web's GestionnairesManagement.jsx handleCreate:
   * 1. POST /utilisateurs { type: "gestionnaire", nom, prenom, email, telephone, adresse, etat: "ACTIVE" }
   * 2. best-effort POST /auth/registerPassword { email, passeAccess } (failure is ignored, like on web).
   */
  create: async (
    payload: { nom: string; prenom: string; email: string; telephone: string; adresse: string },
    password: string
  ): Promise<Record<string, unknown>> => {
    let created: Record<string, unknown>;
    try {
      const { data } = await apiClient.post('/utilisateurs', {
        type: 'gestionnaire',
        nom: payload.nom.trim(),
        prenom: payload.prenom.trim(),
        email: payload.email.trim(),
        telephone: payload.telephone.trim() ? `+237${payload.telephone.trim()}` : null,
        adresse: payload.adresse.trim() || null,
        etat: 'ACTIVE',
      });
      created = data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Erreur lors de la creation'));
    }
    try {
      await apiClient.post('/auth/registerPassword', { email: payload.email.trim(), passeAccess: password });
    } catch (pwErr) {
      console.warn('Could not set password:', pwErr);
    }
    return created;
  },

  remove: async (id: string): Promise<void> => {
    try {
      await apiClient.delete(`/utilisateurs/${id}`);
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la suppression du gestionnaire.'));
    }
  },
};

