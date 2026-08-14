import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ImageStyle, StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors } from '../../styles/theme';
import { mediaService } from '../../services/api';
import { storageService } from '../../services/storageService';

interface ActivityMediaImageProps {
  mediaId?: string;
  presignedUrl?: string | null;
  style?: StyleProp<ImageStyle>;
  onPress?: () => void;
  resizeMode?: 'cover' | 'contain';
}

/**
 * Resolves a real, loadable image URL before rendering — mirrors
 * scholchat_front's LazyMedia component. A media object's embedded
 * `filePath`/`presignedUrl` from a list endpoint is not reliably a fetchable
 * URI, so this calls /media/{id}/download-url (falling back to the direct
 * /media/{id}/content proxy stream) instead of ever using filePath as-is.
 *
 * The presigned S3 URL's host comes straight from the backend's `s3.endpoint`
 * config — in local/dev setups that's commonly `localhost:9000`, which only
 * resolves on the machine running the backend itself. A browser on that same
 * laptop loads it fine; a phone on the network cannot. So this always retries
 * through `/media/{id}/content` (a same-origin proxy stream served BY the
 * backend API, which the app already reaches for every other request) before
 * giving up — not just as the initial resolution fallback, but also whenever
 * the presigned URL fails to actually load.
 */
const ActivityMediaImage = ({ mediaId, presignedUrl, style, onPress, resizeMode = 'cover' }: ActivityMediaImageProps) => {
  const [url, setUrl] = useState<string | null>(presignedUrl ?? null);
  // The /media/{id}/content proxy is auth-gated — unlike a presigned S3 url,
  // a request to it with no Authorization header 401s and Image just shows
  // it as a load failure with no useful signal why. Tracked separately so
  // the header is only attached for that specific URL, not the S3 one.
  const [needsAuthHeader, setNeedsAuthHeader] = useState(false);
  const [authHeader, setAuthHeader] = useState<Record<string, string> | undefined>(undefined);
  const [triedProxy, setTriedProxy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setTriedProxy(false);
    setFailed(false);
    setNeedsAuthHeader(false);
    if (presignedUrl) {
      setUrl(presignedUrl);
      return;
    }
    if (!mediaId) return;
    let cancelled = false;
    mediaService
      .getDownloadUrl(mediaId)
      .then((resolved) => {
        if (cancelled) return;
        if (resolved) setUrl(resolved);
        else {
          setUrl(mediaService.getContentUrl(mediaId));
          setNeedsAuthHeader(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setUrl(mediaService.getContentUrl(mediaId));
        setNeedsAuthHeader(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mediaId, presignedUrl]);

  useEffect(() => {
    if (!needsAuthHeader) {
      setAuthHeader(undefined);
      return;
    }
    let cancelled = false;
    storageService.getUserToken().then((token) => {
      if (!cancelled && token) setAuthHeader({ Authorization: `Bearer ${token}` });
    });
    return () => {
      cancelled = true;
    };
  }, [needsAuthHeader]);

  const handleError = () => {
    if (!triedProxy && mediaId) {
      setTriedProxy(true);
      setUrl(mediaService.getContentUrl(mediaId));
      setNeedsAuthHeader(true);
    } else {
      setFailed(true);
    }
  };

  const content =
    !url || failed ? (
      <View style={[styles.placeholder, style as StyleProp<ViewStyle>]}>
        {!failed ? <ActivityIndicator color={colors.textMuted} /> : <FontAwesome5 name="image" size={18} color={colors.textMuted} />}
      </View>
    ) : (
      <Image
        source={{ uri: url, headers: authHeader }}
        style={StyleSheet.flatten([styles.image, style])}
        resizeMode={resizeMode}
        onError={handleError}
      />
    );

  if (!onPress) return content;
  return <TouchableOpacity onPress={onPress}>{content}</TouchableOpacity>;
};

const styles = StyleSheet.create({
  image: { backgroundColor: colors.grayLight },
  placeholder: { backgroundColor: colors.grayLight, alignItems: 'center', justifyContent: 'center' },
});

export default ActivityMediaImage;
