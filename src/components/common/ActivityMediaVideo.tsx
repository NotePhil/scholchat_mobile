import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView, VideoSource } from 'expo-video';
import { FontAwesome5 } from '@expo/vector-icons';
import { mediaService } from '../../services/api';
import { storageService } from '../../services/storageService';

interface ActivityMediaVideoProps {
  mediaId?: string;
  presignedUrl?: string | null;
  style?: StyleProp<ViewStyle>;
  /** Start resolving and playing immediately instead of waiting for a tap (used by the full-screen viewer). */
  autoPlay?: boolean;
  /** Smaller play button and label, for small grid cells. */
  compact?: boolean;
}

const ActiveVideo = ({ source, style, onError }: { source: VideoSource; style?: StyleProp<ViewStyle>; onError: () => void }) => {
  const player = useVideoPlayer(source, (p) => {
    p.loop = false;
    p.play();
  });

  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status }) => {
      if (status === 'error') onError();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.flatten([styles.video, style]) as ViewStyle}
      allowsPictureInPicture
      nativeControls
      // Android defaults to SurfaceView, which expo-video's own docs flag as
      // unreliable for "overlapping video views" — exactly this case, where
      // each video sits inside a scrollable grid cell stacked under badges/
      // overlays. That mismatch is what shows up as a corrupted black/green
      // frame instead of real video. TextureView composites like any other
      // view and avoids it, at a small perf/battery cost that doesn't matter
      // for a feed of short clips. iOS ignores this prop.
      surfaceType="textureView"
    />
  );
};

/**
 * Mirrors scholchat_front's VideoPlayer (ActivitiesContent.jsx) exactly:
 * two phases, no exceptions.
 *   Phase 1 (default): dark placeholder, centered play button, "Vidéo" badge
 *     — zero network cost until tapped. Web also paints a first-frame thumbnail
 *     with a canvas; expo-video's generateThumbnailsAsync can only be shown
 *     through expo-image, which isn't installed, so mobile keeps web's own
 *     fallback (dark tile + play button) instead.
 *   Phase 2 (after tap): resolves the real playable URL and mounts the real
 *     player, which autoplays with native controls once ready.
 *
 * The resolved URL is one of two very different kinds, and only one of them
 * wants the app's Bearer token:
 *   - a real presigned S3/MinIO URL from getDownloadUrl() — this already
 *     authenticates via its signed query params; attaching an extra
 *     Authorization header here doesn't match what was signed and the
 *     request fails, which expo-video surfaces as a silent black frame (no
 *     error dialog, just nothing). This was happening for every video whose
 *     download URL resolved successfully — exactly the "some videos stay
 *     black even after I tap them" case.
 *   - the /media/{id}/content same-origin proxy stream (used when
 *     getDownloadUrl fails, or the presigned URL itself later errors) — this
 *     one IS auth-gated and 401s without the header.
 * So the header is attached only for the proxy URL, matching
 * ActivityMediaImage's already-correct handling of this exact split, and a
 * player error triggers a one-time retry through the proxy+header path
 * before giving up.
 */
const ActivityMediaVideo = ({ mediaId, presignedUrl, style, autoPlay = false, compact = false }: ActivityMediaVideoProps) => {
  const [active, setActive] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [source, setSource] = useState<VideoSource | null>(null);
  const [triedProxy, setTriedProxy] = useState(false);
  const [error, setError] = useState(false);

  const withProxyFallback = async () => {
    if (!mediaId) {
      setError(true);
      return;
    }
    const token = await storageService.getUserToken();
    setSource({ uri: mediaService.getContentUrl(mediaId), headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  };

  const activate = async () => {
    if (active) return;
    setActive(true);

    if (presignedUrl) {
      setSource({ uri: presignedUrl });
      return;
    }
    if (!mediaId) {
      setError(true);
      return;
    }
    setResolving(true);
    try {
      const resolved = await mediaService.getDownloadUrl(mediaId);
      if (resolved) {
        setSource({ uri: resolved });
      } else {
        await withProxyFallback();
      }
    } catch {
      await withProxyFallback();
    } finally {
      setResolving(false);
    }
  };

  useEffect(() => {
    if (autoPlay) activate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay]);

  const handlePlayerError = () => {
    if (!triedProxy && mediaId) {
      setTriedProxy(true);
      withProxyFallback();
    } else {
      setError(true);
    }
  };

  if (active) {
    if (error) {
      return (
        <View style={[styles.placeholder, style as StyleProp<ViewStyle>]}>
          <FontAwesome5 name="video-slash" size={20} color="#9CA3AF" />
          <Text style={styles.placeholderText}>Vidéo indisponible</Text>
        </View>
      );
    }
    if (resolving || !source) {
      return (
        <View style={[styles.placeholder, style as StyleProp<ViewStyle>]}>
          <ActivityIndicator color="#9CA3AF" />
          <Text style={styles.placeholderText}>Préparation...</Text>
        </View>
      );
    }
    return <ActiveVideo source={source} style={style} onError={handlePlayerError} />;
  }

  // Phase 1 — lazy preview, no network request until tapped.
  return (
    <TouchableOpacity style={[styles.preview, style as StyleProp<ViewStyle>]} activeOpacity={0.85} onPress={activate}>
      <View style={[styles.playButton, compact && styles.playButtonCompact]}>
        <FontAwesome5 name="play" size={compact ? 15 : 22} color="#FFFFFF" style={{ marginLeft: 3 }} />
      </View>
      {!compact ? <Text style={styles.playLabel}>Lire la vidéo</Text> : null}
      <View style={styles.badge}>
        <FontAwesome5 name="video" size={9} color="#FFFFFF" />
        <Text style={styles.badgeText}>Vidéo</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  video: { backgroundColor: '#000' },
  preview: {
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonCompact: { width: 42, height: 42, borderRadius: 21 },
  playLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', marginTop: 8 },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  placeholder: { backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', gap: 6 },
  placeholderText: { color: '#9CA3AF', fontSize: 11 },
});

export default ActivityMediaVideo;
