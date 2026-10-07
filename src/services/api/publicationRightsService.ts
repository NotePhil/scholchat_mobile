import { apiClient, extractErrorMessage } from './client';
import { ApiSuccess, ClassEntity, ClassUser, PublicationRight } from '../../types';

/** Entry of GET /droits-publication/utilisateurs/{id}/classes-avec-droits (ClasseAvecDroitDto). */
export interface ClasseAvecDroit {
  classe: ClassEntity;
  peutPublier: boolean;
  peutModerer: boolean;
  estCreateur: boolean;
  /**
   * Strongest role of the caller on the class (deduplicated by the backend):
   * CREATEUR (creatorId, even if someone else moderates now), MODERATEUR (main or co-moderator),
   * PUBLICATION (granted right; peutModerer = delegated moderation). Absent on older backends.
   */
  role?: 'CREATEUR' | 'MODERATEUR' | 'PUBLICATION';
  /** Display name of the class creator ("Par : …"). */
  creatorNom?: string | null;
  /** Display name of the main moderator. */
  moderateurNom?: string | null;
}

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

  /**
   * Same source as web's "Mes classes" (ManageClassContent): classes the user created, moderates
   * (main or co-moderator) or holds a publication right on, each with the caller's role and
   * peutPublier / peutModerer / estCreateur flags plus the creator / moderator display names.
   */
  getClassesWithRightsDetail: async (userId: string): Promise<ClasseAvecDroit[]> => {
    try {
      const { data } = await apiClient.get<ClasseAvecDroit[]>(
        `/droits-publication/utilisateurs/${userId}/classes-avec-droits`
      );
      return Array.isArray(data) ? data : [];
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des classes.'));
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
