import { apiClient, extractErrorMessage } from './client';
import { ApiSuccess, ClassEntity, ClassUser, PublicationRight } from '../../types';

export const publicationRightsService = {
  assign: async (
    userId: string,
    classId: string,
    canPublish: boolean,
    canModerate: boolean
  ): Promise<PublicationRight> => {
    try {
      const { data } = await apiClient.post<PublicationRight>(
        `/droits-publication/${userId}/${classId}`,
        undefined,
        { params: { peutPublier: canPublish, peutModerer: canModerate } }
      );
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de l'attribution des droits."));
    }
  },

  get: async (classId: string, userId: string): Promise<PublicationRight> => {
    try {
      const { data } = await apiClient.get<PublicationRight>(`/droits-publication/${classId}/${userId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des droits.'));
    }
  },

  update: async (
    userId: string,
    classId: string,
    canPublish: boolean,
    canModerate: boolean
  ): Promise<PublicationRight> => {
    try {
      const { data } = await apiClient.put<PublicationRight>(
        `/droits-publication/${userId}/${classId}`,
        undefined,
        { params: { peutPublier: canPublish, peutModerer: canModerate } }
      );
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la mise à jour des droits.'));
    }
  },

  remove: async (userId: string, classId: string): Promise<ApiSuccess> => {
    try {
      await apiClient.delete(`/droits-publication/${userId}/${classId}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du retrait des droits.'));
    }
  },

  getUsersForClass: async (classId: string): Promise<ClassUser[]> => {
    try {
      const { data } = await apiClient.get<ClassUser[]>(`/droits-publication/classes/${classId}/utilisateurs`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des membres.'));
    }
  },

  getClassesForUser: async (userId: string): Promise<ClassEntity[]> => {
    try {
      const { data } = await apiClient.get<ClassEntity[]>(`/droits-publication/utilisateurs/${userId}/classes`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des classes.'));
    }
  },
};
