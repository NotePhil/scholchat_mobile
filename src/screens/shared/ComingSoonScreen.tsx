import React from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { EmptyState } from '../../components/ui';
import { colors, spacing } from '../../styles/theme';
import { useUser } from '../../context/UserContext';

interface ComingSoonScreenProps {
  roleLabel: string;
}

/**
 * Landing screen for roles whose dedicated dashboard hasn't been built yet
 * (parent, student, establishment, gestionnaire, tutor — see the phased
 * roadmap). Still lets the user see who they're signed in as and log out.
 */
const ComingSoonScreen = ({ roleLabel }: ComingSoonScreenProps) => {
  const { user, logout } = useUser();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <EmptyState
          icon="tools"
          title={`Espace ${roleLabel}`}
          message={`Bonjour ${user?.username || user?.nom || ''} — cet espace est en cours de construction et arrive bientôt.`}
          actionLabel="Se déconnecter"
          onAction={logout}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
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
