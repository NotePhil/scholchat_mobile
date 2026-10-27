import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useVideoPlayer, VideoSource, VideoView } from 'expo-video';
import { FontAwesome5 } from '@expo/vector-icons';
import { useT } from '../../i18n';

/*
 * Shared video pieces for the activity feed (ActivityMediaVideo / ActivityMediaGallery) and the
 * message attachments (messageMedia.tsx), same plan as the web work:
 *  - VideoThumbnailTile: the real first frame (a muted player seeked to 0.5 s, never played),
 *    a skeleton while it loads, a play overlay and the duration; a grey film placeholder with
 *    "Vidéo" when it can't be loaded — never a black box. A player only exists while the tile
 *    is on screen.
 *  - VideoPlaybackSurface: the full-screen player with a loading overlay (spinner, "Chargement
 *    de la vidéo…", buffered %, thin progress bar), shown again while buffering.
 *  - VideoErrorPanel: "Impossible de lire la vidéo" + Réessayer.
 */

/** "1:05" / "1:02:03" from seconds. */
export const formatVideoDuration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

/**
 * True while the view is on (or near) the screen. Polls measureInWindow, which works the same
 * inside a FlatList, a ScrollView or a modal, so a tile can create its player only while visible
 * and release it once scrolled away.
 */
export const useIsOnScreen = (margin = 150) => {
  const ref = useRef<View>(null);
  const [onScreen, setOnScreen] = useState(false);
  useEffect(() => {
    let alive = true;
    const check = () => {
      const node = ref.current;
      if (!node) return;
      node.measureInWindow((x, y, w, h) => {
        if (!alive) return;
        const win = Dimensions.get('window');
        const visible =
          w > 0 && h > 0 && y + h > -margin && y < win.height + margin && x + w > -margin && x < win.width + margin;
        setOnScreen((prev) => (prev === visible ? prev : visible));
      });
    };
    check();
    const timer = setInterval(check, 400);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [margin]);
  return { ref, onScreen };
};

const PulsingSkeleton = () => {
  const opacity = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[StyleSheet.absoluteFill, styles.skeleton, { opacity }]} pointerEvents="none" />;
};

/** Muted, paused player showing the frame at 0.5 s. Unmounting it releases the native player. */
const FirstFramePlayer = ({
  source,
  onFrame,
  onDuration,
  onError,
}: {
  source: VideoSource;
  onFrame: () => void;
  onDuration: (d: number) => void;
  onError: () => void;
}) => {
  const player = useVideoPlayer(source, (p) => {
    p.muted = true;
    p.loop = false;
    p.currentTime = 0.5;
  });
  const cb = useRef({ onFrame, onDuration, onError });
  cb.current = { onFrame, onDuration, onError };

  useEffect(() => {
    const status = player.addListener('statusChange', ({ status: st }) => {
      if (st === 'error') cb.current.onError();
    });
    const load = player.addListener('sourceLoad', ({ duration }) => {
      if (duration > 0) cb.current.onDuration(duration);
    });
    if (player.status === 'error') cb.current.onError();
    if (player.duration > 0) cb.current.onDuration(player.duration);
    return () => {
      status.remove();
      load.remove();
    };
  }, [player]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        nativeControls={false}
        contentFit="cover"
        // SurfaceView doesn't composite under the overlays of a scrolling grid (black/green frames).
        surfaceType="textureView"
        onFirstFrameRender={() => cb.current.onFrame()}
      />
    </View>
  );
};

export interface VideoThumbnailTileProps {
  /** Resolved source; null while the URL is still being resolved. */
  source: VideoSource | null;
  /** Called when the tile becomes visible and has no source yet (lazy URL resolution). */
  onNeedSource?: () => void;
  /** The source failed: return true when a fallback source is coming (e.g. the auth proxy). */
  onSourceError?: () => boolean;
  /** Definitive failure decided by the caller (no URL at all). */
  failed?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  /** Extra overlay content (file name badge…) instead of the default "Vidéo" chip. */
  topLeft?: React.ReactNode;
  /** Shown in the bottom-left corner (e.g. file size). */
  bottomLeft?: React.ReactNode;
}

export const VideoThumbnailTile = ({
  source,
  onNeedSource,
  onSourceError,
  failed = false,
  onPress,
  style,
  compact = false,
  topLeft,
  bottomLeft,
}: VideoThumbnailTileProps) => {
  const { t } = useT();
  const { ref, onScreen } = useIsOnScreen();
  const [frameShown, setFrameShown] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);
  const sourceKey = source && typeof source === 'object' && 'uri' in source ? String(source.uri) : String(source ?? '');

  useEffect(() => {
    setError(false);
    setFrameShown(false);
  }, [sourceKey]);

  useEffect(() => {
    if (onScreen && !source && !failed) onNeedSource?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onScreen, !!source, failed]);

  // A player that reports ready but never paints a frame must not leave a black/empty tile.
  useEffect(() => {
    if (!onScreen || !source || frameShown || error || failed) return undefined;
    const timer = setTimeout(() => setError(true), 15000);
    return () => clearTimeout(timer);
  }, [onScreen, sourceKey, frameShown, error, failed, source]);

  const handleError = () => {
    if (onSourceError?.()) return;
    setError(true);
  };

  // Offscreen: release the player; keep the frame flag so the skeleton shows on return until repainted.
  useEffect(() => {
    if (!onScreen) setFrameShown(false);
  }, [onScreen]);

  const broken = failed || error;
  const showPlayer = onScreen && !!source && !broken;
  const durationLabel = formatVideoDuration(duration);

  return (
    <TouchableOpacity
      ref={ref as any}
      style={[styles.tile, style]}
      activeOpacity={0.88}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={t('media.playVideo')}
    >
      {showPlayer ? (
        <FirstFramePlayer
          key={sourceKey}
          source={source as VideoSource}
          onFrame={() => setFrameShown(true)}
          onDuration={setDuration}
          onError={handleError}
        />
      ) : null}
      {broken ? (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]} pointerEvents="none">
          <FontAwesome5 name="film" size={compact ? 20 : 26} color="#9CA3AF" />
          <Text style={styles.placeholderText}>{t('media.video')}</Text>
        </View>
      ) : !frameShown ? (
        <PulsingSkeleton />
      ) : null}

      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
        <View style={[styles.playButton, compact && styles.playButtonCompact]}>
          <FontAwesome5 name="play" size={compact ? 14 : 20} color="#FFFFFF" style={{ marginLeft: 3 }} />
        </View>
      </View>
      <View style={styles.topLeft} pointerEvents="none">
        {topLeft ?? (
          <View style={styles.chip}>
            <FontAwesome5 name="video" size={9} color="#FFFFFF" />
            {!compact ? <Text style={styles.chipText}>{t('media.video')}</Text> : null}
          </View>
        )}
      </View>
      {bottomLeft ? (
        <View style={styles.bottomLeft} pointerEvents="none">
          {bottomLeft}
        </View>
      ) : null}
      {durationLabel ? (
        <View style={styles.duration} pointerEvents="none">
          <Text style={styles.durationText}>{durationLabel}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

/** Sliding segment while the buffered amount isn't known yet. */
const IndeterminateBar = () => {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(x, { toValue: 1, duration: 1100, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [x]);
  return (
    <Animated.View
      style={[
        styles.progressFill,
        styles.indeterminate,
        { transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-70, 240] }) }] },
      ]}
    />
  );
};

/**
 * Full-screen player. Autoplays with native controls; while the status is "loading" (first load
 * and buffering) an overlay shows a spinner, "Chargement de la vidéo…", the buffered percentage
 * and a thin progress bar.
 */
export const VideoPlaybackSurface = ({
  source,
  style,
  onError,
}: {
  source: VideoSource;
  style?: StyleProp<ViewStyle>;
  onError: () => void;
}) => {
  const { t } = useT();
  const player = useVideoPlayer(source, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.5;
    p.play();
  });
  const [status, setStatus] = useState<string>(player.status);
  const [buffered, setBuffered] = useState(0);
  const [duration, setDuration] = useState(0);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    const subs = [
      player.addListener('statusChange', ({ status: st }) => {
        setStatus(st);
        if (st === 'error') onErrorRef.current();
      }),
      player.addListener('timeUpdate', ({ bufferedPosition }) => setBuffered(bufferedPosition)),
      player.addListener('sourceLoad', ({ duration: d }) => {
        if (d > 0) setDuration(d);
      }),
    ];
    setStatus(player.status);
    if (player.duration > 0) setDuration(player.duration);
    if (player.status === 'error') onErrorRef.current();
    return () => subs.forEach((s) => s.remove());
  }, [player]);

  const loading = status === 'loading' || status === 'idle';

  // timeUpdate is only emitted while playing: during the first load (and buffering) read the
  // buffered position directly so the percentage keeps moving.
  useEffect(() => {
    if (!loading) return undefined;
    const timer = setInterval(() => {
      try {
        setBuffered(player.bufferedPosition);
        if (player.duration > 0) setDuration(player.duration);
      } catch {
        // player released
      }
    }, 500);
    return () => clearInterval(timer);
  }, [loading, player]);

  const fraction = duration > 0 ? Math.max(0, Math.min(1, buffered / duration)) : 0;
  const pct = Math.round(fraction * 100);

  return (
    <View style={[styles.surface, style]}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        nativeControls
        allowsPictureInPicture
        contentFit="contain"
        surfaceType="textureView"
      />
      {loading ? (
        <View style={[StyleSheet.absoluteFill, styles.center, styles.loadingOverlay]} pointerEvents="none">
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>
            {t('media.loadingVideo')}
            {pct > 0 ? ` ${pct} %` : ''}
          </Text>
          <View style={styles.progressTrack}>
            {pct > 0 ? <View style={[styles.progressFill, { width: `${pct}%` }]} /> : <IndeterminateBar />}
          </View>
        </View>
      ) : null}
    </View>
  );
};

/** "Impossible de lire la vidéo" + Réessayer (+ an optional secondary action). */
export const VideoErrorPanel = ({
  onRetry,
  style,
  extra,
}: {
  onRetry: () => void;
  style?: StyleProp<ViewStyle>;
  extra?: React.ReactNode;
}) => {
  const { t } = useT();
  return (
    <View style={[styles.errorPanel, style]}>
      <FontAwesome5 name="video-slash" size={28} color="#9CA3AF" />
      <Text style={styles.errorText}>{t('media.videoError')}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry} accessibilityRole="button">
        <FontAwesome5 name="redo" size={12} color="#FFFFFF" />
        <Text style={styles.retryText}>{t('media.retry')}</Text>
      </TouchableOpacity>
      {extra}
    </View>
  );
};

/** Spinner + label while a full-screen video URL is being resolved. */
export const VideoPreparing = ({ style }: { style?: StyleProp<ViewStyle> }) => {
  const { t } = useT();
  return (
    <View style={[styles.errorPanel, style]}>
      <ActivityIndicator size="large" color="#FFFFFF" />
      <Text style={styles.loadingText}>{t('media.loadingVideo')}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  tile: { backgroundColor: '#E5E7EB', overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
  skeleton: { backgroundColor: '#D1D5DB' },
  placeholder: { backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', gap: 6 },
  placeholderText: { color: '#6B7280', fontSize: 12, fontWeight: '600' },
  playButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonCompact: { width: 40, height: 40, borderRadius: 20 },
  topLeft: { position: 'absolute', top: 8, left: 8, right: 8, flexDirection: 'row' },
  bottomLeft: { position: 'absolute', bottom: 6, left: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  chipText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  duration: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  durationText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  surface: { backgroundColor: '#000', overflow: 'hidden' },
  loadingOverlay: { backgroundColor: 'rgba(0,0,0,0.45)', gap: 10 },
  loadingText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', marginTop: 10 },
  progressTrack: { width: '55%', height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  progressFill: { height: 3, borderRadius: 2, backgroundColor: '#FFFFFF' },
  indeterminate: { width: 70 },
  errorPanel: { alignItems: 'center', justifyContent: 'center', gap: 4, padding: 16 },
  errorText: { color: '#E5E7EB', fontSize: 14, fontWeight: '600', marginTop: 10, textAlign: 'center' },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#2563EB',
  },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});
