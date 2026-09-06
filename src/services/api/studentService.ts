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
    // POST /profil-eleves never assigns an id before save and throws
    // "Identifier ... must be manually assigned". /utilisateurs with type: 'eleve'
    // routes through UtilisateursBusiness.posterUtilisateur instead, which
    // handles ID generation and role assignment correctly, matching web.
    const body = {
      type: 'eleve',
      nom: payload.nom?.trim(),
      prenom: payload.prenom?.trim(),
      email: payload.email?.trim().toLowerCase() || '',
      telephone: payload.telephone?.trim() || '',
      adresse: payload.adresse?.trim() || '',
      etat: payload.etat || 'ACTIVE',
      niveau: payload.niveau?.trim() || '',
      classes: payload.classes || [],
    };
    try {
      const { data } = await apiClient.post<StudentProfile>('/utilisateurs', body);
      return data;
    } catch {
      // Fallback: if /utilisateurs route is unavailable, attempt /profil-eleves with an explicit generated UUID
      try {
        const genId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });
        const fallbackBody = { id: genId, ...body };
        const { data } = await apiClient.post<StudentProfile>('/profil-eleves', fallbackBody);
        return data;
      } catch (fallbackError) {
        throw new Error(extractErrorMessage(fallbackError, "Échec de la création de l'élève."));
      }
    }
  },

  update: async (id: string, payload: Partial<StudentProfile>): Promise<StudentProfile> => {
    const body = {
      type: 'eleve',
      ...payload,
      email: payload.email ? payload.email.trim().toLowerCase() : undefined,
    };
    try {
      const { data } = await apiClient.put<StudentProfile>(`/profil-eleves/${id}`, body);
      return data;
    } catch {
      try {
        const { data } = await apiClient.patch<StudentProfile>(`/utilisateurs/${id}`, body);
        return data;
      } catch (patchErr) {
        throw new Error(extractErrorMessage(patchErr, "Échec de la mise à jour de l'élève."));
      }
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
