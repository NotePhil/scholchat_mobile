import { useCallback, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { mediaService, userService } from '../services/api';
import { extractErrorMessage } from '../services/api/client';
import { translate } from '../i18n';

export type ProfessorDocKey = 'cniRecto' | 'cniVerso' | 'selfie';

/** The professor's identity documents: profile field, media documentType (backend whitelist) and icon. */
export const PROFESSOR_DOCS: {
  key: ProfessorDocKey;
  field: 'cniUrlRecto' | 'cniUrlVerso' | 'selfieUrl';
  docType: 'cni-recto' | 'cni-verso' | 'selfie';
  icon: string;
}[] = [
  { key: 'cniRecto', field: 'cniUrlRecto', docType: 'cni-recto', icon: 'id-card' },
  { key: 'cniVerso', field: 'cniUrlVerso', docType: 'cni-verso', icon: 'id-card' },
  { key: 'selfie', field: 'selfieUrl', docType: 'selfie', icon: 'user-circle' },
];

export interface PickedDocument {
  uri: string;
  name: string;
  mimeType: string;
}

/**
 * Picks and uploads a professor's identity documents (CNI recto / verso + selfie, optional
 * matricule) — the same flow as the sign-up documents step: each picked image goes through
 * the presigned upload (documentType cni-recto / cni-verso / selfie), then ONE
 * PATCH /utilisateurs/{id} stores the URLs. Once the three documents are on file the server
 * puts the profile under admin review (EN_ATTENTE_VALIDATION) and notifies the admins.
 */
export const useProfessorDocumentsUpload = (userId?: string | null) => {
  const [files, setFiles] = useState<Partial<Record<ProfessorDocKey, PickedDocument>>>({});
  const [matricule, setMatricule] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const pick = useCallback(async (key: ProfessorDocKey) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/*'], copyToCacheDirectory: true });
      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        setFiles((prev) => ({
          ...prev,
          [key]: { uri: asset.uri, name: asset.name || `${key}.jpg`, mimeType: asset.mimeType || 'image/jpeg' },
        }));
        setError('');
      }
    } catch {
      setError(translate('profVerification.docs.pickFailed'));
    }
  }, []);

  const remove = useCallback((key: ProfessorDocKey) => {
    setFiles((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setFiles({});
    setMatricule('');
    setError('');
  }, []);

  /** Uploads the picked documents then PATCHes the profile. Resolves true on success. */
  const submit = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    const selected = PROFESSOR_DOCS.filter((d) => files[d.key]);
    if (selected.length === 0) {
      setError(translate('profVerification.docs.pickAtLeastOne'));
      return false;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload: Record<string, string> = {};
      for (const doc of selected) {
        const file = files[doc.key] as PickedDocument;
        const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
        payload[doc.field] = await mediaService.uploadFile(
          { uri: file.uri, mimeType: file.mimeType, name: `${userId}_${doc.docType}_${Date.now()}.${ext}` },
          userId,
          'IMAGE',
          doc.docType
        );
      }
      await userService.updateUser(userId, {
        type: 'professeur',
        ...payload,
        ...(matricule.trim() ? { matriculeProfesseur: matricule.trim() } : {}),
      });
      setFiles({});
      return true;
    } catch (err) {
      setError(extractErrorMessage(err, translate('profVerification.docs.uploadFailed')));
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [files, matricule, userId]);

  return { files, pick, remove, reset, matricule, setMatricule, submitting, error, submit };
};
