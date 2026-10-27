import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { VideoSource } from 'expo-video';
import { mediaService } from '../../services/api';
import { storageService } from '../../services/storageService';
import { VideoErrorPanel, VideoPlaybackSurface, VideoPreparing, VideoThumbnailTile } from './videoPlayback';

interface ActivityMediaVideoProps {
  mediaId?: string;
  presignedUrl?: string | null;
  style?: StyleProp<ViewStyle>;
  /** Full-screen viewer: resolve and play right away, with the loading overlay and Réessayer. */
  autoPlay?: boolean;
  /** Smaller play button and chip, for small grid cells. */
  compact?: boolean;
  /** Tile only: tap (opens the full-screen viewer). */
  onPress?: () => void;
}

/**
 * Resolves a playable source for an activity video. The resolved URL is one of two kinds, and
 * only one of them wants the app's Bearer token:
 *   - a presigned S3/MinIO URL (embedded presignedUrl or GET /media/{id}/download-url): it
 *     authenticates through its signed query string; an extra Authorization header breaks the
 *     signature and the player shows nothing;
 *   - the /media/{id}/content proxy stream (when no presigned URL can be had, or it failed):
 *     auth-gated, needs the header.
 * A player error on the presigned URL retries once through the proxy before giving up.
 */
const useActivityVideoSource = (mediaId?: string, presignedUrl?: string | null) => {
  const [source, setSource] = useState<VideoSource | null>(null);
  const [failed, setFailed] = useState(false);
  const triedProxy = useRef(false);
  const resolving = useRef(false);

  const switchToProxy = useCallback(async () => {
    if (!mediaId) {
      setFailed(true);
      return;
    }
    triedProxy.current = true;
    const token = await storageService.getUserToken();
    setSource({ uri: mediaService.getContentUrl(mediaId), headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  }, [mediaId]);

  /** `fresh`: ignore the embedded presigned URL (it may have expired) — used by Réessayer. */
  const resolve = useCallback(
    async (fresh = false) => {
      if (resolving.current) return;
      setFailed(false);
      if (!fresh && presignedUrl) {
        setSource({ uri: presignedUrl });
        return;
      }
      if (!mediaId) {
        setFailed(true);
        return;
      }
      resolving.current = true;
      try {
        const resolved = await mediaService.getDownloadUrl(mediaId);
        if (resolved) setSource({ uri: resolved });
        else await switchToProxy();
      } catch {
        await switchToProxy();
      } finally {
        resolving.current = false;
      }
    },
    [mediaId, presignedUrl, switchToProxy]
  );

  /** Returns true when a fallback source is on its way. */
  const onSourceError = useCallback(() => {
    if (!triedProxy.current && mediaId) {
      switchToProxy();
      return true;
    }
    return false;
  }, [mediaId, switchToProxy]);

  const retry = useCallback(() => {
    triedProxy.current = false;
    setSource(null);
    resolve(true);
  }, [resolve]);

  return { source, failed, resolve, onSourceError, retry };
};

const ActivityMediaVideo = ({ mediaId, presignedUrl, style, autoPlay = false, compact = false, onPress }: ActivityMediaVideoProps) => {
  const { source, failed, resolve, onSourceError, retry } = useActivityVideoSource(mediaId, presignedUrl);
  const [playError, setPlayError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (autoPlay) resolve();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay]);

  if (!autoPlay) {
    return (
      <VideoThumbnailTile
        source={source}
        failed={failed}
        onNeedSource={() => resolve()}
        onSourceError={onSourceError}
        onPress={onPress}
        style={style}
        compact={compact}
      />
    );
  }

  if (failed || playError) {
    return (
      <VideoErrorPanel
        style={style}
        onRetry={() => {
          setPlayError(false);
          setAttempt((n) => n + 1);
          retry();
        }}
      />
    );
  }
  if (!source) return <VideoPreparing style={style} />;
  const uri = typeof source === 'object' && source && 'uri' in source ? String(source.uri) : '';
  return (
    <VideoPlaybackSurface
      key={`${attempt}-${uri}`}
      source={source}
      style={style}
      onError={() => {
        if (!onSourceError()) setPlayError(true);
      }}
    />
  );
};

export default ActivityMediaVideo;
