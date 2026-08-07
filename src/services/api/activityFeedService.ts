import { apiClient, extractErrorMessage } from './client';
import { ActivityEvent, ApiSuccess, Interaction } from '../../types';

/**
 * /evenements — the activity/event feed. Field names verified against the
 * backend's `Evenement` model: `description` (not `contenu`), `createurId`
 * (not `auteurId`), and likes/comments both live in a single `interactions`
 * list distinguished by `type` (LIKE | COMMENT | JOIN | UNJOIN), not
 * separate arrays. Comment body is `{ content }`, not `{ contenu }`.
 */
export const activityFeedService = {
  getAll: async (): Promise<ActivityEvent[]> => {
    try {
      const { data } = await apiClient.get<ActivityEvent[]>('/evenements');
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des activités.'));
    }
  },

  getById: async (id: string): Promise<ActivityEvent> => {
    try {
      const { data } = await apiClient.get<ActivityEvent>(`/evenements/${id}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec du chargement de l'activité."));
    }
  },

  getByProfessor: async (professorId: string): Promise<ActivityEvent[]> => {
    try {
      const { data } = await apiClient.get<ActivityEvent[]>(`/evenements/professeur/${professorId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des activités.'));
    }
  },

  create: async (payload: {
    titre: string;
    description?: string;
    lieu?: string;
    etat?: string;
    heureDebut?: string;
    heureFin?: string;
    createurId: string;
    visibility?: 'PUBLIC' | 'PRIVATE';
    classesIds?: string[];
    participantsIds?: string[];
    medias?: { filePath?: string; mediaType?: string; fileName?: string; presignedUrl?: string }[];
  }): Promise<ActivityEvent> => {
    try {
      const { data } = await apiClient.post<ActivityEvent>('/evenements', payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de la création de l'activité."));
    }
  },

  update: async (id: string, payload: Partial<ActivityEvent>): Promise<ActivityEvent> => {
    try {
      const { data } = await apiClient.put<ActivityEvent>(`/evenements/${id}`, payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de la mise à jour de l'activité."));
    }
  },

  remove: async (id: string): Promise<ApiSuccess> => {
    try {
      await apiClient.delete(`/evenements/${id}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de la suppression de l'activité."));
    }
  },

  like: async (id: string): Promise<ApiSuccess> => {
    try {
      await apiClient.post(`/evenements/${id}/like`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de l'ajout du like."));
    }
  },

  comment: async (id: string, content: string): Promise<Interaction> => {
    try {
      const { data } = await apiClient.post<Interaction>(`/evenements/${id}/comment`, { content });
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de l'ajout du commentaire."));
    }
  },

  join: async (id: string): Promise<ApiSuccess> => {
    try {
      await apiClient.post(`/evenements/${id}/join`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la participation.'));
    }
  },

  unjoin: async (id: string): Promise<ApiSuccess> => {
    try {
      await apiClient.post(`/evenements/${id}/unjoin`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du retrait de la participation.'));
    }
  },
};
