import { apiClient, extractErrorMessage } from './client';
import { ApiSuccess, StudentProfile } from '../../types';

/** profil-eleves CRUD, ported from scholchat_front's userService.js. */
export const studentService = {
  getAll: async (): Promise<StudentProfile[]> => {
    try {
      const { data } = await apiClient.get<StudentProfile[]>('/profil-eleves');
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des élèves.'));
    }
  },

  getById: async (id: string): Promise<StudentProfile> => {
    try {
      const { data } = await apiClient.get<StudentProfile>(`/profil-eleves/${id}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec du chargement de l'élève."));
    }
  },

  getByProfessor: async (professorId: string): Promise<StudentProfile[]> => {
    try {
      const { data } = await apiClient.get<StudentProfile[]>(`/profil-eleves/professeur/${professorId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des élèves.'));
    }
  },

  create: async (payload: Partial<StudentProfile>): Promise<StudentProfile> => {
    try {
      const { data } = await apiClient.post<StudentProfile>('/profil-eleves', payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de la création de l'élève."));
    }
  },

  update: async (id: string, payload: Partial<StudentProfile>): Promise<StudentProfile> => {
    try {
      const { data } = await apiClient.put<StudentProfile>(`/profil-eleves/${id}`, payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de la mise à jour de l'élève."));
    }
  },

  remove: async (id: string): Promise<ApiSuccess> => {
    try {
      await apiClient.delete(`/profil-eleves/${id}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de la suppression de l'élève."));
    }
  },
};
