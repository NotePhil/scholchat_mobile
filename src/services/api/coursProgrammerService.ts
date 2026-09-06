import { apiClient, extractErrorMessage } from './client';
import { ApiSuccess, CoursProgramme } from '../../types';

/**
 * Format a date value to the exact format expected by the backend:
 * YYYY-MM-DDTHH:mm:ss (no timezone suffix). Mirrors the web's
 * CoursProgrammerService.formatDateToBackend().
 */
export const formatDateToBackend = (dateValue?: string | null): string | null => {
  if (!dateValue) return null;
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  } catch {
    return null;
  }
};

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
    capaciteMax?: number;
  }): Promise<CoursProgramme> => {
    try {
      // Normalize dates exactly like the web service's formatDateToBackend().
      const cleanedPayload = {
        ...payload,
        dateCoursPrevue: formatDateToBackend(payload.dateCoursPrevue) ?? undefined,
        dateDebutEffectif: formatDateToBackend(payload.dateDebutEffectif) ?? null,
        dateFinEffectif: formatDateToBackend(payload.dateFinEffectif) ?? null,
        classesIds: (payload.classesIds ?? []).filter(Boolean),
        participantsIds: (payload.participantsIds ?? []).filter(Boolean),
      };
      const { data } = await apiClient.post<CoursProgramme>('/cours-programmes', cleanedPayload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la programmation du cours.'));
    }
  },

  update: async (id: string, payload: Partial<CoursProgramme>): Promise<CoursProgramme> => {
    try {
      // Apply the same date normalization on update as on create.
      const cleanedPayload: Partial<CoursProgramme> = { ...payload };
      if (payload.dateCoursPrevue !== undefined) {
        (cleanedPayload as Record<string, unknown>).dateCoursPrevue = formatDateToBackend(payload.dateCoursPrevue as string);
      }
      if (payload.dateDebutEffectif !== undefined) {
        (cleanedPayload as Record<string, unknown>).dateDebutEffectif = formatDateToBackend(payload.dateDebutEffectif as string);
      }
      if (payload.dateFinEffectif !== undefined) {
        (cleanedPayload as Record<string, unknown>).dateFinEffectif = formatDateToBackend(payload.dateFinEffectif as string);
      }
      const { data } = await apiClient.put<CoursProgramme>(`/cours-programmes/${id}`, cleanedPayload);
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
