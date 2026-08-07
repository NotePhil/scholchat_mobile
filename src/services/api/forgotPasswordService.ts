import { apiClient, extractErrorMessage } from './client';
import { ApiSuccess } from '../../types';

export const forgotPasswordService = {
  requestPasswordReset: async (email: string): Promise<ApiSuccess> => {
    try {
      await apiClient.post('/auth/reset-password-request', undefined, { params: { email } });
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de l'envoi de l'email de réinitialisation."));
    }
  },

  resetPassword: async (token: string, newPassword: string): Promise<ApiSuccess> => {
    try {
      await apiClient.post('/auth/reset-password', { token, newPassword });
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la réinitialisation du mot de passe.'));
    }
  },
};
