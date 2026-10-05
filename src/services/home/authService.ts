import { apiClient, extractErrorMessage } from '../api/client';
import { mediaService } from '../api/mediaService';
import { storageService } from '../storageService';
import { LoginResponse } from '../../types';
import { localizedServerMessage, translate } from '../../i18n';

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

export type SignupRole = 'eleve' | 'parent' | 'professeur';

/** POST /utilisateurs body of the public sign-up — same fields as web SignUp.jsx's createBasicProfile. */
export interface SignupPayload {
  type: SignupRole;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  adresse: string;
  /** Élève only, optional (one of NIVEAUX). */
  niveau?: string;
}

export interface SignupResponse {
  id?: string;
  /**
   * CREATED (new account), ROLE_ADDED (role added to an existing active account),
   * ROLE_PENDING_VALIDATION (professor role requested on an existing account / unfinished request
   * resumed), ACTIVATION_REQUIRED (role added to an existing never-activated account: a new
   * activation link was e-mailed).
   */
  inscriptionStatut?: 'CREATED' | 'ROLE_ADDED' | 'ROLE_PENDING_VALIDATION' | 'ACTIVATION_REQUIRED' | string;
  [key: string]: unknown;
}

export const authService = {
  /**
   * POST /auth/login. `selectedRole` (multi-role accounts) opens the session as that role —
   * same as web Login.jsx's handleRoleSelected, which re-logs in with the chosen role.
   */
  login: async (email: string, password: string, selectedRole?: string): Promise<LoginResponse> => {
    try {
      const { data } = await apiClient.post<LoginResponse>('/auth/login', {
        email,
        password,
        ...(selectedRole ? { selectedRole } : {}),
      });
      await storageService.saveUserData(data);
      return data;
    } catch (error) {
      // Keep the backend's error `code` (ABONNEMENT_EXPIRE, INVALID_STATE, INACTIVE_USER…) next to
      // the message so the login screen can react to it (web Login.jsx reads errorData.code too).
      const err = new Error(extractErrorMessage(error, translate('auth.login.errors.invalidCredentials'))) as Error & { code?: string };
      const body = (error as { response?: { data?: unknown } })?.response?.data;
      if (body && typeof body === 'object' && typeof (body as { code?: unknown }).code === 'string') {
        err.code = (body as { code: string }).code;
      }
      throw err;
    }
  },

  logout: async (): Promise<void> => {
    await storageService.clearUserData();
  },

  /**
   * Switches a multi-role account (e.g. professeur + parent) to another of its roles.
   * Like web (Principal.jsx → ReAuthModal → /auth/switch-role), the password is asked
   * again; the response is a full login response (new JWT, selectedRole, children…).
   */
  switchRole: async (email: string, password: string, role: string): Promise<LoginResponse> => {
    try {
      const { data } = await apiClient.post<LoginResponse>('/auth/switch-role', {
        email,
        password,
        selectedRole: role,
      });
      await storageService.saveUserData(data);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, translate('auth.errors.switchFailed')));
    }
  },

  /**
   * Re-issues the session for the CURRENT user without the password (the access token
   * authenticates the call) — used after adding a role so availableRoles/pendingRoles
   * and the JWT's roles are refreshed in place, keeping the current role.
   */
  refreshSession: async (role: string): Promise<LoginResponse> => {
    try {
      const { data } = await apiClient.post<LoginResponse>('/auth/switch-role', { selectedRole: role });
      await storageService.saveUserData(data);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, translate('auth.errors.refreshFailed')));
    }
  },

  /**
   * Adds a role to an EXISTING account — POST /utilisateurs with the account's email, the
   * same call web's SignUp.jsx makes. The response's `inscriptionStatut` says what happened:
   * ROLE_ADDED (usable now), ROLE_PENDING_VALIDATION (professor: documents + admin
   * validation), ACTIVATION_REQUIRED (account must be activated by email), CREATED (new account).
   */
  addRole: async (payload: {
    type: 'eleve' | 'parent' | 'professeur';
    nom: string;
    prenom: string;
    email: string;
    telephone?: string;
    adresse?: string;
    niveau?: string;
    matriculeProfesseur?: string;
  }): Promise<{ id?: string; inscriptionStatut?: string; [key: string]: unknown }> => {
    try {
      const { data } = await apiClient.post('/utilisateurs', {
        ...payload,
        email: payload.email.trim(),
        etat: 'INACTIVE',
      });
      return data ?? {};
    } catch (error) {
      const message = extractErrorMessage(error, translate('auth.errors.addRoleFailed'));
      const code = (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
      // Forbidden combination (student profile is exclusive): localized when not in French.
      throw new Error(localizedServerMessage(message, code === 'ROLE_INCOMPATIBLE' ? 'auth.signup.errors.roleIncompatible' : undefined));
    }
  },

  /**
   * Public sign-up (eleve / parent / professeur) — same call and payload as web SignUp.jsx
   * (createBasicProfile): no password; the backend e-mails an activation link whose page lets the
   * user choose the password (a professor first waits for the admin validation). Like the web,
   * the e-mail is only trimmed.
   */
  signUp: async (payload: SignupPayload): Promise<SignupResponse> => {
    try {
      const body: Record<string, unknown> = {
        type: payload.type,
        nom: payload.nom.trim(),
        prenom: payload.prenom.trim(),
        email: payload.email.trim(),
        telephone: payload.telephone,
        adresse: payload.adresse.trim(),
        etat: 'INACTIVE',
      };
      if (payload.type === 'eleve') body.niveau = payload.niveau ?? '';
      const { data } = await apiClient.post<SignupResponse>('/utilisateurs', body);
      return data ?? {};
    } catch (error) {
      const message = extractErrorMessage(error, translate('auth.signup.errors.createFailed'));
      const code = (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
      // Forbidden combination (student profile is exclusive): localized when not in French.
      throw new Error(localizedServerMessage(message, code === 'ROLE_INCOMPATIBLE' ? 'auth.signup.errors.roleIncompatible' : undefined));
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
        mediaType: 'IMAGE',
        ownerId,
        documentType,
      });
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, translate('auth.errors.uploadUrlFailed')));
    }
  },

  // Direct PUT to a presigned MinIO URL, with automatic fallback to backend proxy-upload
  // if direct upload fails (e.g. CORS on web, network, or storage policies).
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
        throw new Error(`Direct PUT failed with status: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.warn('Direct upload failed (likely CORS or network), falling back to backend proxy:', error);
      await mediaService.proxyUpload(file, presignedUrl, file.mimeType);
      return true;
    }
  },

  /** POST /auth/activate?activationToken= — following the emailed activation link. */
  activateAccount: async (activationToken: string): Promise<{ email?: string; [key: string]: unknown }> => {
    try {
      const { data } = await apiClient.post('/auth/activate', undefined, { params: { activationToken } });
      return data ?? {};
    } catch (error) {
      throw new Error(extractErrorMessage(error, translate('auth.activation.failed')));
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
      throw new Error(extractErrorMessage(error, translate('auth.setPassword.failed')));
    }
  },

  /** POST /auth/change-password — resolves the target user from the JWT, so no id needed. */
  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    try {
      await apiClient.post('/auth/change-password', { currentPassword, newPassword });
    } catch (error) {
      throw new Error(extractErrorMessage(error, translate('auth.errors.changePasswordFailed')));
    }
  },

  updateProfessorUrls: async (
    professorId: string,
    urls: ProfessorDocumentUrls,
    matriculeProfesseur?: string
  ): Promise<Record<string, unknown>> => {
    try {
      const hasUploaded = !!(urls.cniRecto && urls.cniVerso && urls.selfie);
      const { data } = await apiClient.patch(`/utilisateurs/${professorId}`, {
        type: 'professeur',
        cniUrlRecto: urls.cniRecto || undefined,
        cniUrlVerso: urls.cniVerso || undefined,
        selfieUrl: urls.selfie || undefined,
        ...(matriculeProfesseur?.trim() ? { matriculeProfesseur: matriculeProfesseur.trim() } : {}),
        hasUploaded,
      });
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, translate('auth.errors.updateTeacherFailed')));
    }
  },
};
