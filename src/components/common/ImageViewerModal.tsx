import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  GestureResponderEvent,
  Image,
  LayoutChangeEvent,
  Modal,
  NativeTouchEvent,
  PanResponder,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, typography } from '../../styles/theme';
import { useT } from '../../i18n';
import { CachedFile, FileOpenError, OpenableFile, downloadToCache, fileNameOf } from '../../services/fileOpener';

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 280;

type Transform = { s: number; x: number; y: number };

const distance = (t: NativeTouchEvent[]) => Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
const center = (t: NativeTouchEvent[]) =>
  t.length >= 2
    ? { x: (t[0].pageX + t[1].pageX) / 2, y: (t[0].pageY + t[1].pageY) / 2 }
    : { x: t[0].pageX, y: t[0].pageY };

/**
 * Pinch-to-zoom / pan / double-tap image built on core PanResponder + Animated,
 * so it needs no extra native module and works inside a Modal on both platforms.
 */
const ZoomableImage = ({ uri, onError }: { uri: string; onError: () => void }) => {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const scale = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const cur = useRef<Transform>({ s: 1, x: 0, y: 0 });
  const start = useRef<(Transform & { dist: number; cx: number; cy: number; n: number }) | null>(null);
  const moved = useRef(false);
  const lastTap = useRef(0);

  const responder = useMemo(() => {
    const clamp = (s: number, x: number, y: number): Transform => {
      const { w, h } = sizeRef.current;
      const mx = (w * (s - 1)) / 2;
      const my = (h * (s - 1)) / 2;
      return { s, x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) };
    };
    const apply = (v: Transform) => {
      cur.current = v;
      scale.setValue(v.s);
      tx.setValue(v.x);
      ty.setValue(v.y);
    };
    const animateTo = (v: Transform) => {
      cur.current = v;
      Animated.parallel([
        Animated.timing(scale, { toValue: v.s, duration: 180, useNativeDriver: true }),
        Animated.timing(tx, { toValue: v.x, duration: 180, useNativeDriver: true }),
        Animated.timing(ty, { toValue: v.y, duration: 180, useNativeDriver: true }),
      ]).start();
    };
    const begin = (touches: NativeTouchEvent[]) => {
      const c = center(touches);
      start.current = { ...cur.current, dist: touches.length >= 2 ? distance(touches) : 0, cx: c.x, cy: c.y, n: touches.length };
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        moved.current = false;
        begin(e.nativeEvent.touches);
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        const touches = e.nativeEvent.touches;
        if (!touches.length) return;
        const st = start.current;
        if (!st || touches.length !== st.n) {
          begin(touches);
          return;
        }
        const c = center(touches);
        const dx = c.x - st.cx;
        const dy = c.y - st.cy;
        if (touches.length >= 2 && st.dist > 0) {
          moved.current = true;
          const s = Math.max(MIN_SCALE * 0.8, Math.min(MAX_SCALE, (st.s * distance(touches)) / st.dist));
          apply(clamp(s, st.x + dx, st.y + dy));
        } else {
          if (Math.abs(dx) + Math.abs(dy) > 8) moved.current = true;
          if (st.s > 1) apply(clamp(st.s, st.x + dx, st.y + dy));
        }
      },
      onPanResponderRelease: () => {
        start.current = null;
        if (cur.current.s <= 1.02) animateTo({ s: 1, x: 0, y: 0 });
        if (moved.current) return;
        const now = Date.now();
        if (now - lastTap.current < DOUBLE_TAP_MS) {
          lastTap.current = 0;
          animateTo(cur.current.s > 1 ? { s: 1, x: 0, y: 0 } : { s: DOUBLE_TAP_SCALE, x: 0, y: 0 });
        } else {
          lastTap.current = now;
        }
      },
    });
  }, [scale, tx, ty]);

  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  return (
    <View style={styles.zoomArea} onLayout={onLayout} {...responder.panHandlers}>
      {size.w > 0 ? (
        <Animated.View style={{ width: size.w, height: size.h, transform: [{ translateX: tx }, { translateY: ty }, { scale }] }}>
          <Image source={{ uri }} style={{ width: size.w, height: size.h }} resizeMode="contain" onError={onError} />
        </Animated.View>
      ) : null}
    </View>
  );
};

interface ImageViewerModalProps {
  /** The image to show, or null when closed. */
  file: OpenableFile | null;
  onClose: () => void;
  /** Share the downloaded image (system share sheet). */
  onShare: (cached: CachedFile) => void;
}

/**
 * Full-screen, zoomable image viewer. Downloads the image to the app cache first
 * (same source resolution as every other file, including the authenticated
 * backend proxy), so the share button can hand the exact file to other apps.
 */
const ImageViewerModal = ({ file, onClose, onShare }: ImageViewerModalProps) => {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const [cached, setCached] = useState<CachedFile | null>(null);
  const [progress, setProgress] = useState<number | null>(0);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setCached(null);
    setError(null);
    setProgress(0);
    if (!file) return;
    const controller = new AbortController();
    downloadToCache(file, { signal: controller.signal, onProgress: setProgress })
      .then((c) => !controller.signal.aborted && setCached(c))
      .catch((e) => {
        if (controller.signal.aborted) return;
        setError(e instanceof FileOpenError && e.code === 'unavailable' ? t('fileViewer.unavailable') : t('fileViewer.downloadFailed'));
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  return (
    <Modal visible={!!file} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <View style={styles.root}>
        {cached && !error ? (
          <ZoomableImage key={cached.uri} uri={cached.uri} onError={() => setError(t('fileViewer.imageFailed'))} />
        ) : (
          <View style={styles.center}>
            {error ? (
              <>
                <FontAwesome5 name="image" size={40} color="rgba(255,255,255,0.5)" />
                <Text style={styles.message}>{error}</Text>
                <TouchableOpacity style={styles.retry} onPress={retry}>
                  <FontAwesome5 name="redo" size={13} color="#FFFFFF" />
                  <Text style={styles.retryText}>{t('fileViewer.retry')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.message}>
                  {progress != null && progress > 0
                    ? t('fileViewer.downloadingPercent', { pct: Math.round(progress * 100) })
                    : t('fileViewer.downloading')}
                </Text>
              </>
            )}
          </View>
        )}

        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
          <TouchableOpacity style={styles.iconButton} onPress={onClose} accessibilityLabel={t('fileViewer.close')}>
            <FontAwesome5 name="times" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {file ? fileNameOf(file) : ''}
          </Text>
          <TouchableOpacity
            style={[styles.iconButton, !cached && styles.disabled]}
            onPress={() => cached && onShare(cached)}
            disabled={!cached}
            accessibilityLabel={t('fileViewer.share')}
          >
            <FontAwesome5 name="share-alt" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        {cached && !error ? (
          <Text style={[styles.hint, { bottom: insets.bottom + spacing.lg }]} pointerEvents="none">
            {t('fileViewer.zoomHint')}
          </Text>
        ) : null}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  zoomArea: { flex: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  message: { ...typography.body, color: '#FFFFFF', textAlign: 'center' },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  retryText: { ...typography.bodyBold, color: '#FFFFFF' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.45)',
    gap: spacing.sm,
  },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  title: { ...typography.h4, color: '#FFFFFF', flex: 1, textAlign: 'center' },
  hint: { position: 'absolute', alignSelf: 'center', ...typography.caption, color: 'rgba(255,255,255,0.6)' },
});

export default ImageViewerModal;
