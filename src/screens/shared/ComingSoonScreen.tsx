import React, { useMemo } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { EmptyState } from '../../components/ui';
import { colors, spacing, useThemeColors } from '../../styles/theme';
import { useUser } from '../../context/UserContext';
import { useT } from '../../i18n';
import type { AppRole } from '../../types';

interface ComingSoonScreenProps {
  role: AppRole;
}

/**
 * Landing screen for roles whose dedicated dashboard hasn't been built yet
 * (parent, student, establishment, gestionnaire, tutor — see the phased
 * roadmap). Still lets the user see who they're signed in as and log out.
 */
const ComingSoonScreen = ({ role }: ComingSoonScreenProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, logout } = useUser();
  const { t } = useT();
  const roleLabel = t(`roles.${role}`);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <EmptyState
          icon="tools"
          title={t('comingSoon.title', { role: roleLabel })}
          message={t('comingSoon.message', { name: user?.username || user?.nom || '' })}
          actionLabel={t('common.logout')}
          onAction={logout}
        />
      </View>
    </SafeAreaView>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
});

export default ComingSoonScreen;
