import { apiClient, extractErrorMessage } from './client';
import { ApiSuccess, CoursProgramme } from '../../types';

/**
 * /cours-programmes endpoints. Field names verified against the backend's
 * `CoursProgrammer` model (interfaces.modeles.CoursProgrammer) — dates are
 * dateCoursPrevue/dateDebutEffectif/dateFinEffectif, state is
 * `etatCoursProgramme`, and `classesIds` is plural (a course can be
 * scheduled onto several classes in one record).
 */
export const coursProgrammerService = {
  programmer: async (payload: {
    coursId: string;
    professeurId: string;
    dateCoursPrevue?: string;
    dateDebutEffectif?: string;
    dateFinEffectif?: string;
    etatCoursProgramme?: string;
    lieu?: string;
    description?: string;
    classesIds: string[];
    participantsIds?: string[];
  }): Promise<CoursProgramme> => {
    try {
      const { data } = await apiClient.post<CoursProgramme>('/cours-programmes', payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la programmation du cours.'));
    }
  },

  update: async (id: string, payload: Partial<CoursProgramme>): Promise<CoursProgramme> => {
    try {
      const { data } = await apiClient.put<CoursProgramme>(`/cours-programmes/${id}`, payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la mise à jour de la programmation.'));
    }
  },

  remove: async (id: string): Promise<ApiSuccess> => {
    try {
      await apiClient.delete(`/cours-programmes/${id}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la suppression de la programmation.'));
    }
  },

  getById: async (id: string): Promise<CoursProgramme> => {
    try {
      const { data } = await apiClient.get<CoursProgramme>(`/cours-programmes/${id}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement de la programmation.'));
    }
  },

  getAll: async (): Promise<CoursProgramme[]> => {
    try {
      const { data } = await apiClient.get<CoursProgramme[]>('/cours-programmes');
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des cours programmés.'));
    }
  },

  getByCours: async (coursId: string): Promise<CoursProgramme[]> => {
    try {
      const { data } = await apiClient.get<CoursProgramme[]>('/cours-programmes/by-cours/' + coursId);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des programmations.'));
    }
  },

  getByClasse: async (classeId: string): Promise<CoursProgramme[]> => {
    try {
      const { data } = await apiClient.get<CoursProgramme[]>(`/cours-programmes/by-classe/${classeId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des programmations.'));
    }
  },

  getByProfessor: async (professorId: string): Promise<CoursProgramme[]> => {
    try {
      const { data } = await apiClient.get<CoursProgramme[]>(`/cours-programmes/by-professeur/${professorId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des programmations.'));
    }
  },

  getByParticipant: async (participantId: string): Promise<CoursProgramme[]> => {
    try {
      const { data } = await apiClient.get<CoursProgramme[]>(`/cours-programmes/by-participant/${participantId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des programmations.'));
    }
  },

  getAccessible: async (userId: string): Promise<CoursProgramme[]> => {
    try {
      const { data } = await apiClient.get<CoursProgramme[]>(`/cours-programmes/accessible/${userId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des programmations.'));
    }
  },
};
