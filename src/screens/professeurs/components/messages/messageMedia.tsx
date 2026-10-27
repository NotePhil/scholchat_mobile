import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FontAwesome5 } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { mediaService } from "../../../../services/api";
import { captureFromCamera, CaptureKind } from "../../../../utils/cameraCapture";
import { useThemeColors } from "../../../../styles/theme";
import { MessageMedia, MessageMediaPayload, MessageMediaType } from "../../../../types";
import { formatFileSize, mediaIconFor, mediaTypeFromMime } from "./messageHelpers";
import { useT } from "../../../../i18n";
import {
  VideoErrorPanel,
  VideoPlaybackSurface,
  VideoPreparing,
  VideoThumbnailTile,
} from "../../../../components/common/videoPlayback";

type ThemeColors = ReturnType<typeof useThemeColors>;

export const MAX_MESSAGE_MEDIAS = 10;

// ─────────────────────────────────────────────────────────────────────────────
// Pending (pre-send) attachments: pick → upload immediately → send `medias`
// ─────────────────────────────────────────────────────────────────────────────

export interface PendingAttachment {
  key: string;
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  mediaType: MessageMediaType;
  status: "uploading" | "done" | "error";
  progress: number;
  filePath?: string;
  error?: string;
}

/**
 * Attachment state for a composer (new-message modal or in-thread reply bar).
 * Files upload as soon as they're picked (presign → PUT, documentType
 * "messages"), so sending only has to wait for what's still in flight.
 */
export const useMessageAttachments = (userId?: string) => {
  const [items, setItems] = useState<PendingAttachment[]>([]);
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  const patch = useCallback((key: string, p: Partial<PendingAttachment>) => {
    if (!mountedRef.current) return;
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...p } : i)));
  }, []);

  const upload = useCallback(
    async (item: PendingAttachment) => {
      if (!userId) {
        patch(item.key, { status: "error", error: "Utilisateur non identifié." });
        return;
      }
      patch(item.key, { status: "uploading", progress: 0, error: undefined });
      try {
        const ref = await mediaService.uploadFileWithPath(
          { uri: item.uri, mimeType: item.mimeType, name: item.name },
          userId,
          item.mediaType,
          "messages",
          (fraction) => patch(item.key, { progress: fraction })
        );
        patch(item.key, { status: "done", progress: 1, filePath: ref.filePath });
      } catch (err) {
        patch(item.key, { status: "error", error: err instanceof Error ? err.message : "Échec du téléversement." });
      }
    },
    [userId, patch]
  );

  const itemsRef = useRef<PendingAttachment[]>([]);
  itemsRef.current = items;

  const addFiles = useCallback(
    (files: Omit<PendingAttachment, "key" | "status" | "progress">[]) => {
      const room = MAX_MESSAGE_MEDIAS - itemsRef.current.length;
      if (room <= 0) {
        Alert.alert("Limite atteinte", `Vous pouvez joindre au maximum ${MAX_MESSAGE_MEDIAS} fichiers.`);
        return;
      }
      if (files.length > room) {
        Alert.alert("Limite atteinte", `Seuls ${room} fichier(s) supplémentaire(s) ont été ajoutés (max ${MAX_MESSAGE_MEDIAS}).`);
      }
      const added: PendingAttachment[] = files.slice(0, room).map((f) => ({
        ...f,
        key: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        status: "uploading",
        progress: 0,
      }));
      itemsRef.current = [...itemsRef.current, ...added];
      setItems((prev) => [...prev, ...added]);
      added.forEach((a) => upload(a));
    },
    [upload]
  );

  const pickMedia = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission requise", "Autorisez l'accès à vos photos pour joindre une image ou une vidéo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_MESSAGE_MEDIAS,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    addFiles(
      result.assets.map((a) => {
        const isVideo = a.type === "video" || (a.mimeType ?? "").startsWith("video/");
        const mimeType = a.mimeType ?? (isVideo ? "video/mp4" : "image/jpeg");
        return {
          uri: a.uri,
          name: a.fileName ?? `${isVideo ? "video" : "photo"}_${Date.now()}.${isVideo ? "mp4" : "jpg"}`,
          mimeType,
          size: a.fileSize ?? undefined,
          mediaType: isVideo ? "VIDEO" : mediaTypeFromMime(mimeType),
        };
      })
    );
  }, [addFiles]);

  /** Take a photo / record a video with the camera and attach it. */
  const captureMedia = useCallback(
    async (kind: CaptureKind = "photo") => {
      const f = await captureFromCamera(kind);
      if (!f) return;
      addFiles([
        {
          uri: f.uri,
          name: f.name,
          mimeType: f.mimeType,
          size: f.size,
          mediaType: f.isVideo ? "VIDEO" : mediaTypeFromMime(f.mimeType),
        },
      ]);
    },
    [addFiles]
  );

  const pickDocument = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: "*/*", multiple: true, copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.length) return;
    addFiles(
      result.assets.map((a) => {
        const mimeType = a.mimeType ?? "application/octet-stream";
        return { uri: a.uri, name: a.name, mimeType, size: a.size ?? undefined, mediaType: mediaTypeFromMime(mimeType) };
      })
    );
  }, [addFiles]);

  const remove = useCallback((key: string) => setItems((prev) => prev.filter((i) => i.key !== key)), []);
  const retry = useCallback(
    (key: string) => {
      const item = items.find((i) => i.key === key);
      if (item) upload(item);
    },
    [items, upload]
  );
  const clear = useCallback(() => setItems([]), []);

  const isUploading = items.some((i) => i.status === "uploading");
  const hasErrors = items.some((i) => i.status === "error");
  const overallProgress = items.length ? items.reduce((n, i) => n + (i.status === "done" ? 1 : i.progress), 0) / items.length : 0;

  const toPayload = useCallback(
    (): MessageMediaPayload[] =>
      items
        .filter((i) => i.status === "done" && i.filePath)
        .map((i) => ({ fileName: i.name, filePath: i.filePath as string, contentType: i.mimeType, fileSize: i.size })),
    [items]
  );

  return { items, pickMedia, captureMedia, pickDocument, remove, retry, clear, isUploading, hasErrors, overallProgress, toPayload };
};

export const PendingAttachmentsBar = ({
  items,
  onRemove,
  onRetry,
}: {
  items: PendingAttachment[];
  onRemove: (key: string) => void;
  onRetry: (key: string) => void;
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (items.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.pendingRow}
    >
      {items.map((item) => {
        const pct = Math.round(item.progress * 100);
        const overlay =
          item.status === "uploading" ? (
            <View style={styles.pendingOverlay}>
              <ActivityIndicator size="small" color={colors.white} />
              <Text style={styles.pendingOverlayText}>{pct}%</Text>
            </View>
          ) : item.status === "error" ? (
            <TouchableOpacity style={[styles.pendingOverlay, styles.pendingOverlayError]} onPress={() => onRetry(item.key)}>
              <FontAwesome5 name="redo" size={12} color={colors.white} />
              <Text style={styles.pendingOverlayText}>Réessayer</Text>
            </TouchableOpacity>
          ) : null;
        const removeBtn = (
          <TouchableOpacity style={styles.pendingRemove} onPress={() => onRemove(item.key)} hitSlop={8} accessibilityLabel="Retirer">
            <FontAwesome5 name="times" size={9} color={colors.white} />
          </TouchableOpacity>
        );
        if (item.mediaType === "IMAGE") {
          return (
            <View key={item.key} style={styles.pendingThumbWrap}>
              <Image source={{ uri: item.uri }} style={styles.pendingThumb} />
              {overlay}
              {removeBtn}
            </View>
          );
        }
        return (
          <View key={item.key} style={[styles.pendingChip, item.status === "error" && { borderColor: colors.danger }]}>
            <FontAwesome5 name={mediaIconFor(item.mediaType, item.mimeType, item.name)} size={16} color={colors.primary} />
            <View style={{ maxWidth: 130 }}>
              <Text style={styles.pendingChipName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.pendingChipSub} numberOfLines={1}>
                {item.status === "uploading"
                  ? `Envoi… ${pct}%`
                  : item.status === "error"
                    ? "Échec — toucher pour réessayer"
                    : formatFileSize(item.size) || (item.mediaType === "VIDEO" ? "Vidéo" : "Document")}
              </Text>
            </View>
            {item.status === "error" ? (
              <TouchableOpacity onPress={() => onRetry(item.key)} hitSlop={8} accessibilityLabel="Réessayer">
                <FontAwesome5 name="redo" size={11} color={colors.danger} />
              </TouchableOpacity>
            ) : item.status === "uploading" ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : null}
            {removeBtn}
          </View>
        );
      })}
    </ScrollView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Displaying a sent/received message's medias
// ─────────────────────────────────────────────────────────────────────────────

/** presignedUrl first; if absent or it fails to load (expired), resolve via GET /media/download-by-path. */
const useResolvedMediaUrl = (media: MessageMedia, enabled = true) => {
  const [url, setUrl] = useState<string | null>(media.presignedUrl || null);
  const [failed, setFailed] = useState(false);
  const triedPathRef = useRef(false);

  const resolveByPath = useCallback(async () => {
    if (triedPathRef.current || !media.filePath) {
      setFailed(true);
      return;
    }
    triedPathRef.current = true;
    try {
      const resolved = await mediaService.getDownloadUrlByPath(media.filePath);
      if (resolved) setUrl(resolved);
      else setFailed(true);
    } catch {
      setFailed(true);
    }
  }, [media.filePath]);

  useEffect(() => {
    triedPathRef.current = false;
    setFailed(false);
    setUrl(media.presignedUrl || null);
    if (enabled && !media.presignedUrl) resolveByPath();
  }, [media.presignedUrl, media.filePath, enabled, resolveByPath]);

  return { url, failed, onError: resolveByPath };
};

/** Fresh URL for opening a file externally: by path when possible (presigned URLs on an old list may have expired). */
const resolveFreshUrl = async (media: MessageMedia): Promise<string | null> => {
  if (media.filePath) {
    try {
      const fresh = await mediaService.getDownloadUrlByPath(media.filePath);
      if (fresh) return fresh;
    } catch {
      // fall back to the embedded presigned URL
    }
  }
  return media.presignedUrl || null;
};

const openExternally = async (media: MessageMedia) => {
  const url = await resolveFreshUrl(media);
  if (!url) {
    Alert.alert("Erreur", "Fichier indisponible.");
    return;
  }
  Linking.openURL(url).catch(() => Alert.alert("Erreur", "Impossible d'ouvrir le fichier."));
};

const MessageImage = ({ media, styles, colors }: { media: MessageMedia; styles: Styles; colors: ThemeColors }) => {
  const { url, failed, onError } = useResolvedMediaUrl(media);
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  return (
    <>
      <TouchableOpacity activeOpacity={0.85} onPress={() => url && !failed && setOpen(true)} style={styles.imageThumbWrap}>
        {failed ? (
          <View style={[styles.imageThumb, styles.center]}>
            <FontAwesome5 name="image" size={20} color={colors.textMuted} />
            <Text style={styles.unavailableText}>Image indisponible</Text>
          </View>
        ) : url ? (
          <Image source={{ uri: url }} style={styles.imageThumb} resizeMode="cover" onError={onError} />
        ) : (
          <View style={[styles.imageThumb, styles.center]}>
            <ActivityIndicator color={colors.textMuted} />
          </View>
        )}
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.viewerOverlay}>
          <View style={[styles.viewerTopBar, { top: insets.top + 8 }]}>
            <TouchableOpacity onPress={() => openExternally(media)} style={styles.viewerButton} accessibilityLabel="Ouvrir">
              <FontAwesome5 name="external-link-alt" size={16} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setOpen(false)} style={styles.viewerButton} accessibilityLabel="Fermer">
              <FontAwesome5 name="times" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          {open ? <FullScreenImage media={media} initialUrl={url} styles={styles} /> : null}
          {media.fileName ? (
            <Text style={[styles.viewerLabel, { bottom: insets.bottom + 24 }]} numberOfLines={1}>
              {media.fileName}
            </Text>
          ) : null}
        </View>
      </Modal>
    </>
  );
};

/** Full-screen image: spinner until it has loaded, "Impossible d'afficher l'image" + Réessayer (fresh URL) on error. */
const FullScreenImage = ({ media, initialUrl, styles }: { media: MessageMedia; initialUrl: string | null; styles: Styles }) => {
  const { t } = useT();
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const retry = async () => {
    setError(false);
    setLoaded(false);
    const fresh = await resolveFreshUrl(media);
    setUrl(fresh);
    setAttempt((n) => n + 1);
    if (!fresh) setError(true);
  };
  return (
    <>
      {url && !error ? (
        <Image
          key={`${attempt}-${url}`}
          source={{ uri: url }}
          style={styles.viewerImage}
          resizeMode="contain"
          onLoadEnd={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      ) : null}
      {error ? (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <FontAwesome5 name="image" size={28} color="#9CA3AF" />
          <Text style={styles.viewerUnavailable}>{t("media.imageError")}</Text>
          <TouchableOpacity style={styles.viewerOpenButton} onPress={retry}>
            <FontAwesome5 name="redo" size={12} color="#FFFFFF" />
            <Text style={styles.viewerOpenText}>{t("media.retry")}</Text>
          </TouchableOpacity>
        </View>
      ) : !loaded ? (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.viewerUnavailable}>{t("media.loadingImage")}</Text>
        </View>
      ) : null}
    </>
  );
};

const VideoModal = ({ media, onClose, styles }: { media: MessageMedia; onClose: () => void; styles: Styles }) => {
  const { t } = useT();
  const { url, failed, onError } = useResolvedMediaUrl(media);
  const insets = useSafeAreaInsets();
  // Réessayer: a fresh URL (by path) and a remounted player.
  const [override, setOverride] = useState<string | null>(null);
  const [overrideFailed, setOverrideFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const effectiveUrl = override ?? url;
  const isFailed = override || retrying ? overrideFailed : failed;
  const retry = async () => {
    setRetrying(true);
    setOverrideFailed(false);
    const fresh = await resolveFreshUrl(media);
    setAttempt((n) => n + 1);
    setRetrying(false);
    if (fresh) setOverride(fresh);
    else setOverrideFailed(true);
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewerOverlay}>
        <View style={[styles.viewerTopBar, { top: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => openExternally(media)} style={styles.viewerButton} accessibilityLabel="Ouvrir">
            <FontAwesome5 name="external-link-alt" size={16} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={styles.viewerButton} accessibilityLabel="Fermer">
            <FontAwesome5 name="times" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        {isFailed ? (
          <VideoErrorPanel
            onRetry={retry}
            extra={
              <TouchableOpacity style={styles.viewerSecondaryButton} onPress={() => openExternally(media)}>
                <FontAwesome5 name="external-link-alt" size={11} color="#D1D5DB" />
                <Text style={styles.viewerSecondaryText}>{t("media.openExternally")}</Text>
              </TouchableOpacity>
            }
          />
        ) : effectiveUrl && !retrying ? (
          <VideoPlaybackSurface
            key={`${attempt}-${effectiveUrl}`}
            source={{ uri: effectiveUrl }}
            style={{ width: "100%", height: "70%" }}
            onError={() => (override ? setOverrideFailed(true) : onError())}
          />
        ) : (
          <VideoPreparing />
        )}
      </View>
    </Modal>
  );
};

const MessageVideo = ({ media, styles }: { media: MessageMedia; styles: Styles; mine: boolean }) => {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  // The URL is resolved (by path) only once the tile is on screen.
  const [wanted, setWanted] = useState(false);
  const { url, failed, onError } = useResolvedMediaUrl(media, wanted);
  const size = formatFileSize(media.fileSize);
  return (
    <>
      <VideoThumbnailTile
        source={url ? { uri: url } : null}
        failed={failed}
        onNeedSource={() => setWanted(true)}
        onSourceError={() => {
          onError();
          return true;
        }}
        onPress={() => setOpen(true)}
        style={styles.videoTile}
        compact
        topLeft={
          <View style={styles.videoBadge}>
            <FontAwesome5 name="video" size={9} color="#FFFFFF" />
            <Text style={styles.videoBadgeText} numberOfLines={1}>
              {media.fileName || t("media.video")}
            </Text>
          </View>
        }
        bottomLeft={size ? <Text style={styles.videoSize}>{size}</Text> : null}
      />
      {open && <VideoModal media={media} onClose={() => setOpen(false)} styles={styles} />}
    </>
  );
};

const MessageDocument = ({ media, styles, colors, mine }: { media: MessageMedia; styles: Styles; colors: ThemeColors; mine: boolean }) => {
  const [opening, setOpening] = useState(false);
  const fg = mine ? colors.white : colors.text;
  const sub = mine ? "rgba(255,255,255,0.75)" : colors.textMuted;
  return (
    <TouchableOpacity
      style={[styles.docChip, mine ? styles.docChipMine : styles.docChipTheirs]}
      activeOpacity={0.8}
      disabled={opening}
      onPress={async () => {
        setOpening(true);
        try {
          await openExternally(media);
        } finally {
          setOpening(false);
        }
      }}
    >
      <View style={[styles.docIcon, mine && { backgroundColor: "rgba(255,255,255,0.2)" }]}>
        <FontAwesome5 name={mediaIconFor("DOCUMENT", media.contentType, media.fileName)} size={16} color={mine ? colors.white : colors.primary} />
      </View>
      <View style={{ flexShrink: 1, minWidth: 0 }}>
        <Text style={[styles.docName, { color: fg }]} numberOfLines={1}>
          {media.fileName || "Document"}
        </Text>
        <Text style={[styles.docSize, { color: sub }]}>{formatFileSize(media.fileSize) || "Document"}</Text>
      </View>
      {opening ? <ActivityIndicator size="small" color={fg} /> : <FontAwesome5 name="download" size={12} color={sub} />}
    </TouchableOpacity>
  );
};

/** Renders a message's attachments inside its chat bubble. */
export const MessageMediaList = ({ medias, mine }: { medias?: MessageMedia[]; mine: boolean }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (!medias || medias.length === 0) return null;
  return (
    <View style={styles.mediaList}>
      {medias.map((m, i) => {
        const type = (m.mediaType as MessageMediaType) || mediaTypeFromMime(m.contentType);
        const key = m.id ?? m.filePath ?? String(i);
        if (type === "IMAGE") return <MessageImage key={key} media={m} styles={styles} colors={colors} />;
        if (type === "VIDEO") return <MessageVideo key={key} media={m} styles={styles} mine={mine} />;
        return <MessageDocument key={key} media={m} styles={styles} colors={colors} mine={mine} />;
      })}
    </View>
  );
};

type Styles = ReturnType<typeof createStyles>;

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    center: { alignItems: "center", justifyContent: "center" },
    // pending
    pendingRow: { gap: 8, paddingVertical: 6, paddingRight: 8 },
    pendingThumbWrap: { width: 64, height: 64, borderRadius: 12, overflow: "visible" },
    pendingThumb: { width: 64, height: 64, borderRadius: 12, backgroundColor: c.grayLight },
    pendingOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 12,
      backgroundColor: "rgba(0,0,0,0.45)",
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
    },
    pendingOverlayError: { backgroundColor: "rgba(239,68,68,0.75)" },
    pendingOverlayText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
    pendingRemove: {
      position: "absolute",
      top: -6,
      right: -6,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: c.gray,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: c.surface,
    },
    pendingChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      height: 64,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.background,
    },
    pendingChipName: { fontSize: 12, fontWeight: "700", color: c.text },
    pendingChipSub: { fontSize: 10, color: c.textMuted, marginTop: 2 },
    // in-bubble
    mediaList: { gap: 6, marginBottom: 6 },
    imageThumbWrap: { borderRadius: 14, overflow: "hidden" },
    imageThumb: { width: 220, height: 180, backgroundColor: c.grayLight },
    unavailableText: { fontSize: 10, color: c.textMuted, marginTop: 4 },
    videoTile: { width: 220, height: 130, borderRadius: 14 },
    videoBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      maxWidth: "100%",
      backgroundColor: "rgba(0,0,0,0.6)",
      borderRadius: 10,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    videoBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700", flexShrink: 1 },
    videoSize: {
      color: "#FFFFFF",
      fontSize: 10,
      fontWeight: "600",
      backgroundColor: "rgba(0,0,0,0.6)",
      borderRadius: 6,
      paddingHorizontal: 5,
      paddingVertical: 1,
      overflow: "hidden",
    },
    docChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 8,
      borderRadius: 12,
      minWidth: 180,
      maxWidth: 240,
    },
    docChipMine: { backgroundColor: "rgba(255,255,255,0.15)" },
    docChipTheirs: { backgroundColor: c.background, borderWidth: 1, borderColor: c.border },
    docIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: c.primaryLight, alignItems: "center", justifyContent: "center" },
    docName: { fontSize: 13, fontWeight: "700" },
    docSize: { fontSize: 10, marginTop: 1 },
    // viewer
    viewerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", alignItems: "center", justifyContent: "center" },
    viewerTopBar: { position: "absolute", right: 12, zIndex: 2, flexDirection: "row", gap: 8 },
    viewerButton: { padding: 10, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.12)" },
    viewerImage: { width: "100%", height: "80%" },
    viewerLabel: { position: "absolute", left: 24, right: 24, textAlign: "center", color: "#FFFFFF", fontSize: 13 },
    viewerUnavailable: { color: "#D1D5DB", fontSize: 13, marginTop: 10 },
    viewerOpenButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 14,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: c.primary,
    },
    viewerOpenText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
    viewerSecondaryButton: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, padding: 8 },
    viewerSecondaryText: { color: "#D1D5DB", fontSize: 12, fontWeight: "600", textDecorationLine: "underline" },
  });
