import { apiClient, extractErrorMessage } from './client';
import { ApiSuccess, Exercise, ExerciseProgramme, Participation, Question, Reponse } from '../../types';

/**
 * Full exercise lifecycle. Field names verified directly against the Java
 * backend's ExerciseRequestDTO/ExerciseResponseDTO (2025backendSchoolchat) —
 * the entity field is `nom` (not `titre`) and `redacteurId` (not `professeurId`).
 */
export const exerciseService = {
  create: async (payload: {
    nom: string;
    description?: string;
    niveau?: string;
    restriction?: string;
    redacteurId: string;
    etat?: string;
  }): Promise<Exercise> => {
    try {
      const { data } = await apiClient.post<Exercise>('/exercises', payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de la création de l'exercice."));
    }
  },

  getById: async (id: string): Promise<Exercise> => {
    try {
      const { data } = await apiClient.get<Exercise>(`/exercises/${id}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec du chargement de l'exercice."));
    }
  },

  getByProfessor: async (professorId: string): Promise<Exercise[]> => {
    try {
      const { data } = await apiClient.get<Exercise[]>(`/exercises/professeur/${professorId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des exercices.'));
    }
  },

  getByNiveau: async (niveau: string): Promise<Exercise[]> => {
    try {
      const { data } = await apiClient.get<Exercise[]>(`/exercises/niveau/${niveau}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des exercices.'));
    }
  },

  getAccessible: async (userId: string): Promise<Exercise[]> => {
    try {
      const { data } = await apiClient.get<Exercise[]>(`/exercises/accessibles/${userId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des exercices.'));
    }
  },

  getByCours: async (coursId: string): Promise<Exercise[]> => {
    try {
      const { data } = await apiClient.get<Exercise[]>(`/exercises/cours/${coursId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des exercices.'));
    }
  },

  update: async (
    id: string,
    payload: { nom: string; description?: string; niveau?: string; restriction?: string; redacteurId?: string; etat?: string }
  ): Promise<Exercise> => {
    try {
      const { data } = await apiClient.put<Exercise>(`/exercises/${id}`, payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de la mise à jour de l'exercice."));
    }
  },

  remove: async (id: string): Promise<ApiSuccess> => {
    try {
      await apiClient.delete(`/exercises/${id}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de la suppression de l'exercice."));
    }
  },

  linkToMatiere: async (id: string, matiereId: string): Promise<Exercise> => {
    try {
      const { data } = await apiClient.post<Exercise>(`/exercises/${id}/lier-matiere/${matiereId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la liaison à la matière.'));
    }
  },

  unlinkFromMatiere: async (id: string, matiereId: string): Promise<Exercise> => {
    try {
      const { data } = await apiClient.post<Exercise>(`/exercises/${id}/delier-matiere/${matiereId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la déliaison de la matière.'));
    }
  },

  linkToCours: async (id: string, coursId: string): Promise<Exercise> => {
    try {
      const { data } = await apiClient.post<Exercise>(`/exercises/${id}/lier-cours/${coursId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la liaison au cours.'));
    }
  },

  unlinkFromCours: async (id: string, coursId: string): Promise<Exercise> => {
    try {
      const { data } = await apiClient.post<Exercise>(`/exercises/${id}/delier-cours/${coursId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la déliaison du cours.'));
    }
  },
};

/**
 * exercises-programmer: scheduling+diffusing an exercise onto one or more
 * classes. Field names verified against ExerciseProgrammerRequestDTO —
 * `classeIds` is plural, dates are dateExoPrevue/dateDebutExoEffectif/
 * dateFinExoEffectif, and `typeAssignation` (EXERCICE|DEVOIR) controls
 * whether it auto-corrects or needs manual professor grading.
 */
export const exerciseProgrammerService = {
  programmer: async (payload: {
    exerciseId: string;
    programmeParId: string;
    typeAssignation: 'EXERCICE' | 'DEVOIR';
    dateExoPrevue?: string;
    dateDebutExoEffectif?: string;
    dateFinExoEffectif?: string;
    etat?: string;
    classeIds: string[];
    coursIds?: string[];
  }): Promise<ExerciseProgramme> => {
    try {
      const { data } = await apiClient.post<ExerciseProgramme>('/exercises-programmer', payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de la programmation de l'exercice."));
    }
  },

  programmerEtDiffuser: async (payload: {
    exerciseId: string;
    programmeParId: string;
    typeAssignation: 'EXERCICE' | 'DEVOIR';
    dateExoPrevue?: string;
    dateDebutExoEffectif?: string;
    dateFinExoEffectif?: string;
    etat?: string;
    classeIds: string[];
    coursIds?: string[];
  }): Promise<ExerciseProgramme> => {
    try {
      const { data } = await apiClient.post<ExerciseProgramme>(
        '/exercises-programmer/programmer-et-diffuser',
        payload
      );
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la programmation et diffusion.'));
    }
  },

  getById: async (id: string): Promise<ExerciseProgramme> => {
    try {
      const { data } = await apiClient.get<ExerciseProgramme>(`/exercises-programmer/${id}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement de la programmation.'));
    }
  },

  getByProfessor: async (professorId: string): Promise<ExerciseProgramme[]> => {
    try {
      const { data } = await apiClient.get<ExerciseProgramme[]>(`/exercises-programmer/professeur/${professorId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des programmations.'));
    }
  },

  getByClasse: async (classeId: string): Promise<ExerciseProgramme[]> => {
    try {
      const { data } = await apiClient.get<ExerciseProgramme[]>(`/exercises-programmer/classe/${classeId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des programmations.'));
    }
  },

  getByExercise: async (exerciseId: string): Promise<ExerciseProgramme[]> => {
    try {
      const { data } = await apiClient.get<ExerciseProgramme[]>(`/exercises-programmer/exercise/${exerciseId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des programmations.'));
    }
  },

  updateState: async (id: string, nouvelEtat: string): Promise<ExerciseProgramme> => {
    try {
      const { data } = await apiClient.patch<ExerciseProgramme>(`/exercises-programmer/${id}/etat`, undefined, {
        params: { nouvelEtat },
      });
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec du changement d'état."));
    }
  },

  remove: async (id: string): Promise<ApiSuccess> => {
    try {
      await apiClient.delete(`/exercises-programmer/${id}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la suppression de la programmation.'));
    }
  },

  diffuseToClass: async (id: string, classeId: string): Promise<ExerciseProgramme> => {
    try {
      const { data } = await apiClient.post<ExerciseProgramme>(`/exercises-programmer/${id}/diffuser-classe/${classeId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la diffusion.'));
    }
  },

  removeFromClass: async (id: string, classeId: string): Promise<ExerciseProgramme> => {
    try {
      const { data } = await apiClient.post<ExerciseProgramme>(`/exercises-programmer/${id}/retirer-classe/${classeId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du retrait.'));
    }
  },
};

/**
 * /questions — questions attached to an exercise. `intitule` is the question
 * text, `reponse` is the teacher's expected/model answer, `choixReponses` is
 * the list of MCQ choices (each with its own estCorrect flag) — verified
 * against QuestionReponseRequestDTO/ChoixReponseDTO.
 */
export const questionService = {
  create: async (
    exerciseId: string,
    payload: { intitule: string; reponse?: string; typeQuestion: string; points?: number; choixReponses?: { texte: string; estCorrect: boolean; ordreAffichage?: number }[] }
  ): Promise<Question> => {
    try {
      const { data } = await apiClient.post<Question>(`/questions/exercise/${exerciseId}`, payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la création de la question.'));
    }
  },

  getByExercise: async (exerciseId: string): Promise<Question[]> => {
    try {
      const { data } = await apiClient.get<Question[]>(`/questions/exercise/${exerciseId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des questions.'));
    }
  },

  update: async (
    id: string,
    payload: { intitule: string; reponse?: string; typeQuestion: string; points?: number; choixReponses?: { texte: string; estCorrect: boolean; ordreAffichage?: number }[] }
  ): Promise<Question> => {
    try {
      const { data } = await apiClient.put<Question>(`/questions/${id}`, payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la mise à jour de la question.'));
    }
  },

  remove: async (id: string): Promise<ApiSuccess> => {
    try {
      await apiClient.delete(`/questions/${id}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la suppression de la question.'));
    }
  },
};

/**
 * /reponses — a student's answer to one question. Verified against
 * RepondreRequestDTO/ResponseDTO: `reponseUtilisateur` (not `reponse`),
 * `estCorrecte` (not `correcte`), plus `appreciation` for professor feedback.
 */
export const reponseService = {
  submit: async (payload: {
    utilisateurId: string;
    questionId: string;
    reponseUtilisateur: string;
    note?: string;
    appreciation?: string;
    estCorrecte?: boolean;
  }): Promise<Reponse> => {
    try {
      const { data } = await apiClient.post<Reponse>('/reponses', payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de l'envoi de la réponse."));
    }
  },

  update: async (payload: {
    utilisateurId: string;
    questionId: string;
    reponseUtilisateur?: string;
    note?: string;
    appreciation?: string;
    estCorrecte?: boolean;
  }): Promise<Reponse> => {
    try {
      const { data } = await apiClient.put<Reponse>('/reponses', payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la mise à jour de la réponse.'));
    }
  },

  getByUser: async (userId: string): Promise<Reponse[]> => {
    try {
      const { data } = await apiClient.get<Reponse[]>(`/reponses/utilisateur/${userId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des réponses.'));
    }
  },

  getByQuestion: async (questionId: string): Promise<Reponse[]> => {
    try {
      const { data } = await apiClient.get<Reponse[]>(`/reponses/question/${questionId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des réponses.'));
    }
  },

  getByExercise: async (exerciseId: string): Promise<Reponse[]> => {
    try {
      const { data } = await apiClient.get<Reponse[]>(`/reponses/exercise/${exerciseId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des réponses.'));
    }
  },

  getOne: async (userId: string, questionId: string): Promise<Reponse> => {
    try {
      const { data } = await apiClient.get<Reponse>(`/reponses/utilisateur/${userId}/question/${questionId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement de la réponse.'));
    }
  },

  remove: async (userId: string, questionId: string): Promise<ApiSuccess> => {
    try {
      await apiClient.delete(`/reponses/utilisateur/${userId}/question/${questionId}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la suppression de la réponse.'));
    }
  },
};

/**
 * /participations-exercises — a student's overall attempt at a *scheduled*
 * exercise. Keyed by `exerciseProgrammerId` (NOT exerciseId) — verified
 * against ParticipationExerciseRequestDTO/ResponseDTO.
 */
export const participationService = {
  start: async (payload: {
    utilisateurId: string;
    exerciseProgrammerId: string;
    etatSoumission?: string;
    dateDebut?: string;
  }): Promise<Participation> => {
    try {
      const { data } = await apiClient.post<Participation>('/participations-exercises', payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du démarrage de la participation.'));
    }
  },

  update: async (payload: {
    utilisateurId: string;
    exerciseProgrammerId: string;
    etatSoumission?: string;
    dateDebut?: string;
    dateFin?: string;
    note?: string;
    appreciation?: string;
  }): Promise<Participation> => {
    try {
      const { data } = await apiClient.put<Participation>('/participations-exercises', payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la mise à jour de la participation.'));
    }
  },

  getByUser: async (userId: string): Promise<Participation[]> => {
    try {
      const { data } = await apiClient.get<Participation[]>(`/participations-exercises/utilisateur/${userId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des participations.'));
    }
  },

  /** exerciseProgrammerId, despite the URL saying "exercise". */
  getByExerciseProgramme: async (exerciseProgrammerId: string): Promise<Participation[]> => {
    try {
      const { data } = await apiClient.get<Participation[]>(`/participations-exercises/exercise/${exerciseProgrammerId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des participations.'));
    }
  },

  getPendingCorrection: async (exerciseProgrammerId: string): Promise<Participation[]> => {
    try {
      const { data } = await apiClient.get<Participation[]>(
        `/participations-exercises/exercise/${exerciseProgrammerId}/en-attente-correction`
      );
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des copies à corriger.'));
    }
  },

  /** Every submission across all of a professor's scheduled exercises that still needs grading. */
  getToCorrectByProfessor: async (professorId: string): Promise<Participation[]> => {
    try {
      const { data } = await apiClient.get<Participation[]>(`/participations-exercises/professeur/${professorId}/a-corriger`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des copies à corriger.'));
    }
  },

  remove: async (userId: string, exerciseProgrammerId: string): Promise<ApiSuccess> => {
    try {
      await apiClient.delete(`/participations-exercises/utilisateur/${userId}/exercise/${exerciseProgrammerId}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la suppression de la participation.'));
    }
  },
};
