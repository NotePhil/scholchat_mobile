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
  /** Multi-role accounts (AuthResponse): every ACTIVE role of the account, e.g. ["PROFESSOR","PARENT"]. */
  availableRoles?: string[];
  /** The role this session was opened with (always one of availableRoles). */
  selectedRole?: string;
  /** Requested roles not usable yet (e.g. "PROFESSOR" awaiting admin validation). */
  pendingRoles?: string[] | null;
  multiRole?: boolean;
  /**
   * Verification status of the account's professor profile (null when the account has no
   * professor profile). Anything but VALIDE means no professor rights at all (the token then
   * carries ROLE_PROFESSOR_PENDING) — DashboardShell shows the verification status screen.
   */
  professeurStatutVerification?: ProfessorVerificationStatus | null;
  /** Rejection reason, only when professeurStatutVerification is REJETE. */
  professeurMotifRejet?: string | null;
  /**
   * First login with the temporary password e-mailed after a class teacher approved a parent /
   * élève sign-up: the user must choose a new password (POST /auth/change-password) before using
   * the app. Persisted with the session (storageService user data) so a restart still forces it.
   */
  mustChangePassword?: boolean;
  /**
   * Parent session: true once at least one child's class request was approved. While false the
   * parent is in limited mode (only "Mes enfants", profile and notifications; every other call
   * answers 403 PARENT_SANS_ENFANT_VALIDE). Absent (older backend) = not limited.
   */
  parentAEnfantValide?: boolean | null;
  [key: string]: any;
}

/** Admin review of a professor's identity documents (separate from the account state `etat`). */
export type ProfessorVerificationStatus = 'DOCUMENTS_MANQUANTS' | 'EN_ATTENTE_VALIDATION' | 'VALIDE' | 'REJETE';

export interface AuthUser extends LoginResponse {
  decodedToken?: DecodedToken | null;
  userRole?: string | null;
  loginTime?: string;
}

export type NavigationRoute = 'admin' | 'professor';

/**
 * Normalized app role, derived from a raw backend role string (e.g. "ROLE_ADMIN",
 * "ADMIN") via normalizeRole() in utils/tokenUtils.ts. Drives which post-login
 * navigator mounts in navigation/RootNavigator.tsx.
 */
export type AppRole =
  | 'admin'
  | 'professor'
  | 'parent'
  | 'student'
  | 'establishment'
  | 'gestionnaire'
  | 'tutor'
  | 'unknown';

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
  localisation?: string;
  pays?: string;
  email?: string;
  telephone?: string;
  codeUnique?: string;
  optionEnvoiMailNewClasse?: boolean;
  optionTokenGeneral?: boolean;
  dateCreation?: string;
  [key: string]: any;
}

export interface AccessRequest {
  id: string;
  statut?: string;
  motifRejet?: string;
  [key: string]: any;
}

/**
 * Matches GET /acceder/classes/{id}/utilisateurs — a flat UtilisateurSimpleDto,
 * NOT the polymorphic Utilisateurs model. The discriminator field is
 * `typeUtilisateur` (uppercase values: PROFESSEUR/ELEVE/PARENT/REPETITEUR/
 * UTILISATEUR), not `type`/`admin` — those two fields don't exist on this
 * endpoint's response at all, so any code branching on them silently matches
 * nothing (or, for a `!= x` check, matches everything).
 */
export interface ClassUser {
  id: string;
  nom?: string;
  prenom?: string;
  email?: string;
  typeUtilisateur?: 'PROFESSEUR' | 'ELEVE' | 'PARENT' | 'REPETITEUR' | 'UTILISATEUR' | string;
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

export type MessageMediaType = 'IMAGE' | 'VIDEO' | 'DOCUMENT';

/** A file attached to a message (MessageDto.medias). */
export interface MessageMedia {
  id?: string;
  fileName?: string;
  filePath?: string;
  contentType?: string;
  mediaType?: MessageMediaType | string;
  fileSize?: number;
  presignedUrl?: string | null;
}

/** Item of the `medias` array sent with POST /messages and POST /messages/group. */
export interface MessageMediaPayload {
  fileName: string;
  filePath: string;
  contentType: string;
  fileSize?: number;
}

export interface MessageParty {
  id: string;
  nom?: string;
  prenom?: string;
  email?: string;
  typeUtilisateur?: string;
  [key: string]: any;
}

/** Matches the real MessageDto.java returned by /sent, /received, /trash — not a guess. */
export interface MessageItem {
  id: string;
  objet?: string;
  contenu?: string;
  dateCreation?: string;
  dateModification?: string;
  etat?: string;
  expediteur?: MessageParty;
  destinataires?: MessageParty[];
  /** Per-recipient read status (MessageStatutEntity) — NOT derived from `etat`. */
  lu?: boolean;
  favori?: boolean;
  dateLecture?: string;
  type?: MessageDirection;
  pieceJointes?: MessageAttachment[];
  classeIds?: string[];
  /** Attached files ([] when none). */
  medias?: MessageMedia[];
  /** Trash list: true when the sender deleted it for everyone. */
  supprimePourTous?: boolean;
  /** Trash list: when the caller deleted it. */
  dateSuppression?: string | null;
  [key: string]: any;
}

/** Payload pushed on /topic/messages/{userId}. */
export interface MessageRealtimeEvent {
  type: 'NEW_MESSAGE' | 'MESSAGE_DELETED' | 'MESSAGE_RESTORED' | string;
  message: MessageItem;
}

/** GET /messages/contacts item. */
export interface MessageContact {
  id: string;
  nom?: string;
  prenom?: string;
  email?: string;
  typeUtilisateur?: string;
}

/** GET /messages/contacts/classes item. */
export interface MessageContactClass {
  id: string;
  nom?: string;
  niveau?: string;
}

export interface ApiSuccess {
  success: true;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// Users (admin/parent/student/tutor/gestionnaire) — Professor already above.
// ---------------------------------------------------------------------------

export interface AdminUser {
  id: string;
  nom?: string;
  prenom?: string;
  email?: string;
  telephone?: string;
  [key: string]: any;
}

export interface ParentUser {
  id: string;
  nom?: string;
  prenom?: string;
  email?: string;
  telephone?: string;
  enfants?: StudentProfile[];
  [key: string]: any;
}

export interface StudentProfile {
  id: string;
  nom?: string;
  prenom?: string;
  email?: string;
  niveau?: string;
  parentId?: string;
  [key: string]: any;
}

export interface TutorUser {
  id: string;
  nom?: string;
  prenom?: string;
  email?: string;
  telephone?: string;
  [key: string]: any;
}

export interface Gestionnaire {
  id: string;
  nom?: string;
  prenom?: string;
  email?: string;
  telephone?: string;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// Subjects, courses, scheduling, live sessions
// ---------------------------------------------------------------------------

export interface Matiere {
  id: string;
  nom: string;
  description?: string;
  etat?: 'ACTIF' | 'INACTIF' | 'EN_ATTENTE_VALIDATION';
  dateCreation?: string;
  professeurs?: Professor[];
  classes?: ClasseInfo[];
  [key: string]: any;
}

export interface Chapitre {
  id?: string;
  titre?: string;
  contenu?: string;
  ordre?: number;
  [key: string]: any;
}

/**
 * Matches the backend's `Cours` model exactly (interfaces.modeles.Cours) —
 * the API returns this domain object directly, not a slimmer DTO.
 */
export interface Cours {
  id: string;
  titre?: string;
  description?: string;
  dateCreation?: string;
  etat?: string; // EtatCours: BROUILLON | PUBLIE | ARCHIVE | EN_ATTENTE_VALIDATION | ACTIF | INACTIF
  references?: string;
  restriction?: string; // PUBLIC | PRIVE
  chapitres?: Chapitre[];
  matieres?: Matiere[];
  redacteurId?: string;
  exercisesLies?: Exercise[];
  [key: string]: any;
}

export interface ClasseInfo {
  id: string;
  nom?: string;
  niveau?: string;
}

export interface ParticipantInfo {
  id: string;
  nom?: string;
  prenom?: string;
  email?: string;
}

/** Matches backend's `CoursProgrammer` model — field names are NOT dateDebut/dateFin/classeId. */
export interface CoursProgramme {
  id: string;
  coursId?: string;
  professeurId?: string;
  dateCoursPrevue?: string;
  dateDebutEffectif?: string;
  dateFinEffectif?: string;
  etatCoursProgramme?: string; // PLANIFIE | EN_COURS | TERMINE | ANNULE
  lieu?: string;
  description?: string;
  classesIds?: string[];
  participantsIds?: string[];
  classes?: ClasseInfo[];
  participants?: ParticipantInfo[];
  [key: string]: any;
}

/** Matches the backend's real SessionResponseDTO exactly — there is no `roomUrl`; the client builds the Jitsi URL itself from roomName/jitsiJwt/jitsiDomain. */
export interface LiveSessionInfo {
  sessionId: string;
  roomName?: string;
  jitsiJwt?: string;
  jitsiDomain?: string;
  mode?: 'VIDEO' | 'AUDIO' | 'CONTENT_ONLY' | string;
  status?: string;
  coursId?: string;
  coursTitle?: string;
  currentChapitreId?: string;
  chapitres?: { id: string; titre?: string; ordre?: number; contenu?: string; fileUrl?: string }[];
  participants?: { userId: string; userName?: string }[];
  startedAt?: string;
  endedAt?: string;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// Exercises
// ---------------------------------------------------------------------------

/** Matches ExerciseRequestDTO/ExerciseResponseDTO exactly — field is `nom`, not `titre`; `redacteurId`, not `professeurId`. */
export interface Exercise {
  id: string;
  nom?: string;
  description?: string;
  dateCreation?: string;
  etat?: string; // EtatExercise: BROUILLON | PUBLIE | EN_ATTENTE_CORRECTION | CORRIGE | ANNULE | VALIDE | ACTIF | INACTIF
  restriction?: string;
  niveau?: string; // ListeNiveau: MATERNELLE | PRIMAIRE | COLLEGE | LYCEE | UNIVERSITE | AUTRE
  redacteurId?: string;
  coursLies?: Cours[];
  matieres?: Matiere[];
  questions?: Question[];
  [key: string]: any;
}

/**
 * Matches ExerciseProgrammerRequestDTO/ResponseDTO — this is the "schedule an
 * exercise onto one or more classes" record. classesIds is plural (an
 * exercise can be diffused to several classes at once), and the date fields
 * are dateExoPrevue/dateDebutExoEffectif/dateFinExoEffectif, not dateDebut/dateFin.
 */
export interface ExerciseProgramme {
  id: string;
  nom?: string;
  description?: string;
  dateCreation?: string;
  etat?: string;
  restriction?: string;
  niveau?: string;
  redacteurId?: string;
  exerciseId?: string;
  programmeParId?: string;
  programmeParNom?: string;
  programmeParPrenom?: string;
  typeAssignation?: 'EXERCICE' | 'DEVOIR'; // EXERCICE = auto-corrected; DEVOIR = manual correction
  dateExoPrevue?: string;
  dateDebutExoEffectif?: string;
  dateFinExoEffectif?: string;
  classeIds?: string[];
  coursIds?: string[];
  /** Course the programmed exercise belongs to (required; null only on legacy rows, which clients ignore). */
  coursId?: string | null;
  coursTitre?: string | null;
  /** POST programming responses only: all programmations created (several when courses differ per class). */
  programmations?: ExerciseProgramme[];
  nombreProgrammations?: number;
  coursLies?: Cours[];
  matieres?: Matiere[];
  questions?: Question[];
  classesDiffusees?: ClasseInfo[];
  participations?: Participation[];
  [key: string]: any;
}

export interface ChoixReponse {
  id?: string;
  texte: string;
  estCorrect: boolean;
  ordreAffichage?: number;
}

/** Matches QuestionReponseRequestDTO/ResponseDTO — `intitule` is the question text, `reponse` is the teacher's expected answer. */
export interface Question {
  id: string;
  intitule?: string;
  reponse?: string;
  typeQuestion?: string; // QCM | VRAI_FAUX | REPONSE_COURTE | REPONSE_LONGUE | ASSOCIATION | CLASSEMENT | TROU | DEVELOPPEMENT
  exerciseId?: string;
  points?: number;
  choixReponses?: ChoixReponse[];
  [key: string]: any;
}

/** Matches RepondreRequestDTO/ResponseDTO exactly — a student's answer to one question. */
export interface Reponse {
  utilisateurId?: string;
  questionId?: string;
  note?: string;
  appreciation?: string;
  reponseUtilisateur?: string;
  dateReponse?: string;
  estCorrecte?: boolean;
  utilisateurNom?: string;
  utilisateurPrenom?: string;
  questionIntitule?: string;
  exerciseNom?: string;
  [key: string]: any;
}

/** Matches ParticipationExerciseRequestDTO/ResponseDTO — keyed by exerciseProgrammerId, NOT exerciseId. */
export interface Participation {
  utilisateurId?: string;
  utilisateurNom?: string;
  utilisateurPrenom?: string;
  exerciseProgrammerId?: string;
  exerciseProgrammerNom?: string;
  etatSoumission?: string; // EN_COURS | SOUMIS | EN_ATTENTE_CORRECTION | CORRIGE
  note?: string;
  appreciation?: string;
  dateDebut?: string;
  dateFin?: string;
  dateSoumission?: string;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// Establishments, offers, contracts
// ---------------------------------------------------------------------------

export interface Offre {
  id: string;
  nom?: string;
  cible?: 'CLASSE' | 'ETABLISSEMENT' | string;
  prixMensuel?: number;
  prixAnnuel?: number;
  actif?: boolean;
  [key: string]: any;
}

export interface Contrat {
  id?: string;
  classeId?: string;
  etablissementId?: string;
  offreId?: string;
  offreNom?: string;
  statut?: 'ACTIF' | 'EXPIRE' | 'EN_ATTENTE_PAIEMENT' | 'RESILIE' | string;
  periodicite?: 'MENSUEL' | 'ANNUEL' | string;
  prixPaye?: number;
  prixMensuel?: number;
  prixAnnuel?: number;
  dateDebut?: string;
  dateFin?: string;
  classesMax?: number;
  classesUtilisees?: number;
  elevesMax?: number;
  stockageMax?: number;
  messagerie?: boolean;
  suppressionImminente?: boolean;
  dateSuppressionPrevue?: string;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// Notifications, rejection reasons, publication rights, activity feed
// ---------------------------------------------------------------------------

export interface RejectionMotif {
  id: string;
  code?: string;
  descriptif?: string;
  dateCreation?: string;
  [key: string]: any;
}

export interface PublicationRight {
  utilisateurId?: string;
  classeId?: string;
  peutPublier?: boolean;
  peutModerer?: boolean;
  [key: string]: any;
}

/** Matches backend's `Media` model — display via presignedUrl (falls back to mediaService.getContentUrl(id)). */
export interface ActivityMedia {
  id?: string;
  fileName?: string;
  filePath?: string;
  fileType?: string;
  mediaType?: string;
  contentType?: string;
  presignedUrl?: string;
  [key: string]: any;
}

/**
 * Matches backend's `Interaction` model — likes AND comments are both
 * Interaction records on an Evenement, distinguished by `type`
 * (COMMENT | LIKE | JOIN | UNJOIN | LEAVE), not separate arrays.
 */
export interface Interaction {
  id?: string;
  type?: 'COMMENT' | 'LIKE' | 'JOIN' | 'UNJOIN' | 'LEAVE';
  content?: string;
  creationDate?: string;
  niveau?: string;
  createdById?: string;
  eventId?: string;
  messageId?: string;
  [key: string]: any;
}

/** Matches backend's `Evenement` model exactly — `description` not `contenu`, `createurId` not `auteurId`. */
export interface ActivityEvent {
  id: string;
  titre?: string;
  description?: string;
  lieu?: string;
  etat?: string; // EtatEvenement: PLANIFIE | A_VENIR | EN_COURS | ANNULE | PASSE | EN_ATTENTE_CONFIRMATION | COMPLET
  heureDebut?: string;
  heureFin?: string;
  createurId?: string;
  createurNom?: string;
  createurPrenom?: string;
  createurRole?: string;
  participantsIds?: string[];
  medias?: ActivityMedia[];
  interactions?: Interaction[];
  visibility?: 'PUBLIC' | 'PRIVATE';
  classesIds?: string[];
  [key: string]: any;
}
