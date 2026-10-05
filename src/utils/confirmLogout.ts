import { Alert } from 'react-native';
import { translate } from '../i18n';

/** Shared logout confirmation — used everywhere a "Déconnexion" action is triggered (headers, quick-actions sheet, settings) so it never fires on a single accidental tap. */
export const confirmLogout = (onLogout: () => void) => {
  Alert.alert(translate('logout.title'), translate('logout.confirm'), [
    { text: translate('common.cancel'), style: 'cancel' },
    { text: translate('logout.action'), style: 'destructive', onPress: onLogout },
  ]);
};
