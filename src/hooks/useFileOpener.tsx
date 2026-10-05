import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import ImageViewerModal from '../components/common/ImageViewerModal';
import { radius, spacing, typography, useThemeColors } from '../styles/theme';
import { TFunction, useT } from '../i18n';
import {
  CachedFile,
  FileOpenError,
  OpenableFile,
  downloadToCache,
  fileKindOf,
  fileNameOf,
  openCachedWithNativeApp,
  shareCachedFile,
} from '../services/fileOpener';

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

/** Web links that aren't stored files (articles, videos sites…) still go to the browser. */
const openInBrowser = (url: string, t: TFunction) =>
  Linking.openURL(url).catch(() => Alert.alert(t('common.error'), t('fileViewer.openFailed')));

interface DownloadState {
  key: string;
  name: string;
  progress: number | null;
}

/**
 * Opens a stored file the right way for its type:
 *  - PDF   → in-app PdfViewer screen,
 *  - image → in-app zoomable full-screen viewer,
 *  - other → downloaded to cache (progress + cancel), then the native "Open with".
 *
 * Render `host` once in the screen (it holds the download dialog and the image viewer).
 * `openingKey` is the key passed to `open` while that file is being prepared.
 */
export const useFileOpener = () => {
  const navigation = useNavigation<any>();
  const { t } = useT();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [image, setImage] = useState<OpenableFile | null>(null);
  const [download, setDownload] = useState<DownloadState | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const open = useCallback(
    async (file: OpenableFile, key?: string) => {
      if (controllerRef.current) return; // one download at a time
      const kind = fileKindOf(file);
      if (kind === 'pdf') {
        navigation.navigate('PdfViewer', { file });
        return;
      }
      if (kind === 'image') {
        setImage(file);
        return;
      }
      const controller = new AbortController();
      controllerRef.current = controller;
      const name = fileNameOf(file);
      setDownload({ key: key ?? name, name, progress: 0 });
      try {
        const cached = await downloadToCache(file, {
          signal: controller.signal,
          onProgress: (progress) => setDownload((d) => (d ? { ...d, progress } : d)),
        });
        setDownload(null);
        await openExternallyWithAlert(cached, t);
      } catch (e) {
        setDownload(null);
        alertDownloadError(e, t);
      } finally {
        controllerRef.current = null;
      }
    },
    [navigation, t]
  );

  /** Opens a link found in course content: stored files in-app/with an app, other web pages in the browser. */
  const openLink = useCallback(
    (url: string, file: Omit<OpenableFile, 'url'> = {}, key?: string) => {
      if (!/^https?:|^\//i.test(url) || !isLikelyStoredFile(url, file.fileName)) {
        openInBrowser(url, t);
        return;
      }
      open({ ...file, url }, key);
    },
    [open, t]
  );

  const cancel = useCallback(() => controllerRef.current?.abort(), []);

  const host = (
    <>
      <ImageViewerModal file={image} onClose={() => setImage(null)} onShare={(c) => shareWithAlert(c, t)} />
      <Modal visible={!!download} transparent animationType="fade" onRequestClose={cancel}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <FontAwesome5 name="file-download" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName} numberOfLines={2}>
                  {download?.name}
                </Text>
                <Text style={styles.cardStatus}>
                  {download?.progress != null && download.progress > 0
                    ? t('fileViewer.downloadingPercent', { pct: Math.round(download.progress * 100) })
                    : t('fileViewer.preparing')}
                </Text>
              </View>
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.bar,
                  { width: `${Math.max(4, Math.round((download?.progress ?? 0) * 100))}%` },
                  download?.progress == null && styles.barIndeterminate,
                ]}
              />
            </View>
            <TouchableOpacity style={styles.cancel} onPress={cancel}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );

  return { open, openLink, openingKey: download?.key ?? null, host };
};

const STORED_FILE_EXT = /\.(pdf|jpe?g|png|gif|webp|bmp|heic|svg|docx?|odt|rtf|pptx?|ppsx?|odp|xlsx?|ods|csv|txt|md|json|xml|zip|rar|7z|tar|gz|epub|mp3|wav|ogg|m4a|aac|flac|mp4|m4v|mov|avi|mkv|webm|3gp)$/i;

/**
 * Whether a link points at a stored file (backend media, S3/MinIO/Wasabi object,
 * or anything with a document/media extension) rather than a web page.
 */
export const isLikelyStoredFile = (url: string, fileName?: string | null) => {
  if (url.startsWith('/media/') || /\/media\/[^/?#]+\/(content|download)/.test(url)) return true;
  const path = url.split('?')[0].split('#')[0];
  if (/\/users\/[^/]+\//.test(path)) return true;
  if (/wasabisys\.com|amazonaws\.com|minio|:9000\//i.test(url)) return true;
  return STORED_FILE_EXT.test(path) || (!!fileName && STORED_FILE_EXT.test(fileName));
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    card: { width: '100%', maxWidth: 380, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    cardIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      backgroundColor: `${colors.primary}1A`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardName: { ...typography.bodyBold, color: colors.text },
    cardStatus: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
    track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceElevated, overflow: 'hidden' },
    bar: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
    barIndeterminate: { width: '35%', opacity: 0.6 },
    cancel: { alignSelf: 'flex-end', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    cancelText: { ...typography.bodyBold, color: colors.primary },
  });

export default useFileOpener;
