import { apiClient, extractErrorMessage } from './client';
import { ApiSuccess, Professor, RejectionMotif } from '../../types';

export const professorService = {
  getAll: async (): Promise<Professor[]> => {
    try {
      const { data } = await apiClient.get<Professor[]>('/professeurs');
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des professeurs.'));
    }
  },

  getById: async (id: string): Promise<Professor> => {
    try {
      const { data } = await apiClient.get<Professor>(`/professeurs/${id}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement du professeur.'));
    }
  },

  create: async (payload: Partial<Professor>): Promise<Professor> => {
    try {
      // The backend resolves the concrete user subtype from the "type" JSON property
      // (@JsonTypeInfo discriminator on Utilisateurs). Route through /utilisateurs
      // with type: 'professeur' matching web's ScholchatService.createUser.
      const body = {
        type: 'professeur',
        nom: payload.nom?.trim(),
        prenom: payload.prenom?.trim(),
        email: payload.email?.trim().toLowerCase(),
        telephone: payload.telephone?.trim(),
        adresse: payload.adresse?.trim(),
        etat: payload.etat || 'ACTIVE',
        matriculeProfesseur: payload.matriculeProfesseur || null,
        cniUrlRecto: payload.cniUrlRecto || null,
        cniUrlVerso: payload.cniUrlVerso || null,
        selfieUrl: payload.selfieUrl || null,
      };
      const { data } = await apiClient.post<Professor>('/utilisateurs', body);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la création du professeur.'));
    }
  },

  update: async (id: string, payload: Partial<Professor>): Promise<Professor> => {
    try {
      // /utilisateurs/{id} only exposes PATCH (patcherUtilisateur) — PUT is not supported
      // on the backend. PATCH requires "type: 'professeur'" for proper subtype deserialization.
      const body = {
        type: 'professeur',
        ...payload,
        email: payload.email ? payload.email.trim().toLowerCase() : undefined,
      };
      const { data } = await apiClient.patch<Professor>(`/utilisateurs/${id}`, body);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la mise à jour du professeur.'));
    }
  },

  remove: async (id: string): Promise<ApiSuccess> => {
    try {
      await apiClient.delete(`/professeurs/${id}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la suppression du professeur.'));
    }
  },

  getRejectionMotifs: async (id: string): Promise<RejectionMotif[]> => {
    try {
      const { data } = await apiClient.get<RejectionMotif[]>(`/professeurs/${id}/motifs`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des motifs de rejet.'));
    }
  },

  addRejectionMotif: async (id: string, motifId: string): Promise<ApiSuccess> => {
    try {
      await apiClient.post(`/professeurs/${id}/motifs/${motifId}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de l'ajout du motif de rejet."));
    }
  },

  removeRejectionMotif: async (id: string, motifId: string): Promise<ApiSuccess> => {
    try {
      await apiClient.delete(`/professeurs/${id}/motifs/${motifId}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du retrait du motif de rejet.'));
    }
  },

  /**
   * Other professors with publication rights on this professor's classes
   * (excluding self) — mirrors web's ProfessorsContent.jsx professor-role
   * branch, which hits this same endpoint instead of the admin-only
   * `getAll()` list.
   */
  getCollaborateurs: async (id: string): Promise<Professor[]> => {
    try {
      const { data } = await apiClient.get<Professor[]>(`/professeurs/moderateur/${id}/collaborateurs`);
      return Array.isArray(data) ? data.filter((p) => p.id !== id) : [];
    } catch {
      return [];
    }
  },
};
