import { apiClient, extractErrorMessage } from './client';
import { environment } from '../../environment/environment';
import { storageService } from '../storageService';

export interface PresignedUrlResponse {
  url: string;
  [key: string]: unknown;
}

export interface UploadableFile {
  uri: string;
  mimeType: string;
  name: string;
}

/**
 * Generic MinIO-backed media upload/download, generalized from the
 * presigned-URL flow authService.ts already used for professor CNI docs
 * (see scholchat_front's minioS3.js). Reused by activity images, message
 * attachments, and exercise question images.
 */
export const mediaService = {
  getPresignedUploadUrl: async (
    fileName: string,
    contentType: string,
    ownerId: string,
    mediaType: 'DOCUMENT' | 'IMAGE' | 'VIDEO' = 'IMAGE',
    documentType?: string
  ): Promise<PresignedUrlResponse> => {
    try {
      const { data } = await apiClient.post<PresignedUrlResponse>('/media/presigned-url', {
        fileName,
        contentType,
        mediaType,
        ownerId,
        documentType,
      });
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de la génération de l'URL de téléversement."));
    }
  },

  /** Direct PUT to the presigned MinIO URL — not our backend, so raw fetch (no auth interceptor needed). */
  putToPresignedUrl: async (presignedUrl: string, file: UploadableFile): Promise<void> => {
    const response = await fetch(presignedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.mimeType },
      body: { uri: file.uri, type: file.mimeType, name: file.name } as unknown as BodyInit,
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Échec du téléversement: ${response.status} ${errorText}`);
    }
  },

  /**
   * Full presign → upload flow. Returns the stored URL (without query params)
   * that should be sent to whichever ScholChat entity references this file.
   */
  uploadFile: async (
    file: UploadableFile,
    ownerId: string,
    mediaType: 'DOCUMENT' | 'IMAGE' | 'VIDEO' = 'IMAGE',
    documentType?: string
  ): Promise<string> => {
    const presigned = await mediaService.getPresignedUploadUrl(file.name, file.mimeType, ownerId, mediaType, documentType);
    await mediaService.putToPresignedUrl(presigned.url, file);
    return presigned.url.split('?')[0];
  },

  /** FormData fallback proxy upload, for hosts where direct-to-MinIO PUT is blocked. */
  proxyUpload: async (file: UploadableFile, ownerId: string, mediaType: string): Promise<PresignedUrlResponse> => {
    try {
      const token = await storageService.getUserToken();
      const formData = new FormData();
      formData.append('file', { uri: file.uri, type: file.mimeType, name: file.name } as unknown as Blob);
      formData.append('ownerId', ownerId);
      formData.append('mediaType', mediaType);

      const response = await fetch(`${environment.baseUrl}/media/proxy-upload`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Échec du téléversement: ${response.status} ${errorText}`);
      }
      return await response.json();
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du téléversement.'));
    }
  },

  getDownloadUrlByPath: async (filePath: string): Promise<string> => {
    try {
      const { data } = await apiClient.get<{ url?: string } | string>('/media/download-by-path', {
        params: { filePath },
      });
      return typeof data === 'string' ? data : data?.url ?? '';
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement du fichier.'));
    }
  },

  getContentUrl: (mediaId: string): string => `${environment.baseUrl}/media/${mediaId}/content`,

  getByCours: async (coursId: string): Promise<Record<string, unknown>[]> => {
    try {
      const { data } = await apiClient.get(`/media/cours/${coursId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des médias.'));
    }
  },

  find: async (fileName: string, ownerId: string): Promise<Record<string, unknown>> => {
    try {
      const { data } = await apiClient.get('/media/find', { params: { fileName, ownerId } });
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Fichier introuvable.'));
    }
  },

  getByUser: async (userId: string): Promise<Record<string, unknown>[]> => {
    try {
      const { data } = await apiClient.get(`/media/user/${userId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des médias.'));
    }
  },
};
