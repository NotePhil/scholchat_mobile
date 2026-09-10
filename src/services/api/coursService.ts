import { apiClient, extractErrorMessage } from './client';
import { ApiSuccess, Cours } from '../../types';

/**
 * create/update send only `{ id }` per matière (matching web's
 * CoursService.js and the backend's real write schema) — a full `Matiere`
 * (with `nom`, etc.) is only ever present on what a GET returns, so the
 * write payload can't reuse `Cours` as-is for that field.
 */
type CoursWritePayload = Partial<Omit<Cours, 'matieres'>> & { matieres?: { id: string }[] };

/** /cours endpoints, ported from scholchat_front's CoursService.js. */
export const coursService = {
  create: async (payload: CoursWritePayload): Promise<Cours> => {
    try {
      const { data } = await apiClient.post<Cours>('/cours', payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la création du cours.'));
    }
  },

  getByProfessor: async (professorId: string): Promise<Cours[]> => {
    try {
      const { data } = await apiClient.get<Cours[]>(`/cours/professeur/${professorId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des cours.'));
    }
  },

  getByMatiere: async (matiereId: string): Promise<Cours[]> => {
    try {
      const { data } = await apiClient.get<Cours[]>(`/cours/matiere/${matiereId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des cours.'));
    }
  },

  getByEtat: async (etat: string): Promise<Cours[]> => {
    try {
      const { data } = await apiClient.get<Cours[]>(`/cours/etat/${etat}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des cours.'));
    }
  },

  getById: async (id: string): Promise<Cours> => {
    try {
      const { data } = await apiClient.get<Cours>(`/cours/${id}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement du cours.'));
    }
  },

  update: async (id: string, payload: CoursWritePayload): Promise<Cours> => {
    try {
      const { data } = await apiClient.put<Cours>(`/cours/${id}`, payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la mise à jour du cours.'));
    }
  },

  remove: async (id: string): Promise<ApiSuccess> => {
    try {
      await apiClient.delete(`/cours/${id}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la suppression du cours.'));
    }
  },

  changeState: async (id: string, etat: string): Promise<Cours> => {
    try {
      const { data } = await apiClient.patch<Cours>(`/cours/${id}/state`, undefined, { params: { etat } });
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec du changement d'état du cours."));
    }
  },

  getByProfessorAndClass: async (professorId: string, classeId: string): Promise<Cours[]> => {
    try {
      const { data } = await apiClient.get<Cours[]>(`/cours/professeur/${professorId}/classe/${classeId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des cours.'));
    }
  },

  getWithChapitres: async (id: string): Promise<Cours> => {
    try {
      const { data } = await apiClient.get<Cours>(`/cours/${id}/complet`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement du cours.'));
    }
  },

  getAccessible: async (userId: string): Promise<Cours[]> => {
    try {
      const { data } = await apiClient.get<Cours[]>(`/cours/accessibles/${userId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des cours.'));
    }
  },

  getProgression: async (coursId: string, utilisateurId: string): Promise<Record<string, unknown>> => {
    try {
      const { data } = await apiClient.get(`/cours/${coursId}/progression/${utilisateurId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement de la progression.'));
    }
  },

  markChapterComplete: async (coursId: string, chapitreId: string, utilisateurId: string): Promise<ApiSuccess> => {
    try {
      await apiClient.post(`/cours/${coursId}/chapitres/${chapitreId}/complete/${utilisateurId}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la mise à jour de la progression.'));
    }
  },

  getByRestriction: async (restriction: string): Promise<Cours[]> => {
    try {
      const { data } = await apiClient.get<Cours[]>(`/cours/restriction/${restriction}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des cours.'));
    }
  },
};
