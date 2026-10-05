import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Button, Input } from '../ui';
import { radius, spacing, typography, useThemeColors } from '../../styles/theme';
import { PROFESSOR_DOCS, ProfessorDocKey, useProfessorDocumentsUpload } from '../../hooks/useProfessorDocumentsUpload';
import { useT } from '../../i18n';

interface ProfessorDocumentsFormProps {
  userId: string;
  /** Documents already on file server-side (shown as "already provided", replacing is optional). */
  provided?: Partial<Record<ProfessorDocKey, boolean>>;
  /** Restricts the form to these documents (default: all three). */
  only?: ProfessorDocKey[];
  showMatricule?: boolean;
  /** Called after a successful upload + profile PATCH. */
  onSubmitted: () => void;
  /** Optional secondary button shown next to submit (e.g. "Later"). */
  secondaryAction?: { label: string; onPress: () => void };
}

/**
 * CNI recto / verso + selfie (+ optional matricule) upload form, shared by the professor
 * verification status screen and CompleteProfileModal. Same tiles as the sign-up documents step.
 */
const ProfessorDocumentsForm = ({
  userId,
  provided = {},
  only,
  showMatricule = true,
  onSubmitted,
  secondaryAction,
}: ProfessorDocumentsFormProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const { files, pick, remove, matricule, setMatricule, submitting, error, submit } = useProfessorDocumentsUpload(userId);
  const docs = only ? PROFESSOR_DOCS.filter((d) => only.includes(d.key)) : PROFESSOR_DOCS;

  const handleSubmit = async () => {
    if (await submit()) onSubmitted();
  };

  return (
    <View>
      {showMatricule ? (
        <Input
          label={t('auth.signup.verification.matricule')}
          placeholder={t('auth.signup.verification.matriculePlaceholder')}
          value={matricule}
          onChangeText={setMatricule}
          autoCapitalize="characters"
          editable={!submitting}
        />
      ) : null}

      {docs.map((d) => {
        const file = files[d.key];
        const isProvided = !!provided[d.key];
        const label = t(`auth.signup.verification.docs.${d.key}.label`);
        const hint = file
          ? t('auth.signup.verification.tapToReplace')
          : isProvided
            ? t('profVerification.docs.replaceOptional')
            : t(`auth.signup.verification.docs.${d.key}.hint`);
        return (
          <View key={d.key} style={styles.docField}>
            <View style={styles.docLabelRow}>
              <Text style={styles.docLabel}>{label}</Text>
              <View style={[styles.statePill, { backgroundColor: `${isProvided ? colors.success : colors.warning}22` }]}>
                <FontAwesome5
                  name={isProvided ? 'check-circle' : 'exclamation-circle'}
                  size={10}
                  color={isProvided ? colors.success : colors.warning}
                />
                <Text style={[styles.stateText, { color: isProvided ? colors.success : colors.warning }]}>
                  {isProvided ? t('profVerification.docs.provided') : t('profVerification.docs.missing')}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.docBox, file ? { borderStyle: 'solid', borderColor: colors.success } : null]}
              onPress={() => pick(d.key)}
              disabled={submitting}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`${label}${file ? ` : ${file.name}` : ''}`}
            >
              {file ? (
                <Image source={{ uri: file.uri }} style={styles.thumb} resizeMode="cover" />
              ) : (
                <View style={[styles.docIcon, { backgroundColor: `${colors.primary}22` }]}>
                  <FontAwesome5 name={d.icon} size={15} color={colors.primary} />
                </View>
              )}
              <View style={styles.flex}>
                <Text style={styles.docName} numberOfLines={1}>
                  {file ? file.name : t('auth.signup.verification.addFile')}
                </Text>
                <Text style={styles.docHint} numberOfLines={2}>{hint}</Text>
              </View>
              {file ? (
                <TouchableOpacity
                  onPress={() => remove(d.key)}
                  disabled={submitting}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityLabel={t('auth.signup.verification.removeFile')}
                >
                  <FontAwesome5 name="times-circle" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ) : (
                <FontAwesome5 name="cloud-upload-alt" size={16} color={colors.primary} />
              )}
            </TouchableOpacity>
          </View>
        );
      })}

      {error ? (
        <View style={styles.errorRow}>
          <FontAwesome5 name="exclamation-circle" size={12} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.buttonRow}>
        {secondaryAction ? (
          <Button
            label={secondaryAction.label}
            variant="ghost"
            onPress={secondaryAction.onPress}
            disabled={submitting}
            style={styles.flexButton}
          />
        ) : null}
        <Button
          label={t('profVerification.docs.submit')}
          icon="paper-plane"
          onPress={handleSubmit}
          loading={submitting}
          style={styles.flexButton}
        />
      </View>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    flex: { flex: 1 },
    docField: { marginBottom: spacing.md },
    docLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs, gap: spacing.sm },
    docLabel: { ...typography.bodyBold, color: colors.text, flexShrink: 1 },
    statePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
    stateText: { ...typography.tiny },
    docBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    docIcon: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
    thumb: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.surfaceElevated },
    docName: { ...typography.bodyBold, color: colors.text, fontSize: 13 },
    docHint: { ...typography.caption, color: colors.textMuted },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
    errorText: { ...typography.caption, color: colors.danger, flex: 1 },
    buttonRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
    flexButton: { flex: 1 },
  });

export default ProfessorDocumentsForm;
