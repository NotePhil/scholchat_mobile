import { apiClient, extractErrorMessage } from './api/client';
import { accederService } from './api/accederService';
import { classAdminService } from './api/classAdminService';
import { AccessRequest, ApiSuccess, AppRole, ClassEntity, ClassUser, Etablissement, Professor } from '../types';

/**
 * Class management API calls. Migrated to the shared axios client
 * (services/api/client.ts) so token attachment and 401/403 handling are
 * centralized instead of repeated per-call.
 */
export const classService = {
  /**
   * Resolves the class list a user can scope a PRIVATE activity/post to,
   * branching by role exactly like web's ActivitiesContent.jsx loadClasses():
   * admin sees every class, professor/tutor see classes they hold publication
   * rights on, everyone else falls back to classes they merely have access to.
   */
  getClassesForRole: async (role: AppRole, userId: string): Promise<ClassEntity[]> => {
    let data: ClassEntity[] = [];
    if (role === 'admin') {
      data = await classAdminService.getAll();
    } else if (role === 'professor' || role === 'tutor') {
      data = await classService.getClassesWithPublicationRights(userId);
    } else {
      data = await accederService.getAccessibleClasses(userId);
    }
    return data.filter((c) => c.etat === 'ACTIF' || !c.etat);
  },

  getClasses: async (userId: string): Promise<ClassEntity[]> => {
    try {
      const { data } = await apiClient.get<ClassEntity[]>(`/classes/user/${userId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des classes.'));
    }
  },

  getClassesWithPublicationRights: async (userId: string): Promise<ClassEntity[]> => {
    try {
      const { data } = await apiClient.get<ClassEntity[]>(
        `/droits-publication/utilisateurs/${userId}/classes`
      );
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des classes.'));
    }
  },

  getClassDetails: async (classId: string): Promise<ClassEntity> => {
    try {
      const { data } = await apiClient.get<ClassEntity>(`/classes/${classId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec du chargement des détails de la classe."));
    }
  },

  getClassAccessRequests: async (classId: string): Promise<AccessRequest[]> => {
    try {
      const { data } = await apiClient.get<AccessRequest[]>(`/acceder/classes/${classId}/demandes`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec du chargement des demandes d'accès."));
    }
  },

  getClassUsers: async (classId: string): Promise<ClassUser[]> => {
    try {
      const { data } = await apiClient.get<ClassUser[]>(`/acceder/classes/${classId}/utilisateurs`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des membres de la classe.'));
    }
  },

  getEtablissements: async (): Promise<Etablissement[]> => {
    try {
      const { data } = await apiClient.get<Etablissement[]>('/etablissements');
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des établissements.'));
    }
  },

  getProfessors: async (): Promise<Professor[]> => {
    try {
      const { data } = await apiClient.get<Professor[]>('/professeurs');
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des professeurs.'));
    }
  },

  createClass: async (classData: Partial<ClassEntity>): Promise<ClassEntity> => {
    try {
      const { data } = await apiClient.post<ClassEntity>('/classes', classData);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la création de la classe.'));
    }
  },

  /**
   * POST /classes/nouvelle — the richer creation flow (ClasseCreationDto),
   * taking a flat `etablissementId` instead of a nested establishment object.
   * Matches web's CreateClassContent.jsx.
   */
  createNewClass: async (payload: {
    nom: string;
    niveau?: string;
    etablissementId?: string;
    codeUnique?: string;
    moderatorId?: string;
    creatorId: string;
    accesMajeur?: boolean;
  }): Promise<{ classe: ClassEntity; token?: string; etat?: string; paymentRequired: boolean; message?: string }> => {
    try {
      const { data } = await apiClient.post('/classes/nouvelle', payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la création de la classe.'));
    }
  },

  grantPublicationRights: async (
    userId: string,
    classId: string,
    canPublish = true,
    canModerate = true
  ): Promise<ApiSuccess | Record<string, unknown>> => {
    try {
      const { data } = await apiClient.post(
        `/droits-publication/${userId}/${classId}`,
        undefined,
        { params: { peutPublier: canPublish, peutModerer: canModerate } }
      );
      return data ?? { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de l'attribution des droits de publication."));
    }
  },

  removeUserAccess: async (userId: string, classId: string): Promise<ApiSuccess> => {
    try {
      await apiClient.delete(`/acceder/${userId}/${classId}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec du retrait de l'accès."));
    }
  },

  assignModerator: async (classId: string, moderatorId: string): Promise<ClassEntity> => {
    try {
      const { data } = await apiClient.patch<ClassEntity>(`/classes/${classId}/moderator/${moderatorId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de l'attribution du modérateur."));
    }
  },

  searchProfessors: async (searchTerm: string): Promise<Professor[]> => {
    try {
      const { data } = await apiClient.get<Professor[]>('/professeurs');
      const term = searchTerm.toLowerCase();
      return data.filter(
        (professor) =>
          professor.nom.toLowerCase().includes(term) ||
          professor.prenom.toLowerCase().includes(term) ||
          professor.email.toLowerCase().includes(term)
      );
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la recherche de professeurs.'));
    }
  },

  approveAccessRequest: async (requestId: string): Promise<ApiSuccess> => {
    try {
      await apiClient.post(`/acceder/demandes/${requestId}/approve`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de l'approbation de la demande."));
    }
  },

  rejectAccessRequest: async (requestId: string, rejectionReason: string): Promise<ApiSuccess> => {
    try {
      await apiClient.post(`/acceder/demandes/${requestId}/reject`, undefined, {
        params: { motifRejet: rejectionReason },
      });
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du rejet de la demande.'));
    }
  },

  getClassModerators: async (classId: string): Promise<ClassUser[]> => {
    try {
      const { data } = await apiClient.get<ClassUser[]>(`/classes/${classId}/moderators`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des modérateurs.'));
    }
  },
};
