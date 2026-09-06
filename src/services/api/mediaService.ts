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
    documentType?: string,
    coursId?: string
  ): Promise<PresignedUrlResponse> => {
    try {
      const payload: Record<string, unknown> = {
        fileName,
        contentType,
        mediaType,
        ownerId,
        documentType,
      };
      if (coursId) {
        payload.coursId = coursId;
      }
      const { data } = await apiClient.post<PresignedUrlResponse>('/media/presigned-url', payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de la génération de l'URL de téléversement."));
    }
  },

  /**
   * Direct PUT to the presigned MinIO URL.
   * If direct PUT fails (e.g. CORS on web or storage policy/network error),
   * automatically falls back to backend proxyUpload.
   */
  putToPresignedUrl: async (presignedUrl: string, file: UploadableFile): Promise<void> => {
    try {
      const response = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.mimeType },
        body: { uri: file.uri, type: file.mimeType, name: file.name } as unknown as BodyInit,
      });
      if (!response.ok) {
        throw new Error(`Direct PUT failed with status: ${response.status}`);
      }
    } catch (directError) {
      console.warn('Direct upload failed (likely CORS or network), falling back to backend proxy:', directError);
      await mediaService.proxyUpload(file, presignedUrl, file.mimeType);
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
    documentType?: string,
    coursId?: string
  ): Promise<string> => {
    const presigned = await mediaService.getPresignedUploadUrl(file.name, file.mimeType, ownerId, mediaType, documentType, coursId);
    await mediaService.putToPresignedUrl(presigned.url, file);
    return presigned.url.split('?')[0];
  },

  /** FormData fallback proxy upload, matching backend POST /media/proxy-upload */
  proxyUpload: async (file: UploadableFile, presignedUrl: string, contentType: string): Promise<PresignedUrlResponse> => {
    try {
      const token = await storageService.getUserToken();
      const formData = new FormData();
      formData.append('file', { uri: file.uri, type: file.mimeType || contentType, name: file.name } as unknown as Blob);
      formData.append('presignedUrl', presignedUrl);
      formData.append('contentType', contentType || file.mimeType);

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
      throw new Error(extractErrorMessage(error, 'Échec du téléversement via proxy.'));
    }
  },

  /**
   * GET /media/{mediaId}/download-url — resolves a real, loadable presigned
   * S3 URL for a stored media item. Mirrors scholchat_front's LazyMedia:
   * `filePath`/`presignedUrl` embedded on a list response are NOT reliably
   * loadable image URIs (filePath is just the raw storage key), so this
   * must be called to get something an <Image> can actually render.
   */
  getDownloadUrl: async (mediaId: string): Promise<string> => {
    try {
      const { data } = await apiClient.get<{ url?: string }>(`/media/${mediaId}/download-url`);
      return data?.url ?? '';
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement du média.'));
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
