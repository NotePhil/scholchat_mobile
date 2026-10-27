import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { VideoSource } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '../../i18n';
import { OpenableFile, fileNameOf, streamSourcesOf } from '../../services/fileOpener';
import { VideoErrorPanel, VideoPlaybackSurface, VideoPreparing } from './videoPlayback';

/**
 * Full-screen in-app video player shown as a Modal (above the current screen,
 * which stays mounted — e.g. a live call keeps running underneath). Streams the
 * file, trying each candidate source (presigned URL, then the authenticated
 * backend proxy) when the player reports an error.
 */
const VideoViewerModal = ({ file, onClose }: { file: OpenableFile | null; onClose: () => void }) => {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const [source, setSource] = useState<VideoSource | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const queue = useRef<ReturnType<typeof streamSourcesOf>>([]);
  const seen = useRef(new Set<string>());

  const next = useCallback(async () => {
    while (queue.current.length > 0) {
      const thunk = queue.current.shift()!;
      const s = await thunk().catch(() => null);
      if (!s || seen.current.has(s.uri)) continue;
      seen.current.add(s.uri);
      setSource(s);
      return;
    }
    setFailed(true);
  }, []);

  useEffect(() => {
    setSource(null);
    setFailed(false);
    if (!file) return;
    queue.current = streamSourcesOf(file);
    seen.current = new Set();
    next();
  }, [file, attempt, next]);

  const uri = source && typeof source === 'object' && 'uri' in source ? String(source.uri) : '';

  return (
    <Modal
      visible={!!file}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={['portrait', 'landscape']}
    >
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]} testID="video-viewer-modal">
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.close} accessibilityLabel={t('fileViewer.close')}>
            <FontAwesome5 name="times" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {file ? fileNameOf(file) : ''}
          </Text>
        </View>
        <View style={styles.body}>
          {failed ? (
            <VideoErrorPanel style={StyleSheet.absoluteFill} onRetry={() => setAttempt((n) => n + 1)} />
          ) : source ? (
            <VideoPlaybackSurface key={uri} source={source} style={StyleSheet.absoluteFill} onError={() => next()} />
          ) : (
            <VideoPreparing style={StyleSheet.absoluteFill} />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 6 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  body: { flex: 1 },
});

export default VideoViewerModal;
