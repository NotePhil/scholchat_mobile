import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ImageStyle, StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useThemeColors } from '../../styles/theme';
import { mediaService } from '../../services/api';
import { storageService } from '../../services/storageService';

interface ActivityMediaImageProps {
  mediaId?: string;
  presignedUrl?: string | null;
  /** Size/shape of the box. The image always fills it, so loading and broken states keep the same footprint. */
  style?: StyleProp<ViewStyle | ImageStyle>;
  onPress?: () => void;
  resizeMode?: 'cover' | 'contain';
  /** Background shown while loading or broken. Defaults to the theme's elevated surface; the full-screen viewer passes 'transparent'. */
  placeholderColor?: string;
}

/**
 * Resolves a loadable image URL, the same way scholchat_front's LazyMedia does:
 * use the embedded presignedUrl when there is one, otherwise call
 * /media/{id}/download-url, and fall back to the auth-gated /media/{id}/content
 * proxy. The proxy is also retried once if the presigned URL fails to load,
 * because in dev the presigned host is often `localhost:9000`, which a phone
 * can't reach.
 *
 * States, matching web: a pulsing skeleton with a spinner while the URL resolves
 * or the image downloads, then the image, or a muted broken-image icon (web's
 * BrokenImagePlaceholder). An empty grey box never stays on screen.
 */
const ActivityMediaImage = ({
  mediaId,
  presignedUrl,
  style,
  onPress,
  resizeMode = 'cover',
  placeholderColor,
}: ActivityMediaImageProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(), []);
  const [url, setUrl] = useState<string | null>(presignedUrl ?? null);
  // The /media/{id}/content proxy needs the Bearer token; a presigned S3 URL
  // must NOT get it (an extra header breaks the signature).
  const [needsAuthHeader, setNeedsAuthHeader] = useState(false);
  const [authHeader, setAuthHeader] = useState<Record<string, string> | undefined>(undefined);
  const [triedProxy, setTriedProxy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setTriedProxy(false);
    setFailed(false);
    setLoaded(false);
    setNeedsAuthHeader(false);
    if (presignedUrl) {
      setUrl(presignedUrl);
      return;
    }
    setUrl(null);
    if (!mediaId) {
      setFailed(true);
      return;
    }
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
      setLoaded(false);
      setUrl(mediaService.getContentUrl(mediaId));
      setNeedsAuthHeader(true);
    } else {
      setFailed(true);
    }
  };

  // Wait for the token before requesting the proxy URL, otherwise the first request 401s.
  const waitingForToken = needsAuthHeader && !authHeader;
  const showImage = !!url && !failed && !waitingForToken;
  const bg = placeholderColor ?? colors.surfaceElevated;

  const body = (
    <>
      {showImage ? (
        <Image
          source={{ uri: url as string, headers: authHeader }}
          style={StyleSheet.absoluteFill}
          resizeMode={resizeMode}
          onLoad={() => setLoaded(true)}
          onError={handleError}
        />
      ) : null}
      {!loaded || failed ? (
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: bg }]} pointerEvents="none">
          {failed ? (
            <FontAwesome5 name="image" size={26} color={colors.textLight} style={{ opacity: 0.5 }} />
          ) : (
            <ActivityIndicator color={colors.textLight} />
          )}
        </View>
      ) : null}
    </>
  );

  const boxStyle = [styles.box, { backgroundColor: bg }, style as StyleProp<ViewStyle>];
  if (!onPress) return <View style={boxStyle}>{body}</View>;
  return (
    <TouchableOpacity style={boxStyle} activeOpacity={0.9} onPress={onPress}>
      {body}
    </TouchableOpacity>
  );
};

const createStyles = () =>
  StyleSheet.create({
    box: { overflow: 'hidden' },
    center: { alignItems: 'center', justifyContent: 'center' },
  });

export default ActivityMediaImage;
