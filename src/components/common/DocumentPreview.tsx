import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { colors, radius, spacing, typography, useThemeColors } from "../../styles/theme";
import { mediaService } from "../../services/api";
import { storageService } from "../../services/storageService";

/** Mirrors web's ProfessorsContent.jsx `toRelativePath` — a stored CNI/selfie value is often a full Wasabi/MinIO URL; the download-by-path lookup needs the relative storage key. */
const toRelativePath = (raw: string): string => {
  if (!raw.startsWith("http")) return raw;
  try {
    const pathname = new URL(raw).pathname.replace(/^\//, "");
    const idx = pathname.indexOf("users/");
    if (idx >= 0) return pathname.slice(idx);
    const parts = pathname.split("/");
    return parts.length > 1 ? parts.slice(1).join("/") : pathname;
  } catch {
    return raw;
  }
};

interface DocumentPreviewProps {
  path: string;
  label: string;
}

/**
 * A validation-document thumbnail (professor CNI recto/verso, selfie) that
 * resolves the stored path to a real viewable URL and opens full-screen on
 * tap — mirrors web's DocumentCard/DocumentViewer in ProfessorsContent.jsx.
 * Admin previously had no way to see these documents at all before
 * approving/rejecting a professor.
 */
const DocumentPreview = ({ path, label }: DocumentPreviewProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [url, setUrl] = useState<string | null>(null);
  const [authHeader, setAuthHeader] = useState<Record<string, string> | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setUrl(null);
    const relative = toRelativePath(path);
    mediaService
      .getDownloadUrlByPath(relative)
      .then(async (resolved) => {
        if (cancelled) return;
        if (resolved) {
          setUrl(resolved);
        } else {
          setFailed(true);
        }
      })
      .catch(async () => {
        if (cancelled) return;
        setFailed(true);
      });
    storageService.getUserToken().then((token) => {
      if (!cancelled && token) setAuthHeader({ Authorization: `Bearer ${token}` });
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return (
    <>
      <TouchableOpacity style={styles.thumb} onPress={() => url && setOpen(true)} disabled={!url}>
        {!url && !failed ? (
          <ActivityIndicator color={colors.textMuted} />
        ) : failed ? (
          <FontAwesome5 name="file-alt" size={22} color={colors.textMuted} />
        ) : (
          <Image source={{ uri: url ?? undefined, headers: authHeader }} style={styles.thumbImage} resizeMode="cover" onError={() => setFailed(true)} />
        )}
        <Text style={styles.thumbLabel} numberOfLines={1}>
          {label}
        </Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalClose} onPress={() => setOpen(false)}>
            <FontAwesome5 name="times" size={22} color={colors.white} />
          </TouchableOpacity>
          {url ? <Image source={{ uri: url ?? undefined, headers: authHeader }} style={styles.fullImage} resizeMode="contain" /> : null}
          <Text style={styles.modalLabel}>{label}</Text>
        </View>
      </Modal>
    </>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  thumb: {
    width: 100,
    height: 90,
    borderRadius: radius.sm,
    backgroundColor: colors.grayLight,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbImage: { width: "100%", height: "100%" },
  thumbLabel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    ...typography.caption,
    fontSize: 10,
    color: colors.white,
    backgroundColor: "rgba(17,24,39,0.6)",
    textAlign: "center",
    paddingVertical: 2,
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", alignItems: "center", justifyContent: "center" },
  modalClose: { position: "absolute", top: 48, right: 24, zIndex: 1, padding: spacing.sm },
  fullImage: { width: "100%", height: "80%" },
  modalLabel: { ...typography.body, color: colors.white, marginTop: spacing.md },
});

export default DocumentPreview;
