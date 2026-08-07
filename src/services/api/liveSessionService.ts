import { apiClient, extractErrorMessage } from './client';
import { ApiSuccess, LiveSessionInfo } from '../../types';

/** Live-session (Jitsi) endpoints, ported from scholchat_front's LiveSessionService.js. Used by Phase 8. */
export const liveSessionService = {
  startSession: async (coursId: string): Promise<LiveSessionInfo> => {
    try {
      const { data } = await apiClient.post<LiveSessionInfo>(`/cours/${coursId}/session/start`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du démarrage de la session.'));
    }
  },

  getActiveSession: async (coursId: string): Promise<LiveSessionInfo | null> => {
    try {
      const { data } = await apiClient.get<LiveSessionInfo>(`/cours/${coursId}/session/active`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Aucune session active.'));
    }
  },

  joinSession: async (coursId: string, sessionId: string): Promise<LiveSessionInfo> => {
    try {
      const { data } = await apiClient.post<LiveSessionInfo>(`/cours/${coursId}/session/${sessionId}/join`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de la connexion à la session."));
    }
  },

  leaveSession: async (coursId: string, sessionId: string): Promise<ApiSuccess> => {
    try {
      await apiClient.post(`/cours/${coursId}/session/${sessionId}/leave`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la sortie de la session.'));
    }
  },

  endSession: async (coursId: string, sessionId: string): Promise<ApiSuccess> => {
    try {
      await apiClient.post(`/cours/${coursId}/session/${sessionId}/end`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la fin de la session.'));
    }
  },

  changeChapter: async (coursId: string, sessionId: string, chapitreId: string): Promise<ApiSuccess> => {
    try {
      await apiClient.post(`/cours/${coursId}/session/${sessionId}/chapter`, { chapitreId });
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du changement de chapitre.'));
    }
  },

  saveProgress: async (coursId: string, payload: Record<string, unknown>): Promise<ApiSuccess> => {
    try {
      await apiClient.post(`/cours/${coursId}/progress`, payload);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de l'enregistrement de la progression."));
    }
  },

  getProgress: async (coursId: string): Promise<Record<string, unknown>> => {
    try {
      const { data } = await apiClient.get(`/cours/${coursId}/progress`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement de la progression.'));
    }
  },

  getSessionHistory: async (coursId: string): Promise<LiveSessionInfo[]> => {
    try {
      const { data } = await apiClient.get<LiveSessionInfo[]>(`/cours/${coursId}/sessions`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec du chargement de l'historique des sessions."));
    }
  },
};
