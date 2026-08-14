import { Alert } from 'react-native';

/** Shared logout confirmation — used everywhere a "Déconnexion" action is triggered (headers, quick-actions sheet, settings) so it never fires on a single accidental tap. */
export const confirmLogout = (onLogout: () => void) => {
  Alert.alert('Déconnexion', 'Êtes-vous sûr de vouloir vous déconnecter ?', [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Déconnecter', style: 'destructive', onPress: onLogout },
  ]);
};
