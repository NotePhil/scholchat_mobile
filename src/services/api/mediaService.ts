import { apiClient, extractErrorMessage } from './client';
import { environment } from '../../environment/environment';
import { storageService } from '../storageService';
import { timeZoneHeaders } from '../../utils/dates';

export interface PresignedUrlResponse {
  url: string;
  fileName?: string;
  /** Storage key, e.g. `users/<me>/image/messages/<fileName>`. */
  filePath?: string;
  [key: string]: unknown;
}

export interface UploadedFileRef {
  /** Storage key to reference the file with (e.g. in a message's `medias`). */
  filePath: string;
  /** Upload URL without its query string. */
  url: string;
  /** Unique stored file name (timestamp + random prefix). */
  fileName: string;
}

/** Storage key from an upload URL when the presign response didn't carry `filePath`. */
const storageKeyFromUrl = (rawUrl: string): string => {
  const clean = rawUrl.split('?')[0];
  const m = clean.match(/^https?:\/\/[^/]+\/(.*)$/i);
  const path = decodeURIComponent(m ? m[1] : clean);
  const idx = path.indexOf('users/');
  return idx >= 0 ? path.slice(idx) : path;
};

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
/**
 * Native file upload through XMLHttpRequest. Expo's global `fetch` (expo/fetch) can't send a
 * React Native file reference ({ uri, type, name }) — neither as a body nor as a FormData part
 * ("Unsupported FormDataPart implementation") — while RN's XMLHttpRequest streams it natively.
 */
export const xhrUpload = (
  method: 'PUT' | 'POST',
  url: string,
  headers: Record<string, string>,
  body: unknown
): Promise<{ status: number; text: string }> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText ?? '' });
    xhr.onerror = () => reject(new Error('Network request failed'));
    xhr.ontimeout = () => reject(new Error('timeout'));
    xhr.send(body as XMLHttpRequestBodyInit);
  });

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
      const response = await xhrUpload('PUT', presignedUrl, { 'Content-Type': file.mimeType }, {
        uri: file.uri,
        type: file.mimeType,
        name: file.name,
      });
      if (response.status < 200 || response.status >= 300) {
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

  /**
   * Presign → PUT flow that also returns the storage key (`filePath`) and
   * reports byte progress (0..1). The stored name is made unique
   * (`<Date.now()>_<random>_<name>`) because the server de-duplicates media rows
   * by file name. Falls back to the backend proxy upload if the direct PUT fails.
   */
  uploadFileWithPath: async (
    file: UploadableFile,
    ownerId: string,
    mediaType: 'DOCUMENT' | 'IMAGE' | 'VIDEO',
    documentType: string,
    onProgress?: (fraction: number) => void
  ): Promise<UploadedFileRef> => {
    const safeName = (file.name || 'fichier').replace(/[^\w.\-]+/g, '_');
    const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${safeName}`;
    const presigned = await mediaService.getPresignedUploadUrl(uniqueName, file.mimeType, ownerId, mediaType, documentType);
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', presigned.url);
        xhr.setRequestHeader('Content-Type', file.mimeType);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && e.total > 0) onProgress?.(Math.min(1, e.loaded / e.total));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`PUT ${xhr.status}`)));
        xhr.onerror = () => reject(new Error('PUT network error'));
        xhr.send({ uri: file.uri, type: file.mimeType, name: file.name } as unknown as Blob);
      });
    } catch (directError) {
      console.warn('Direct upload failed, falling back to backend proxy:', directError);
      await mediaService.proxyUpload(file, presigned.url, file.mimeType);
    }
    onProgress?.(1);
    const url = presigned.url.split('?')[0];
    return {
      filePath: presigned.filePath || storageKeyFromUrl(presigned.url),
      url,
      fileName: presigned.fileName || uniqueName,
    };
  },

  /** FormData fallback proxy upload, matching backend POST /media/proxy-upload */
  proxyUpload: async (
    file: UploadableFile,
    presignedUrl: string,
    contentType: string,
    extraHeaders: Record<string, string> = {}
  ): Promise<PresignedUrlResponse> => {
    try {
      const token = await storageService.getUserToken();
      const formData = new FormData();
      formData.append('file', { uri: file.uri, type: file.mimeType || contentType, name: file.name } as unknown as Blob);
      formData.append('presignedUrl', presignedUrl);
      formData.append('contentType', contentType || file.mimeType);

      // No explicit Content-Type: XMLHttpRequest sets multipart/form-data with its boundary.
      const response = await xhrUpload(
        'POST',
        `${environment.baseUrl}/media/proxy-upload`,
        {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...timeZoneHeaders(),
          ...extraHeaders,
          Accept: 'application/json',
        },
        formData
      );

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Échec du téléversement: ${response.status} ${response.text}`);
      }
      return JSON.parse(response.text || '{}');
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

  /**
   * Mirrors web's minioS3.generateDownloadUrlByPath: resolves a stored file
   * path to the backend proxy URL (`/media/{id}/content`) when the media row
   * is known, otherwise to the presigned URL the backend returns. This is the
   * URL web embeds in course chapter HTML.
   */
  getContentUrlByPath: async (filePath: string): Promise<string> => {
    try {
      const { data } = await apiClient.get<{ id?: string; url?: string }>('/media/download-by-path', {
        params: { filePath },
      });
      if (data?.id) return `${environment.baseUrl}/media/${data.id}/content`;
      return data?.url ?? '';
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
