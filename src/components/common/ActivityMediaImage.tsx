import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ImageStyle, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useThemeColors } from '../../styles/theme';
import { mediaService } from '../../services/api';
import { storageService } from '../../services/storageService';
import { useT } from '../../i18n';

interface ActivityMediaImageProps {
  mediaId?: string;
  presignedUrl?: string | null;
  /** Size/shape of the box. The image always fills it, so loading and broken states keep the same footprint. */
  style?: StyleProp<ViewStyle | ImageStyle>;
  onPress?: () => void;
  resizeMode?: 'cover' | 'contain';
  /** Background shown while loading or broken. Defaults to the theme's elevated surface; the full-screen viewer passes 'transparent'. */
  placeholderColor?: string;
  /** Full-screen viewer: a "Chargement de l'image…" label while loading and a Réessayer button when it fails. */
  retryable?: boolean;
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
  retryable = false,
}: ActivityMediaImageProps) => {
  const { t } = useT();
  const [retryNonce, setRetryNonce] = useState(0);
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
  }, [mediaId, presignedUrl, retryNonce]);

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
          key={retryNonce}
          source={{ uri: url as string, headers: authHeader }}
          style={StyleSheet.absoluteFill}
          resizeMode={resizeMode}
          onLoad={() => setLoaded(true)}
          onError={handleError}
        />
      ) : null}
      {!loaded || failed ? (
        <View
          style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: bg }]}
          pointerEvents={retryable && failed ? 'box-none' : 'none'}
        >
          {failed ? (
            <>
              <FontAwesome5 name="image" size={26} color={retryable ? '#9CA3AF' : colors.textLight} style={{ opacity: retryable ? 1 : 0.5 }} />
              {retryable ? (
                <>
                  <Text style={styles.viewerText}>{t('media.imageError')}</Text>
                  <TouchableOpacity style={styles.retryBtn} onPress={() => setRetryNonce((n) => n + 1)} accessibilityRole="button">
                    <FontAwesome5 name="redo" size={12} color="#FFFFFF" />
                    <Text style={styles.retryText}>{t('media.retry')}</Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </>
          ) : (
            <>
              <ActivityIndicator color={retryable ? '#FFFFFF' : colors.textLight} size={retryable ? 'large' : 'small'} />
              {retryable ? <Text style={styles.viewerText}>{t('media.loadingImage')}</Text> : null}
            </>
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
    viewerText: { color: '#E5E7EB', fontSize: 13, fontWeight: '600', marginTop: 10 },
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

export default ActivityMediaImage;
