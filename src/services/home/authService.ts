import { apiClient, extractErrorMessage } from '../api/client';
import { mediaService, xhrUpload } from '../api/mediaService';
import { storageService } from '../storageService';
import { LoginResponse } from '../../types';
import { TranslationKey, localizedServerMessage, translate } from '../../i18n';

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
  /**
   * Parent / élève only: activation code of the class to join (given by the teacher or the
   * school). The account then waits for the class teacher's approval
   * (statutInscription EN_ATTENTE_APPROBATION_CLASSE).
   */
  codeClasse?: string;
  /**
   * Parent only (at least one): each child to enrol, with the code of its class. The account is
   * created at once (login + temporary password e-mailed); each child's request then waits for its
   * class teacher's approval.
   */
  enfants?: SignupChild[];
}

export interface SignupChild {
  prenom: string;
  nom: string;
  codeClasse: string;
}

/** Child returned by a parent sign-up (request pending at first). */
export interface SignupChildResult {
  id?: string;
  prenom?: string;
  nom?: string;
  classeId?: string;
  classeNom?: string;
  statut?: string;
}

/** statutInscription of a parent sign-up: account created, children requests pending. */
export const PARENT_ACCOUNT_CREATED = 'COMPTE_PARENT_CREE';

export interface SignupResponse {
  id?: string;
  /**
   * CREATED (new account), ROLE_ADDED (role added to an existing active account),
   * ROLE_PENDING_VALIDATION (professor role requested on an existing account / unfinished request
   * resumed), ACTIVATION_REQUIRED (role added to an existing never-activated account: a new
   * activation link was e-mailed).
   */
  inscriptionStatut?: 'CREATED' | 'ROLE_ADDED' | 'ROLE_PENDING_VALIDATION' | 'ACTIVATION_REQUIRED' | string;
  /**
   * Professor sign-up only: short-lived signed token (≈2 h) that authorizes the anonymous upload of
   * THIS account's documents — sent as the X-Upload-Token header on presigned-url, proxy-upload and
   * PATCH /utilisateurs/{id}. Without it the backend refuses the unauthenticated document upload.
   */
  uploadToken?: string;
  /**
   * Parent / élève sign-up with a class code: EN_ATTENTE_APPROBATION_CLASSE — the class teacher
   * must approve; the user then receives by e-mail their login (e-mail) and a temporary password.
   */
  statutInscription?: 'EN_ATTENTE_APPROBATION_CLASSE' | string;
  /** Name of the class matching codeClasse (parent / élève sign-up). */
  classeNom?: string;
  /** Parent sign-up: the children created, each with its pending class request. */
  enfants?: SignupChildResult[];
  [key: string]: unknown;
}

/** Sign-up failure: backend `code`, and for a parent the index of the child card concerned. */
export type SignupError = Error & { code?: string; enfantIndex?: number; status?: number };

/** statutInscription of a parent / élève sign-up awaiting the class teacher's approval. */
export const CLASS_APPROVAL_PENDING = 'EN_ATTENTE_APPROBATION_CLASSE';

/** Sign-up error codes with a translated message (English UI; French keeps the server text). */
const SIGNUP_ERROR_KEYS: Record<string, TranslationKey> = {
  ROLE_INCOMPATIBLE: 'auth.signup.errors.roleIncompatible',
  CODE_CLASSE_INVALIDE: 'auth.signup.errors.classCodeInvalid',
  CODE_CLASSE_REQUIS: 'auth.signup.errors.classCodeRequired',
  CLASSE_RESERVEE_MINEURS: 'auth.signup.errors.classMinorsOnly',
  CLASSE_NON_ACTIVE: 'auth.signup.errors.classInactive',
  ENFANT_INVALIDE: 'parentChildren.errors.invalidChild',
  ENFANTS_REQUIS: 'parentChildren.errors.childrenRequired',
  ENFANT_EN_DOUBLE: 'parentChildren.errors.duplicateForm',
  ENFANTS_TROP_NOMBREUX: 'parentChildren.errors.tooManyChildren',
  INSCRIPTION_EN_ATTENTE: 'auth.signup.errors.signupPending',
  EMAIL_DEJA_UTILISE: 'auth.signup.errors.emailUsed',
  COMPTE_NON_ACTIVE: 'auth.signup.errors.emailInactive',
  COMPTE_EN_ATTENTE_VALIDATION: 'auth.signup.errors.emailAwaitingValidation',
};

/** Profile switch / add attempted from a student session (POST /auth/switch-role, POST /utilisateurs). */
export const STUDENT_SWITCH_FORBIDDEN = 'CHANGEMENT_PROFIL_INTERDIT_ELEVE';

/** Error codes of the account verification by e-mail code. */
const VERIFICATION_ERROR_KEYS: Record<string, TranslationKey> = {
  CODE_VERIFICATION_INVALIDE: 'verifyAccount.errors.invalid',
  CODE_VERIFICATION_EXPIRE: 'verifyAccount.errors.expired',
  TROP_DE_TENTATIVES: 'verifyAccount.errors.tooMany',
  COMPTE_NON_ELIGIBLE: 'verifyAccount.errors.notEligible',
};

type CodedError = Error & { code?: string; status?: number };

/** Error with the backend `code` kept and the message translated (English UI) when the code is known. */
const codedError = (error: unknown, fallback: string, keys: Record<string, TranslationKey>): CodedError => {
  const message = extractErrorMessage(error, fallback);
  const response = (error as { response?: { status?: number; data?: { code?: string } } })?.response;
  const code = typeof response?.data?.code === 'string' ? response.data.code : undefined;
  const err = new Error(localizedServerMessage(message, code ? keys[code] : undefined)) as CodedError;
  if (code) err.code = code;
  err.status = response?.status;
  return err;
};

/** Header carrying the sign-up upload token (see SignupResponse.uploadToken). */
export const uploadTokenHeaders = (uploadToken?: string): Record<string, string> =>
  uploadToken ? { 'X-Upload-Token': uploadToken } : {};

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
      throw codedError(error, translate('auth.errors.switchFailed'), { [STUDENT_SWITCH_FORBIDDEN]: 'roleStatus.switchForbiddenStudent' });
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
      throw codedError(error, translate('auth.errors.refreshFailed'), { [STUDENT_SWITCH_FORBIDDEN]: 'roleStatus.switchForbiddenStudent' });
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
    /** Student profile: activation code of the class to join (teacher approval). */
    codeClasse?: string;
  }): Promise<SignupResponse> => {
    try {
      const { data } = await apiClient.post('/utilisateurs', {
        ...payload,
        email: payload.email.trim(),
        etat: 'INACTIVE',
      });
      return data ?? {};
    } catch (error) {
      // Forbidden combination / student session / class code errors: localized when not in French.
      throw codedError(error, translate('auth.errors.addRoleFailed'), {
        ...SIGNUP_ERROR_KEYS,
        [STUDENT_SWITCH_FORBIDDEN]: 'roleStatus.switchForbiddenStudent',
      });
    }
  },

  /**
   * Public sign-up (eleve / parent / professeur) — same call and payload as web SignUp.jsx
   * (createBasicProfile): no password; the backend e-mails an activation link whose page lets the
   * user choose the password (a professor first waits for the admin validation). A parent / élève
   * sends the class code (codeClasse): the class teacher approves the request, then the backend
   * e-mails a temporary password (statutInscription EN_ATTENTE_APPROBATION_CLASSE). Like the web,
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
      if (payload.type === 'eleve' && payload.codeClasse?.trim()) body.codeClasse = payload.codeClasse.trim();
      if (payload.type === 'parent') {
        body.enfants = (payload.enfants ?? []).map((e) => ({
          prenom: e.prenom.trim(),
          nom: e.nom.trim(),
          codeClasse: e.codeClasse.trim().toUpperCase(),
        }));
      }
      const { data } = await apiClient.post<SignupResponse>('/utilisateurs', body);
      return data ?? {};
    } catch (error) {
      const message = extractErrorMessage(error, translate('auth.signup.errors.createFailed'));
      const response = (error as { response?: { status?: number; data?: { code?: string; enfantIndex?: unknown } } })?.response;
      const code = typeof response?.data?.code === 'string' ? response.data.code : undefined;
      // Known business errors (student profile exclusive, invalid class code…): localized when
      // not in French; the error keeps its `code` (and, for a child, `enfantIndex`) for the screen.
      const err = new Error(localizedServerMessage(message, code ? SIGNUP_ERROR_KEYS[code] : undefined)) as SignupError;
      if (code) err.code = code;
      const index = Number(response?.data?.enfantIndex);
      if (response?.data?.enfantIndex != null && Number.isInteger(index) && index >= 0) err.enfantIndex = index;
      err.status = response?.status;
      throw err;
    }
  },

  getPresignedUrl: async (
    fileName: string,
    contentType: string,
    ownerId: string,
    documentType: string,
    uploadToken?: string
  ): Promise<PresignedUrlResponse> => {
    try {
      const { data } = await apiClient.post<PresignedUrlResponse>(
        '/media/presigned-url',
        {
          fileName,
          contentType,
          mediaType: 'IMAGE',
          ownerId,
          documentType,
        },
        { headers: uploadTokenHeaders(uploadToken) }
      );
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, translate('auth.errors.uploadUrlFailed')));
    }
  },

  // Direct PUT to a presigned MinIO URL, with automatic fallback to backend proxy-upload
  // if direct upload fails (e.g. CORS on web, network, or storage policies).
  uploadFile: async (presignedUrl: string, file: UploadableFile, uploadToken?: string): Promise<boolean> => {
    try {
      const response = await xhrUpload('PUT', presignedUrl, { 'Content-Type': file.mimeType }, {
        uri: file.uri,
        type: file.mimeType,
        name: file.name,
      });

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Direct PUT failed with status: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.warn('Direct upload failed (likely CORS or network), falling back to backend proxy:', error);
      await mediaService.proxyUpload(file, presignedUrl, file.mimeType, uploadTokenHeaders(uploadToken));
      return true;
    }
  },

  /**
   * POST /auth/verification-compte/envoyer — e-mails a 6-digit code to verify (activate) an
   * account. Always 200 (no account enumeration); only rate limiting can fail.
   */
  sendVerificationCode: async (email: string): Promise<void> => {
    try {
      await apiClient.post('/auth/verification-compte/envoyer', { email: email.trim() });
    } catch (error) {
      throw codedError(error, translate('verifyAccount.errors.sendFailed'), VERIFICATION_ERROR_KEYS);
    }
  },

  /**
   * POST /auth/verification-compte/verifier — checks the code; returns the activation token that
   * authorizes POST /auth/registerPassword (same as the e-mailed activation link).
   */
  verifyAccountCode: async (email: string, code: string): Promise<{ activationToken: string; email: string }> => {
    try {
      const { data } = await apiClient.post('/auth/verification-compte/verifier', { email: email.trim(), code: code.trim() });
      const token = (data?.activationToken ?? data?.token ?? '') as string;
      if (!token) throw new Error(translate('verifyAccount.errors.generic'));
      return { activationToken: token, email: (data?.email as string) || email.trim() };
    } catch (error) {
      throw codedError(error, translate('verifyAccount.errors.generic'), VERIFICATION_ERROR_KEYS);
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
    matriculeProfesseur?: string,
    uploadToken?: string
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
      }, { headers: uploadTokenHeaders(uploadToken) });
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, translate('auth.errors.updateTeacherFailed')));
    }
  },
};
