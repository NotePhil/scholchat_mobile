import axios from 'axios';
import { apiClient, extractErrorMessage } from './client';

/** "No contract yet" is a normal state: backend answers 404 or code CONTRAT_INTROUVABLE ("Aucun contrat pour cette classe"). */
const isNoContract = (error: unknown) =>
  axios.isAxiosError(error) &&
  (error.response?.status === 404 || (error.response?.data as any)?.code === 'CONTRAT_INTROUVABLE');
import { Contrat } from '../../types';

/**
 * /contrats — verified against ContratApi.java + ContratActionDto: every
 * "prolonger"/"changer-offre"/"assigner" endpoint takes the SAME action body
 * `{ nouvelleOffreId, periodicite, paymentInfo }` (nouvelleOffreId stays
 * undefined for a plain renewal of the current offer), not a bare offreId.
 */
export interface PaymentInfo {
  paymentMethod?: 'CARD' | 'OM' | 'MOMO' | string;
  cardNumber?: string;
  expiryDate?: string;
  cvv?: string;
  cardHolderName?: string;
  phoneNumber?: string;
  amount?: number;
}

export interface ContratAction {
  nouvelleOffreId?: string;
  periodicite?: 'MENSUEL' | 'ANNUEL';
  paymentInfo?: PaymentInfo;
}

export const contratService = {
  /** Resolves to null when the class has no contract yet. */
  getForClass: async (classeId: string): Promise<Contrat | null> => {
    try {
      const { data } = await apiClient.get<Contrat>(`/contrats/classe/${classeId}`);
      return data;
    } catch (error) {
      if (isNoContract(error)) return null;
      throw new Error(extractErrorMessage(error, 'Échec du chargement du contrat.'));
    }
  },

  /** Resolves to null when the establishment has no contract yet. */
  getForEstablishment: async (establishmentId: string): Promise<Contrat | null> => {
    try {
      const { data } = await apiClient.get<Contrat>(`/contrats/etablissement/${establishmentId}`);
      return data;
    } catch (error) {
      if (isNoContract(error)) return null;
      throw new Error(extractErrorMessage(error, 'Échec du chargement du contrat.'));
    }
  },

  extendClassContract: async (classeId: string, action: ContratAction): Promise<Contrat> => {
    try {
      const { data } = await apiClient.post<Contrat>(`/contrats/classe/${classeId}/prolonger`, action);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la prolongation du contrat.'));
    }
  },

  changeClassOffer: async (classeId: string, nouvelleOffreId: string, action?: Omit<ContratAction, 'nouvelleOffreId'>): Promise<Contrat> => {
    try {
      const { data } = await apiClient.post<Contrat>(`/contrats/classe/${classeId}/changer-offre`, {
        ...action,
        nouvelleOffreId,
      });
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec du changement d'offre."));
    }
  },

  extendEstablishmentContract: async (establishmentId: string, action: ContratAction): Promise<Contrat> => {
    try {
      const { data } = await apiClient.post<Contrat>(`/contrats/etablissement/${establishmentId}/prolonger`, action);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la prolongation du contrat.'));
    }
  },

  changeEstablishmentOffer: async (
    establishmentId: string,
    nouvelleOffreId: string,
    action?: Omit<ContratAction, 'nouvelleOffreId'>
  ): Promise<Contrat> => {
    try {
      const { data } = await apiClient.post<Contrat>(`/contrats/etablissement/${establishmentId}/changer-offre`, {
        ...action,
        nouvelleOffreId,
      });
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec du changement d'offre."));
    }
  },

  requestRenewalLink: async (payload: { email: string; classeId?: string; etablissementId?: string }): Promise<ApiSuccessLike> => {
    try {
      await apiClient.post('/contrats/renouvellement-info', payload);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la demande de renouvellement.'));
    }
  },

  getRenewalStatus: async (
    token: string
  ): Promise<{ classeId?: string; etablissementId?: string; nom?: string; contratCourant?: Contrat; offresDisponibles?: unknown[] }> => {
    try {
      const { data } = await apiClient.get(`/contrats/renouvellement/${token}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Lien de renouvellement invalide ou expiré.'));
    }
  },

  extendByToken: async (token: string, action: ContratAction): Promise<Contrat> => {
    try {
      const { data } = await apiClient.post<Contrat>(`/contrats/renouvellement/${token}/prolonger`, action);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la prolongation du contrat.'));
    }
  },

  changeOfferByToken: async (token: string, nouvelleOffreId: string, action?: Omit<ContratAction, 'nouvelleOffreId'>): Promise<Contrat> => {
    try {
      const { data } = await apiClient.post<Contrat>(`/contrats/renouvellement/${token}/changer-offre`, {
        ...action,
        nouvelleOffreId,
      });
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec du changement d'offre."));
    }
  },

  assignClassOfferAsAdmin: async (classeId: string, nouvelleOffreId: string): Promise<Contrat> => {
    try {
      const { data } = await apiClient.post<Contrat>(`/contrats/admin/classe/${classeId}/assigner`, { nouvelleOffreId });
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de l'assignation de l'offre."));
    }
  },

  assignEstablishmentOfferAsAdmin: async (establishmentId: string, nouvelleOffreId: string): Promise<Contrat> => {
    try {
      const { data } = await apiClient.post<Contrat>(`/contrats/admin/etablissement/${establishmentId}/assigner`, {
        nouvelleOffreId,
      });
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de l'assignation de l'offre."));
    }
  },
};

interface ApiSuccessLike {
  success: boolean;
}
