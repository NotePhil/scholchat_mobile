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
      allowsFullscreen
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
 *     — zero network cost, matches every other cell in the grid until tapped.
 *   Phase 2 (after tap): resolves the real playable URL (presigned download
 *     URL, falling back to the /media/{id}/content proxy — same auth-gated
 *     path ActivityMediaImage already uses) and mounts the real player,
 *     which autoplays with native controls once ready.
 *
 * CRITICAL: unlike <Image>, expo-video's player does its own network fetch
 * outside axios, so it never picks up the app's Bearer token automatically.
 * The /media/{id}/content proxy endpoint requires that header — without it
 * the backend 401s and the player just renders a black frame with no error
 * surfaced. So the resolved source is always passed as a {uri, headers}
 * object carrying the same Authorization header apiClient's interceptor
 * would have attached, not a bare url string.
 */
const ActivityMediaVideo = ({ mediaId, presignedUrl, style }: ActivityMediaVideoProps) => {
  const [active, setActive] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [source, setSource] = useState<VideoSource | null>(null);
  const [error, setError] = useState(false);

  const activate = async () => {
    if (active) return;
    setActive(true);

    const token = await storageService.getUserToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    if (presignedUrl) {
      setSource({ uri: presignedUrl, headers });
      return;
    }
    if (!mediaId) {
      setError(true);
      return;
    }
    setResolving(true);
    mediaService
      .getDownloadUrl(mediaId)
      .then((resolved) => setSource({ uri: resolved || mediaService.getContentUrl(mediaId), headers }))
      .catch(() => setSource({ uri: mediaService.getContentUrl(mediaId), headers }))
      .finally(() => setResolving(false));
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
    return <ActiveVideo source={source} style={style} onError={() => setError(true)} />;
  }

  // Phase 1 — lazy preview, no network request until tapped.
  return (
    <TouchableOpacity style={[styles.preview, style as StyleProp<ViewStyle>]} activeOpacity={0.85} onPress={activate}>
      <View style={styles.playButton}>
        <FontAwesome5 name="play" size={22} color="#FFFFFF" style={{ marginLeft: 3 }} />
      </View>
      <Text style={styles.playLabel}>Lire la vidéo</Text>
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
