export interface DecodedToken {
  sub?: string;
  roles?: string[];
  exp?: number;
  iat?: number;
  [key: string]: any;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken?: string;
  id?: string;
  userId?: string;
  username?: string;
  nom?: string;
  prenom?: string;
  email?: string;
  telephone?: string;
  role?: string;
  [key: string]: any;
}

export interface AuthUser extends LoginResponse {
  decodedToken?: DecodedToken | null;
  userRole?: string | null;
  loginTime?: string;
}

export type NavigationRoute = 'admin' | 'professor';

export interface ClassEntity {
  id: string;
  nom?: string;
  niveau?: string;
  matiere?: string;
  description?: string;
  moderatorId?: string;
  etablissement?: Etablissement;
  [key: string]: any;
}

export interface Professor {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  matriculeProfesseur?: string;
  [key: string]: any;
}

export interface Etablissement {
  id: string;
  nom?: string;
  adresse?: string;
  localisation?: string;
  [key: string]: any;
}

export interface AccessRequest {
  id: string;
  statut?: string;
  motifRejet?: string;
  [key: string]: any;
}

export interface ClassUser {
  id: string;
  nom?: string;
  prenom?: string;
  email?: string;
  role?: string;
  peutPublier?: boolean;
  peutModerer?: boolean;
  [key: string]: any;
}

export type MessageDirection = 'sent' | 'received';

export interface MessageAttachment {
  id?: string;
  name?: string;
  uri?: string;
  mimeType?: string;
  [key: string]: any;
}

export interface MessageItem {
  id: string;
  objet?: string;
  contenu?: string;
  dateCreation?: string;
  expediteurId?: string;
  destinataireId?: string;
  type?: MessageDirection;
  pieceJointes?: MessageAttachment[];
  [key: string]: any;
}

export interface ApiSuccess {
  success: true;
  [key: string]: any;
}
