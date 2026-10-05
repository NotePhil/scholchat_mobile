import React, { useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import BottomSheet from '../ui/BottomSheet';
import ProfessorDocumentsForm from '../common/ProfessorDocumentsForm';
import { radius, spacing, typography, useThemeColors } from '../../styles/theme';
import { PROFESSOR_DOCS } from '../../hooks/useProfessorDocumentsUpload';
import { translate, useT } from '../../i18n';

export interface MissingDoc {
  /** Profile field: cniUrlRecto / cniUrlVerso / selfieUrl. */
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

/**
 * Bottom-sheet variant of the professor documents upload (mirrors web's CompleteProfileModal.jsx):
 * lets a professor send the identity documents missing from his file. The form itself
 * (ProfessorDocumentsForm) is shared with the professor verification status screen.
 */
const CompleteProfileModal: React.FC<CompleteProfileModalProps> = ({
  visible,
  userId,
  missingDocs,
  onClose,
  onCompleted,
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const only = PROFESSOR_DOCS.filter((d) => missingDocs.some((m) => m.field === d.field)).map((d) => d.key);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('profVerification.missing.title')}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.banner}>
          <FontAwesome5 name="exclamation-triangle" size={18} color={colors.warningDark} style={styles.bannerIcon} />
          <View style={styles.bannerTextContainer}>
            <Text style={styles.bannerTitle}>{t('profVerification.docs.incompleteTitle')}</Text>
            <Text style={styles.bannerSubtitle}>{t('profVerification.docs.incompleteCount', { count: missingDocs.length })}</Text>
          </View>
        </View>
        <ProfessorDocumentsForm
          userId={userId}
          only={only.length ? only : undefined}
          showMatricule={false}
          secondaryAction={{ label: t('profVerification.docs.later'), onPress: onClose }}
          onSubmitted={() => {
            Alert.alert(translate('profVerification.docs.sentTitle'), translate('profVerification.docs.sentMessage'));
            onCompleted();
          }}
        />
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </BottomSheet>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    scroll: { maxHeight: 560 },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.warning,
      padding: spacing.md,
      borderRadius: radius.md,
      marginBottom: spacing.md,
    },
    bannerIcon: { marginRight: spacing.sm },
    bannerTextContainer: { flex: 1 },
    bannerTitle: { ...typography.bodyBold, color: colors.text },
    bannerSubtitle: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  });

export default CompleteProfileModal;
