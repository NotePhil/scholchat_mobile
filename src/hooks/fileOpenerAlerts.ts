import { Alert } from 'react-native';
import { TFunction } from '../i18n';
import { CachedFile, FileOpenError, openCachedWithNativeApp, shareCachedFile } from '../services/fileOpener';

// Alerts around file opening, in their own module so the viewers (PdfViewerScreen)
// and useFileOpener can both use them without an import cycle.

/** Shares a cached file, with a friendly error. */
export const shareWithAlert = async (cached: CachedFile, t: TFunction) => {
  try {
    await shareCachedFile(cached, cached.fileName);
  } catch {
    Alert.alert(t('common.error'), t('fileViewer.shareFailed'));
  }
};

/**
 * Hands a cached file to the OS ("Open with" chooser on Android, share / "Open
 * in…" sheet on iOS). When no app can open it, explains it and offers to share.
 */
export const openExternallyWithAlert = async (cached: CachedFile, t: TFunction) => {
  try {
    await openCachedWithNativeApp(cached, t('fileViewer.openWith'));
  } catch (e) {
    if (e instanceof FileOpenError && e.code === 'noApp') {
      Alert.alert(t('fileViewer.noAppTitle'), t('fileViewer.noAppMessage', { name: cached.fileName }), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('fileViewer.share'), onPress: () => shareWithAlert(cached, t) },
      ]);
    } else {
      Alert.alert(t('common.error'), t('fileViewer.openFailed'));
    }
  }
};

/** Alert for a failed download (nothing for a user cancel). */
export const alertDownloadError = (e: unknown, t: TFunction) => {
  if (e instanceof FileOpenError && e.code === 'cancelled') return;
  if (e instanceof FileOpenError && e.code === 'unavailable') {
    Alert.alert(t('fileViewer.unavailableTitle'), t('fileViewer.unavailable'));
  } else {
    Alert.alert(t('common.error'), t('fileViewer.downloadFailed'));
  }
};
