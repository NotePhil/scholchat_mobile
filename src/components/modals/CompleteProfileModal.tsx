import React, { useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { FontAwesome5 } from '@expo/vector-icons';
import BottomSheet from '../ui/BottomSheet';
import Button from '../ui/Button';
import { colors, radius, spacing, typography } from '../../styles/theme';
import { mediaService, userService } from '../../services/api';

export interface MissingDoc {
  field: string;
  docType: string;
  label: string;
}

interface CompleteProfileModalProps {
  visible: boolean;
  userId: string;
  missingDocs: MissingDoc[];
  onClose: () => void;
  onCompleted: () => void;
}

interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
}

/**
 * Shown after login when a validated professor's account is missing one or
 * more of the identity documents normally collected at signup (e.g. an
 * upload failed partway through registration). Mirrors web's CompleteProfileModal.jsx.
 */
const CompleteProfileModal: React.FC<CompleteProfileModalProps> = ({
  visible,
  userId,
  missingDocs,
  onClose,
  onCompleted,
}) => {
  const [pickedFiles, setPickedFiles] = useState<Record<string, PickedFile>>({});
  const [submitting, setSubmitting] = useState(false);

  const handlePickFile = async (field: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        setPickedFiles((prev) => ({
          ...prev,
          [field]: {
            uri: asset.uri,
            name: asset.name,
            mimeType: asset.mimeType || 'image/jpeg',
          },
        }));
      }
    } catch (err) {
      console.warn('Document picking failed:', err);
    }
  };

  const handleSave = async () => {
    const selectedFields = missingDocs.filter((doc) => pickedFiles[doc.field]);
    if (selectedFields.length === 0) {
      Alert.alert('Attention', 'Veuillez sélectionner au moins un document.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, string> = {};

      for (const doc of selectedFields) {
        const file = pickedFiles[doc.field];
        const uploadedUrl = await mediaService.uploadFile(
          {
            uri: file.uri,
            name: `${userId}_${doc.docType}_${Date.now()}.${file.name.split('.').pop() || 'jpg'}`,
            mimeType: file.mimeType,
          },
          userId,
          'IMAGE',
          doc.docType
        );
        payload[doc.field] = uploadedUrl;
      }

      await userService.updateUser(userId, {
        type: 'professeur',
        ...payload,
      });

      Alert.alert('Succès', 'Vos documents ont été enregistrés avec succès.');
      onCompleted();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'envoi des documents.";
      Alert.alert('Erreur', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Complétez votre profil">
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        <View style={styles.banner}>
          <FontAwesome5 name="exclamation-triangle" size={20} color={colors.warning} style={styles.bannerIcon} />
          <View style={styles.bannerTextContainer}>
            <Text style={styles.bannerTitle}>Dossier incomplet</Text>
            <Text style={styles.bannerSubtitle}>
              Il manque {missingDocs.length === 1 ? 'un document' : `${missingDocs.length} documents`} à votre dossier.
            </Text>
          </View>
        </View>

        {missingDocs.map((doc) => {
          const picked = pickedFiles[doc.field];
          return (
            <View key={doc.field} style={styles.docCard}>
              <View style={styles.docHeader}>
                <FontAwesome5 name="id-card" size={16} color={colors.primary} style={styles.docIcon} />
                <Text style={styles.docLabel}>{doc.label}</Text>
              </View>

              <TouchableOpacity
                style={[styles.pickButton, picked && styles.pickButtonSelected]}
                onPress={() => handlePickFile(doc.field)}
                disabled={submitting}
              >
                <FontAwesome5
                  name={picked ? 'sync-alt' : 'camera'}
                  size={16}
                  color={picked ? colors.primary : colors.textMuted}
                  style={styles.pickIcon}
                />
                <Text style={[styles.pickButtonText, picked && styles.pickButtonTextSelected]}>
                  {picked ? 'Changer le fichier' : 'Choisir un fichier'}
                </Text>
              </TouchableOpacity>

              {picked ? (
                <View style={styles.previewContainer}>
                  <View style={styles.readyBadge}>
                    <FontAwesome5 name="check-circle" size={12} color={colors.success} />
                    <Text style={styles.readyText}>Prêt à envoyer ({picked.name})</Text>
                  </View>
                  <Image source={{ uri: picked.uri }} style={styles.previewImage} resizeMode="cover" />
                </View>
              ) : null}
            </View>
          );
        })}

        <View style={styles.buttonRow}>
          <Button
            label="Plus tard"
            variant="ghost"
            onPress={onClose}
            disabled={submitting}
            style={styles.laterButton}
          />
          <Button
            label="Enregistrer"
            variant="primary"
            onPress={handleSave}
            loading={submitting}
            style={styles.saveButton}
          />
        </View>
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  scroll: {
    maxHeight: 520,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  bannerIcon: {
    marginRight: spacing.sm,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    ...typography.body,
    fontWeight: '700',
    color: '#92400E',
  },
  bannerSubtitle: {
    ...typography.caption,
    color: '#B45309',
    marginTop: 2,
  },
  docCard: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  docHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  docIcon: {
    marginRight: spacing.xs,
  },
  docLabel: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  pickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  pickButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: '#EFF6FF',
  },
  pickIcon: {
    marginRight: spacing.xs,
  },
  pickButtonText: {
    ...typography.body,
    color: colors.textMuted,
  },
  pickButtonTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  previewContainer: {
    marginTop: spacing.sm,
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  readyText: {
    ...typography.caption,
    color: colors.success,
    marginLeft: 4,
    fontWeight: '600',
  },
  previewImage: {
    width: 120,
    height: 80,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.success,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  laterButton: {
    flex: 1,
  },
  saveButton: {
    flex: 1,
  },
});

export default CompleteProfileModal;
