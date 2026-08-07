import { apiClient, extractErrorMessage } from '../api/client';
import { storageService } from '../storageService';
import { LoginResponse } from '../../types';

export interface ProfessorSignupData {
  lastName: string;
  firstName: string;
  email: string;
  phone: string;
  address: string;
  teacherMatricule?: string;
}

export interface PresignedUrlResponse {
  url: string;
  [key: string]: unknown;
}

export interface UploadableFile {
  uri: string;
  mimeType: string;
  name: string;
}

export interface ProfessorDocumentUrls {
  cniRecto: string;
  cniVerso: string;
  selfie: string;
}

export const authService = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    try {
      const { data } = await apiClient.post<LoginResponse>('/auth/login', { email, password });
      await storageService.saveUserData(data);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Email ou mot de passe incorrect'));
    }
  },

  logout: async (): Promise<void> => {
    await storageService.clearUserData();
  },

  /** For multi-role accounts (e.g. a user who is both professeur and parent). */
  switchRole: async (role: string): Promise<LoginResponse> => {
    try {
      const { data } = await apiClient.post<LoginResponse>('/auth/switch-role', { role });
      await storageService.saveUserData(data);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du changement de rôle.'));
    }
  },

  createProfessor: async (userData: ProfessorSignupData): Promise<Record<string, unknown>> => {
    try {
      const { data } = await apiClient.post('/utilisateurs', {
        type: 'professeur',
        nom: userData.lastName,
        prenom: userData.firstName,
        email: userData.email,
        telephone: userData.phone,
        adresse: userData.address,
        matriculeProfesseur: userData.teacherMatricule || '',
      });
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'La création du compte professeur a échoué.'));
    }
  },

  getPresignedUrl: async (
    fileName: string,
    contentType: string,
    ownerId: string,
    documentType: string
  ): Promise<PresignedUrlResponse> => {
    try {
      const { data } = await apiClient.post<PresignedUrlResponse>('/media/presigned-url', {
        fileName,
        contentType,
        mediaType: 'DOCUMENT',
        ownerId,
        documentType,
      });
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de la génération de l'URL de téléversement."));
    }
  },

  // Direct PUT to a presigned MinIO URL, not our backend — kept on raw fetch
  // since it's an unauthenticated binary upload to a third-party host, not a
  // ScholChat API call that should go through apiClient's interceptors.
  uploadFile: async (presignedUrl: string, file: UploadableFile): Promise<boolean> => {
    try {
      const response = await fetch(presignedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.mimeType,
        },
        body: {
          uri: file.uri,
          type: file.mimeType,
          name: file.name,
        } as unknown as BodyInit,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`File upload failed: ${response.status} ${errorText}`);
      }

      return true;
    } catch (error) {
      console.error('File upload error:', error);
      throw error;
    }
  },

  /** POST /auth/activate?activationToken= — following the emailed activation link. */
  activateAccount: async (activationToken: string): Promise<{ email?: string; [key: string]: unknown }> => {
    try {
      const { data } = await apiClient.post('/auth/activate', undefined, { params: { activationToken } });
      return data ?? {};
    } catch (error) {
      throw new Error(extractErrorMessage(error, "L'activation a échoué. Veuillez réessayer."));
    }
  },

  /** POST /auth/registerPassword — sets the initial password right after activation. */
  registerPassword: async (email: string, password: string, activationToken: string): Promise<void> => {
    try {
      await apiClient.post(
        '/auth/registerPassword',
        { email, passeAccess: password, type: 'utilisateur' },
        { headers: { Authorization: `Bearer ${activationToken}` } }
      );
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la définition du mot de passe.'));
    }
  },

  updateProfessorUrls: async (
    professorId: string,
    urls: ProfessorDocumentUrls
  ): Promise<Record<string, unknown>> => {
    try {
      const { data } = await apiClient.patch(`/utilisateurs/${professorId}`, {
        type: 'professeur',
        cniUrlRecto: urls.cniRecto,
        cniUrlVerso: urls.cniVerso,
        selfieUrl: urls.selfie,
      });
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'La mise à jour du professeur a échoué.'));
    }
  },
};
